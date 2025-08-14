import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../database/entities/settings.entity';

export interface TicketWorkload {
  ticketId: string;
  assignedDate: Date;
  ageInDays: number;
  ageInBusinessDays: number;
  weight: number;
  category: 'fresh' | 'recent' | 'stale' | 'abandoned';
}

export interface AgentWorkload {
  agentId: string;
  rawTicketCount: number;
  weightedTicketCount: number;
  ticketBreakdown: {
    fresh: number;      // < 1 business day
    recent: number;     // 1-2 business days
    stale: number;      // 3-10 business days
    abandoned: number;  // > 10 business days
  };
  workloadScore: number; // 0-1, higher means more overloaded
  tickets: TicketWorkload[];
}

@Injectable()
export class TicketWorkloadCalculator {
  private readonly logger = new Logger(TicketWorkloadCalculator.name);
  private ticketAgeWeights: { fresh: number; recent: number; stale: number; old: number } | null = null;

  constructor(
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
  ) {}

  /**
   * Calculate business days between two dates
   * Excludes weekends (Saturday and Sunday)
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return Math.max(0, count - 1); // Subtract 1 to not count the start date
  }

  /**
   * Load ticket age weights from settings
   */
  private async loadTicketAgeWeights(): Promise<void> {
    const setting = await this.settingsRepository.findOne({
      where: { key: 'scoring.ticketAgeWeights' }
    });
    
    if (setting) {
      this.ticketAgeWeights = setting.value;
    } else {
      // Use default weights
      this.ticketAgeWeights = {
        fresh: 2.0,
        recent: 1.2,
        stale: 0.5,
        old: 0.1
      };
    }
  }

  /**
   * Calculate the weight of a ticket based on its age
   * Uses configurable weights from settings
   */
  async calculateTicketWeight(ticketCreatedDate: Date, now: Date = new Date()): Promise<TicketWorkload> {
    // Ensure weights are loaded
    if (!this.ticketAgeWeights) {
      await this.loadTicketAgeWeights();
    }
    const ageInDays = Math.floor((now.getTime() - ticketCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
    const ageInBusinessDays = this.calculateBusinessDays(ticketCreatedDate, now);
    
    let weight: number;
    let category: 'fresh' | 'recent' | 'stale' | 'abandoned';
    const weights = this.ticketAgeWeights!;
    
    // Use configurable weights based on age
    if (ageInBusinessDays <= 1) {
      // 0-1 business days - fresh
      weight = weights.fresh;
      category = 'fresh';
    } else if (ageInBusinessDays <= 5) {
      // 2-5 business days - recent
      weight = weights.recent;
      category = 'recent';
    } else if (ageInBusinessDays <= 14) {
      // 6-14 business days - stale
      weight = weights.stale;
      category = 'stale';
    } else {
      // 15+ business days - old/abandoned
      weight = weights.old;
      category = 'abandoned';
    }
    
    return {
      ticketId: '',
      assignedDate: ticketCreatedDate,
      ageInDays,
      ageInBusinessDays,
      weight,
      category
    };
  }

  /**
   * Calculate agent's workload based on their tickets
   * Returns both raw count and weighted count
   */
  async calculateAgentWorkload(
    agentId: string,
    tickets: Array<{ id: string; created_at: Date | string; status: number }>
  ): Promise<AgentWorkload> {
    const now = new Date();
    const ticketWorkloads: TicketWorkload[] = [];
    const breakdown = {
      fresh: 0,
      recent: 0,
      stale: 0,
      abandoned: 0
    };
    
    let totalWeight = 0;
    
    for (const ticket of tickets) {
      const createdDate = typeof ticket.created_at === 'string' 
        ? new Date(ticket.created_at) 
        : ticket.created_at;
      
      const workload = await this.calculateTicketWeight(createdDate, now);
      workload.ticketId = ticket.id;
      
      ticketWorkloads.push(workload);
      totalWeight += workload.weight;
      breakdown[workload.category]++;
    }
    
    // Calculate workload score (0-1 scale)
    // Assuming 10 weighted tickets is "full" workload
    const maxWeightedTickets = 10;
    const workloadScore = Math.min(1, totalWeight / maxWeightedTickets);
    
    return {
      agentId,
      rawTicketCount: tickets.length,
      weightedTicketCount: parseFloat(totalWeight.toFixed(2)),
      ticketBreakdown: breakdown,
      workloadScore: parseFloat(workloadScore.toFixed(3)),
      tickets: ticketWorkloads
    };
  }

  /**
   * Compare two agents' workloads
   * Returns positive if agent1 is more loaded, negative if agent2 is more loaded
   */
  compareWorkloads(workload1: AgentWorkload, workload2: AgentWorkload): number {
    // First compare by weighted count
    const weightDiff = workload1.weightedTicketCount - workload2.weightedTicketCount;
    if (Math.abs(weightDiff) > 0.1) {
      return weightDiff;
    }
    
    // If similar weighted count, compare fresh tickets (prevent gaming)
    const freshDiff = workload1.ticketBreakdown.fresh - workload2.ticketBreakdown.fresh;
    if (freshDiff !== 0) {
      return freshDiff;
    }
    
    // Finally, compare raw count
    return workload1.rawTicketCount - workload2.rawTicketCount;
  }

  /**
   * Get workload penalty for scoring
   * Higher penalty for agents with more weighted tickets
   * This is used to reduce their assignment score
   */
  getWorkloadPenalty(workload: AgentWorkload): number {
    // Scale from 0 to 0.5 based on workload score
    // At full workload (1.0), agent gets 0.5 penalty (50% reduction in score)
    return workload.workloadScore * 0.5;
  }

  /**
   * Log workload summary for debugging
   */
  logWorkloadSummary(agentName: string, workload: AgentWorkload): void {
    this.logger.log(
      `📊 ${agentName}: ` +
      `${workload.rawTicketCount} tickets → ${workload.weightedTicketCount} weighted | ` +
      `Fresh: ${workload.ticketBreakdown.fresh}, ` +
      `Recent: ${workload.ticketBreakdown.recent}, ` +
      `Stale: ${workload.ticketBreakdown.stale}, ` +
      `Abandoned: ${workload.ticketBreakdown.abandoned} | ` +
      `Load: ${(workload.workloadScore * 100).toFixed(0)}%`
    );
  }
}