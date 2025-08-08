import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';

@Injectable()
export class SyncAgentsCommand {
  private readonly logger = new Logger(SyncAgentsCommand.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    private freshserviceService: FreshserviceService,
  ) {}

  async execute(options: { workspaceId?: number } = {}): Promise<{ synced: number; skipped: number }> {
    this.logger.log('🔄 Starting agent sync from Freshservice...');
    
    // Default to IT workspace (ID: 2) if not specified
    const IT_WORKSPACE_ID = options.workspaceId || 2;
    let syncedCount = 0;
    let skippedCount = 0;

    try {
      // Fetch all agents from Freshservice
      const freshserviceAgents = await this.freshserviceService.getAllAgents();
      this.logger.log(`📥 Fetched ${freshserviceAgents.length} agents from Freshservice`);

      // Filter for IT workspace agents only
      const itAgents = freshserviceAgents.filter(agent => {
        // Check if agent is in IT workspace
        return agent.workspace_ids && agent.workspace_ids.includes(IT_WORKSPACE_ID);
      });

      this.logger.log(`🎯 Found ${itAgents.length} agents in IT workspace (ID: ${IT_WORKSPACE_ID})`);

      // Sync each IT agent
      for (const fsAgent of itAgents) {
        if (!fsAgent.active) {
          this.logger.debug(`Skipping inactive agent: ${fsAgent.first_name} ${fsAgent.last_name}`);
          skippedCount++;
          continue;
        }

        // Check if agent exists
        let agent = await this.agentRepository.findOne({
          where: { freshserviceId: fsAgent.id.toString() }
        });

        if (!agent) {
          // Create new agent
          const skills = this.extractSkills(fsAgent);
          const level = this.mapAgentLevel(fsAgent);
          agent = this.agentRepository.create({
            freshserviceId: fsAgent.id.toString(),
            email: fsAgent.email,
            firstName: fsAgent.first_name,
            lastName: fsAgent.last_name,
            experienceLevel: level,
            level: level as any, // Map to AgentLevel enum
            isAvailable: fsAgent.active,
            location: fsAgent.location_id ? `Location-${fsAgent.location_id}` : 'Unknown',
            timezone: fsAgent.time_zone || 'America/Toronto',
            skills: skills.length > 0 ? skills : [],
            currentTicketCount: 0,
            maxConcurrentTickets: 10,
            lastSyncAt: new Date()
          });
          
          await this.agentRepository.save(agent);
          this.logger.log(`✅ Created agent: ${agent.firstName} ${agent.lastName}`);
          syncedCount++;
        } else {
          // Update existing agent
          agent.email = fsAgent.email;
          agent.firstName = fsAgent.first_name;
          agent.lastName = fsAgent.last_name;
          agent.isAvailable = fsAgent.active;
          agent.location = fsAgent.location_id ? `Location-${fsAgent.location_id}` : agent.location;
          agent.timezone = fsAgent.time_zone || agent.timezone;
          agent.lastSyncAt = new Date();
          
          await this.agentRepository.save(agent);
          this.logger.log(`📝 Updated agent: ${agent.firstName} ${agent.lastName}`);
          syncedCount++;
        }
      }

      this.logger.log(`✅ Agent sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
      return { synced: syncedCount, skipped: skippedCount };
    } catch (error) {
      this.logger.error('❌ Agent sync failed:', error);
      throw error;
    }
  }

  private mapAgentLevel(fsAgent: any): string {
    // Map Freshservice roles to experience levels
    if (fsAgent.roles?.some((r: any) => r.role_name?.includes('Admin'))) {
      return 'L3';
    } else if (fsAgent.roles?.some((r: any) => r.role_name?.includes('Supervisor'))) {
      return 'L2';
    }
    return 'L1';
  }

  private extractSkills(fsAgent: any): string[] {
    // Extract skills from agent's group memberships or custom fields
    const skills = [];
    
    if (fsAgent.group_ids?.length > 0) {
      // Map group IDs to skill categories
      // This would be customized based on your Freshservice setup
      skills.push('general_support');
    }
    
    if (fsAgent.roles?.some((r: any) => r.role_name?.includes('IT'))) {
      skills.push('hardware', 'software');
    }
    
    return skills;
  }
}