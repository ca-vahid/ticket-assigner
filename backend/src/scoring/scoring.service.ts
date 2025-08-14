import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent, AgentLevel } from '../database/entities/agent.entity';
import { Settings } from '../database/entities/settings.entity';
import { ScoringResult, ScoringWeights, TicketContext } from './scoring.types';
import { TicketWorkloadCalculator } from '../sync/ticket-workload-calculator';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private weights: ScoringWeights;

  constructor(
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
    private workloadCalculator: TicketWorkloadCalculator,
  ) {
    this.loadWeights();
  }

  async loadWeights(): Promise<void> {
    const weightsSetting = await this.settingsRepository.findOne({
      where: { key: 'scoring.weights' }
    });
    
    this.weights = weightsSetting?.value || {
      skillOverlap: 0.30,
      levelCloseness: 0.25,
      loadBalance: 0.25,
      locationFit: 0.10,
      vipAffinity: 0.10
    };
  }

  async scoreAgent(
    agent: Agent,
    ticket: TicketContext
  ): Promise<ScoringResult> {
    const skillScore = this.calculateSkillScore(agent, ticket);
    const levelScore = this.calculateLevelScore(agent, ticket);
    const loadScore = this.calculateLoadScore(agent);
    const locationScore = this.calculateLocationScore(agent, ticket);
    const vipScore = this.calculateVipScore(agent, ticket);

    const totalScore = 
      (skillScore * this.weights.skillOverlap) +
      (levelScore * this.weights.levelCloseness) +
      (loadScore * this.weights.loadBalance) +
      (locationScore * this.weights.locationFit) +
      (vipScore * this.weights.vipAffinity);

    return {
      agentId: agent.id,
      agentName: `${agent.firstName} ${agent.lastName}`,
      totalScore: Math.round(totalScore * 100) / 100,
      breakdown: {
        skillScore: Math.round(skillScore * 100) / 100,
        levelScore: Math.round(levelScore * 100) / 100,
        loadScore: Math.round(loadScore * 100) / 100,
        locationScore: Math.round(locationScore * 100) / 100,
        vipScore: Math.round(vipScore * 100) / 100
      },
      eligibility: {
        isAvailable: agent.isAvailable,
        hasCapacity: (agent.weightedTicketCount || agent.currentTicketCount) < agent.maxConcurrentTickets * 0.9,
        meetsLocation: !ticket.requiresOnsite || (agent.location !== null),
        meetsLevel: this.meetsLevelRequirement(agent.level, ticket.requiredLevel)
      }
    };
  }

  private calculateSkillScore(agent: Agent, ticket: TicketContext): number {
    if (!ticket.requiredSkills || ticket.requiredSkills.length === 0) {
      return 1.0;
    }

    const agentSkills = new Set(agent.skills || []);
    const matchedSkills = ticket.requiredSkills.filter(skill => 
      agentSkills.has(skill)
    );

    const overlap = matchedSkills.length / ticket.requiredSkills.length;
    
    // Bonus for having additional relevant skills
    const bonusSkills = agent.skills?.filter(skill => 
      ticket.relatedSkills?.includes(skill)
    ).length || 0;
    
    const bonus = Math.min(bonusSkills * 0.05, 0.2);
    
    return Math.min(overlap + bonus, 1.0);
  }

  private calculateLevelScore(agent: Agent, ticket: TicketContext): number {
    const levelMap: Record<AgentLevel, number> = {
      [AgentLevel.L1]: 1,
      [AgentLevel.L2]: 2,
      [AgentLevel.L3]: 3,
      [AgentLevel.MANAGER]: 4
    };

    const agentLevelNum = levelMap[agent.level];
    const requiredLevelNum = levelMap[ticket.requiredLevel as AgentLevel] || 2;
    
    const levelDiff = Math.abs(agentLevelNum - requiredLevelNum);
    
    // Perfect match = 1.0, each level difference reduces score
    if (levelDiff === 0) return 1.0;
    if (levelDiff === 1) return 0.8;
    if (levelDiff === 2) return 0.5;
    return 0.2;
  }

  private calculateLoadScore(agent: Agent): number {
    if (agent.maxConcurrentTickets === 0) return 0;
    
    // Use weighted ticket count to prevent gaming the system
    // Agents with fresh tickets (today) have higher effective load
    const weightedCount = agent.weightedTicketCount || agent.currentTicketCount;
    
    // Calculate load percentage using weighted count
    // We consider 80% of max as "full" when using weighted counts
    // because fresh tickets count for more
    const effectiveMax = agent.maxConcurrentTickets * 0.8;
    const loadPercentage = weightedCount / effectiveMax;
    
    // Inverse relationship - lower load = higher score
    // Adjusted thresholds for weighted scoring
    if (loadPercentage >= 1.2) return 0;    // Very overloaded
    if (loadPercentage >= 1.0) return 0.1;   // Overloaded
    if (loadPercentage >= 0.85) return 0.2;  // Nearly full
    if (loadPercentage >= 0.7) return 0.4;   // High load
    if (loadPercentage >= 0.5) return 0.6;   // Moderate load
    if (loadPercentage >= 0.3) return 0.8;   // Light load
    if (loadPercentage >= 0.15) return 0.9;  // Very light load
    return 1.0;  // Minimal or no load
  }

  private calculateLocationScore(agent: Agent, ticket: TicketContext): number {
    // If ticket doesn't require onsite and agent is remote, perfect match
    if (!ticket.requiresOnsite && agent.isRemote) {
      return 1.0;
    }

    // If ticket doesn't require onsite, location doesn't matter much
    if (!ticket.requiresOnsite) {
      return 0.9; // Slight preference for remote agents for remote tickets
    }

    // Ticket requires onsite support
    if (ticket.requiresOnsite) {
      // Agent must have a location for onsite work
      if (!agent.location) {
        return 0; // No location = can't do onsite
      }

      // Check if agent location supports onsite
      const supportsOnsite = agent.location.metadata?.supportTypes?.includes('onsite') ?? true;
      if (!supportsOnsite) {
        return 0.1; // Location doesn't support onsite
      }

      // Perfect match: same location
      if (ticket.locationId && agent.location.id === ticket.locationId) {
        return 1.0;
      }

      // Good match: same timezone (can potentially travel or provide urgent support)
      if (ticket.timezone && agent.location.timezone === ticket.timezone) {
        return 0.7;
      }

      // Calculate timezone difference for cross-timezone support
      if (ticket.timezone && agent.location.timezone) {
        const timezoneScore = this.calculateTimezoneScore(
          agent.location.timezone,
          ticket.timezone
        );
        return Math.max(0.2, timezoneScore * 0.5); // Min 0.2, max 0.5 for different locations
      }

      // Different location, no timezone info
      return 0.3;
    }

    // Default neutral score
    return 0.5;
  }

  private calculateTimezoneScore(agentTz: string, ticketTz: string): number {
    // Simple timezone scoring - in production, use proper timezone library
    // For now, return 1.0 for same timezone, 0.5 for different
    if (agentTz === ticketTz) return 1.0;
    
    // Common timezone groups (simplified)
    const timezoneGroups = {
      americas: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 
                 'America/Vancouver', 'America/Toronto', 'America/Montreal'],
      europe: ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome'],
      asia: ['Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Mumbai', 'Asia/Dubai'],
      pacific: ['Pacific/Auckland', 'Australia/Sydney', 'Australia/Melbourne']
    };

    // Check if in same region
    for (const [region, zones] of Object.entries(timezoneGroups)) {
      if (zones.includes(agentTz) && zones.includes(ticketTz)) {
        return 0.7; // Same region
      }
    }

    // Different regions
    return 0.3;
  }

  private calculateVipScore(agent: Agent, ticket: TicketContext): number {
    if (!ticket.isVip) {
      return 1.0; // Non-VIP tickets get neutral score
    }

    // For VIP tickets, prefer agents with:
    // 1. Higher satisfaction scores
    // 2. More experience (total assignments)
    // 3. Better resolution times

    let score = 0.5; // Base score

    if (agent.satisfactionScore >= 4.5) score += 0.2;
    else if (agent.satisfactionScore >= 4.0) score += 0.1;

    if (agent.totalAssignments >= 100) score += 0.2;
    else if (agent.totalAssignments >= 50) score += 0.1;

    if (agent.averageResolutionTime > 0 && 
        agent.averageResolutionTime <= 4) score += 0.1;

    return Math.min(score, 1.0);
  }

  private meetsLevelRequirement(
    agentLevel: AgentLevel,
    requiredLevel?: string
  ): boolean {
    if (!requiredLevel) return true;

    const levelOrder = [AgentLevel.L1, AgentLevel.L2, AgentLevel.L3, AgentLevel.MANAGER];
    const agentIndex = levelOrder.indexOf(agentLevel);
    const requiredIndex = levelOrder.indexOf(requiredLevel as AgentLevel);

    // Agent must be at or above required level
    return agentIndex >= requiredIndex;
  }

  async scoreMultipleAgents(
    agents: Agent[],
    ticket: TicketContext
  ): Promise<ScoringResult[]> {
    const scores = await Promise.all(
      agents.map(agent => this.scoreAgent(agent, ticket))
    );

    // Sort by total score descending
    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }

  async updateWeights(newWeights: Partial<ScoringWeights>): Promise<void> {
    this.weights = { ...this.weights, ...newWeights };
    
    const setting = await this.settingsRepository.findOne({
      where: { key: 'scoring.weights' }
    });
    
    if (setting) {
      setting.value = this.weights;
      await this.settingsRepository.save(setting);
    } else {
      await this.settingsRepository.save({
        key: 'scoring.weights',
        value: this.weights,
        category: 'scoring'
      });
    }
    
    this.logger.log('Scoring weights updated', this.weights);
  }
}