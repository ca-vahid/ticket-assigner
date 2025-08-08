import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';
import { TicketWorkloadCalculator } from './ticket-workload-calculator';

@Injectable()
export class SyncTicketCountsCommand {
  private readonly logger = new Logger(SyncTicketCountsCommand.name);
  private unmatchedResponderIds: Set<string>;

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    private freshserviceService: FreshserviceService,
    private workloadCalculator: TicketWorkloadCalculator,
  ) {}

  async execute(): Promise<{ updated: number; total: number }> {
    this.logger.log('🎫 Starting ticket count sync...');

    try {
      // Get all active agents
      const agents = await this.agentRepository.find({
        where: { isAvailable: true },
      });

      this.logger.log(`Found ${agents.length} active agents to update`);

      let updated = 0;

      // Get all tickets from Freshservice
      // We'll get all tickets and filter locally for open/pending status
      // Status: 2 = Open, 3 = Pending, 4 = Resolved, 5 = Closed
      
      this.logger.log('Fetching all tickets from Freshservice (this may take a minute)...');
      // Fetch tickets with proper pagination
      const allTicketsRaw = await this.freshserviceService.getTickets({
        per_page: 100,
        include: 'requester,stats', // Include additional ticket info
      });
      
      // Filter for open and pending tickets only (status 2 and 3)
      const allTickets = allTicketsRaw.filter(ticket => 
        ticket.status === 2 || ticket.status === 3
      );
      
      this.logger.log(`Found ${allTickets.length} open/pending tickets out of ${allTicketsRaw.length} total`);
      
      // Log ticket responder IDs to debug assignment issues
      const responderIds = new Set(allTickets.map(t => t.responder_id).filter(Boolean));
      this.logger.log(`Unique responder IDs in tickets: ${responderIds.size}`);

      // Create a map of agent to their tickets
      const agentTicketsMap = new Map<string, any[]>();

      // Group tickets by agent
      for (const ticket of allTickets) {
        if (ticket.responder_id) {
          // Get agent by Freshservice ID
          const agent = agents.find(a => a.freshserviceId === String(ticket.responder_id));
          if (agent) {
            if (!agentTicketsMap.has(agent.id)) {
              agentTicketsMap.set(agent.id, []);
            }
            agentTicketsMap.get(agent.id)!.push(ticket);
          } else {
            // Log unmatched responder IDs for debugging
            if (!this.unmatchedResponderIds?.has(String(ticket.responder_id))) {
              this.logger.warn(`⚠️ Ticket assigned to unknown responder_id: ${ticket.responder_id}`);
              if (!this.unmatchedResponderIds) this.unmatchedResponderIds = new Set();
              this.unmatchedResponderIds.add(String(ticket.responder_id));
            }
          }
        }
      }

      // Update each agent's ticket count and workload
      for (const agent of agents) {
        const agentTickets = agentTicketsMap.get(agent.id) || [];
        
        // Special logging for debugging randrews
        if (agent.email === 'randrews@bgcengineering.ca') {
          this.logger.log(`🔍 DEBUG - R Andrews: freshserviceId=${agent.freshserviceId}, found ${agentTickets.length} tickets`);
          if (agentTickets.length > 0) {
            this.logger.log(`   Sample ticket: ${JSON.stringify(agentTickets[0])}`);
          }
        }
        
        const workload = this.workloadCalculator.calculateAgentWorkload(
          agent.id,
          agentTickets
        );
        
        // Store both raw and weighted counts
        const newRawCount = workload.rawTicketCount;
        const newWeightedCount = workload.weightedTicketCount;
        
        // Log detailed workload for debugging
        if (agentTickets.length > 0) {
          this.workloadCalculator.logWorkloadSummary(
            `${agent.firstName} ${agent.lastName}`,
            workload
          );
        }
        
        // Update if changed
        if (agent.currentTicketCount !== newRawCount || 
            agent.weightedTicketCount !== newWeightedCount) {
          agent.currentTicketCount = newRawCount;
          agent.weightedTicketCount = newWeightedCount;
          agent.ticketWorkloadBreakdown = workload.ticketBreakdown;
          await this.agentRepository.save(agent);
          updated++;
          this.logger.log(
            `Updated ${agent.firstName} ${agent.lastName}: ` +
            `${newRawCount} tickets (${newWeightedCount} weighted)`
          );
        }
      }

      this.logger.log(`✅ Ticket count sync completed: ${updated}/${agents.length} agents updated`);

      return {
        updated,
        total: agents.length,
      };
    } catch (error) {
      this.logger.error('Failed to sync ticket counts:', error);
      throw error;
    }
  }

  async updateSingleAgent(agentId: string): Promise<number> {
    try {
      const agent = await this.agentRepository.findOne({ 
        where: { id: agentId } 
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Get tickets assigned to this specific agent
      const allTickets = await this.freshserviceService.getTickets({
        per_page: 100,
      });
      
      const agentTickets = allTickets.filter(ticket => 
        (ticket.status === 2 || ticket.status === 3) && 
        ticket.responder_id === parseInt(agent.freshserviceId)
      );

      const newCount = agentTickets.length;
      
      if (agent.currentTicketCount !== newCount) {
        agent.currentTicketCount = newCount;
        await this.agentRepository.save(agent);
        this.logger.log(`Updated ${agent.firstName} ${agent.lastName}: ${newCount} tickets`);
      }

      return newCount;
    } catch (error) {
      this.logger.error(`Failed to update ticket count for agent ${agentId}:`, error);
      throw error;
    }
  }
}