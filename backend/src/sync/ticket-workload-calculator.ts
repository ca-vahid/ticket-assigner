import { Injectable, Logger } from '@nestjs/common';

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
   * Calculate the weight of a ticket based on its age
   * Fresh tickets (today) have the highest weight
   * Older tickets have progressively lower weight
   * 
   * Scoring strategy:
   * - 0 business days (today): 2.0 weight (double count - prevents gaming)
   * - 1 business day: 1.5 weight
   * - 2 business days: 1.2 weight
   * - 3-5 business days: 1.0 weight (normal)
   * - 6-10 business days: 0.7 weight (stale)
   * - 11-14 business days: 0.3 weight (very stale)
   * - 15+ business days: 0.1 weight (abandoned)
   */
  calculateTicketWeight(ticketCreatedDate: Date, now: Date = new Date()): TicketWorkload {
    const ageInDays = Math.floor((now.getTime() - ticketCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
    const ageInBusinessDays = this.calculateBusinessDays(ticketCreatedDate, now);
    
    let weight: number;
    let category: 'fresh' | 'recent' | 'stale' | 'abandoned';
    
    if (ageInBusinessDays === 0) {
      // Today's ticket - highest weight to prevent gaming
      weight = 2.0;
      category = 'fresh';
    } else if (ageInBusinessDays === 1) {
      // Yesterday's ticket
      weight = 1.5;
      category = 'fresh';
    } else if (ageInBusinessDays === 2) {
      // 2 business days old
      weight = 1.2;
      category = 'recent';
    } else if (ageInBusinessDays <= 5) {
      // 3-5 business days - normal weight
      weight = 1.0;
      category = 'recent';
    } else if (ageInBusinessDays <= 10) {
      // 6-10 business days - getting stale
      weight = 0.7;
      category = 'stale';
    } else if (ageInBusinessDays <= 14) {
      // 11-14 business days - very stale
      weight = 0.3;
      category = 'stale';
    } else {
      // 15+ business days - abandoned
      weight = 0.1;
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
  calculateAgentWorkload(
    agentId: string,
    tickets: Array<{ id: string; created_at: Date | string; status: number }>
  ): AgentWorkload {
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
      
      const workload = this.calculateTicketWeight(createdDate, now);
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