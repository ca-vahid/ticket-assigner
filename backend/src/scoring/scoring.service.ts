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
    this.loadWorkloadLimit();
  }

  private workloadLimit: number = 5;

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

  async loadWorkloadLimit(): Promise<void> {
    // Get eligibility rules from settings
    const rulesSettings = await this.settingsRepository.findOne({
      where: { key: 'eligibility.rules' }
    });

    if (rulesSettings && rulesSettings.value) {
      const rules = rulesSettings.value;
      const workloadRule = rules.find((r: any) => r.id === 'workload_limit');
      if (workloadRule && workloadRule.config && workloadRule.config.maxTickets) {
        this.workloadLimit = workloadRule.config.maxTickets;
        this.logger.log(`Loaded workload limit: ${this.workloadLimit}`);
        return;
      }
    }

    // Default fallback
    this.workloadLimit = 5;
    this.logger.log(`Using default workload limit: ${this.workloadLimit}`);
  }

  async scoreAgent(
    agent: Agent,
    ticket: TicketContext
  ): Promise<ScoringResult> {
    const skillScore = this.calculateSkillScore(agent, ticket);
    const levelScore = this.calculateLevelScore(agent, ticket);
    const loadScore = this.calculateLoadScore(agent);
    const locationScore = await this.calculateLocationScore(agent, ticket);
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
        hasCapacity: (agent.weightedTicketCount || agent.currentTicketCount) < this.workloadLimit * 0.9,
        meetsLocation: !ticket.requiresOnsite || (agent.location !== null),
        meetsLevel: this.meetsLevelRequirement(agent.level, ticket.requiredLevel)
      }
    };
  }

  private calculateSkillScore(agent: Agent, ticket: TicketContext): number {
    if (!ticket.requiredSkills || ticket.requiredSkills.length === 0) {
      return 1.0;
    }

    // Combine ALL skill sources for comprehensive skill checking
    // Store as lowercase for case-insensitive comparison
    const allAgentSkillsLower = new Set<string>();
    const allAgentSkillsOriginal = new Set<string>();
    
    // Helper to add skills in both original and lowercase
    const addSkill = (skill: string) => {
      allAgentSkillsOriginal.add(skill);
      allAgentSkillsLower.add(skill.toLowerCase());
    };
    
    // Add main skills
    if (agent.skills) {
      agent.skills.forEach(skill => addSkill(skill));
    }
    
    // Add category skills
    if (agent.categorySkills) {
      agent.categorySkills.forEach(skill => addSkill(skill));
    }
    
    // Add auto-detected skills
    if (agent.autoDetectedSkills) {
      agent.autoDetectedSkills.forEach(skill => addSkill(skill));
    }
    
    // Add skills from metadata
    if (agent.skillMetadata) {
      if (agent.skillMetadata.manual) {
        agent.skillMetadata.manual.forEach(skill => addSkill(skill));
      }
      if (agent.skillMetadata.category) {
        agent.skillMetadata.category.forEach(item => addSkill(item.skill));
      }
      if (agent.skillMetadata.group) {
        agent.skillMetadata.group.forEach(skill => addSkill(skill));
      }
      if (agent.skillMetadata.pattern) {
        agent.skillMetadata.pattern.forEach(item => addSkill(item.skill));
      }
      if (agent.skillMetadata.llm) {
        agent.skillMetadata.llm.forEach(item => addSkill(item.skill));
      }
    }

    // Case-insensitive matching
    const matchedSkills = ticket.requiredSkills.filter(skill => 
      allAgentSkillsLower.has(skill.toLowerCase())
    );

    const overlap = matchedSkills.length / ticket.requiredSkills.length;
    
    // Bonus for having additional relevant skills (case-insensitive)
    const bonusSkills = ticket.relatedSkills ? 
      Array.from(allAgentSkillsOriginal).filter(skill => 
        ticket.relatedSkills!.some(related => 
          related.toLowerCase() === skill.toLowerCase()
        )
      ).length : 0;
    
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
    // Use the workload limit from settings for consistent scoring
    const maxTickets = this.workloadLimit;
    if (maxTickets === 0) return 0;
    
    // Use weighted ticket count to prevent gaming the system
    // Agents with fresh tickets (today) have higher effective load
    const weightedCount = Number(agent.weightedTicketCount || agent.currentTicketCount || 0);
    
    // Calculate load percentage using weighted count
    // No adjustment factor - use raw percentage for clearer calculation
    const loadPercentage = weightedCount / maxTickets;
    
    // Continuous inverse relationship - lower load = higher score
    // Linear scoring for smooth gradient
    if (loadPercentage >= 1.0) {
      return 0; // Overloaded
    }
    
    // Linear inverse scoring: score = 1 - loadPercentage
    // This gives a smooth gradient where every ticket matters
    const score = Math.max(0, 1 - loadPercentage);
    
    // Round to 2 decimal places for consistency
    return Math.round(score * 100) / 100;
  }

  private async calculateLocationScore(agent: Agent, ticket: TicketContext): Promise<number> {
    // Get location matching settings
    const locationSettings = await this.getLocationMatchingSettings();
    
    // If location matching is disabled, everyone gets the same score
    if (!locationSettings.enabled || locationSettings.config.mode === 'disabled') {
      return 1.0; // Location doesn't matter
    }
    
    // If no location requirement at all, everyone gets the same score
    if (!ticket.requiresOnsite && !ticket.locationId) {
      return 1.0; // No location preference, all agents equal
    }

    // If ticket doesn't require onsite but has a location preference
    if (!ticket.requiresOnsite && ticket.locationId) {
      // In strict mode, only same location gets full score
      if (locationSettings.config.mode === 'strict' || locationSettings.config.strictMatching) {
        if (agent.location && agent.location.id === ticket.locationId) {
          return 1.0;
        }
        return 0.5; // Different location penalty in strict mode
      }
      
      // In flexible mode, prefer same location but allow others
      if (agent.location && agent.location.id === ticket.locationId) {
        return 1.0;
      }
      return 0.9; // Different location but still eligible
    }

    // Ticket requires onsite support
    if (ticket.requiresOnsite) {
      // Agent must have a location for onsite work (unless remote is allowed)
      if (!agent.location) {
        if (locationSettings.config.allowRemoteForOnsite && agent.isRemote) {
          return 0.5; // Remote agent allowed but lower score
        }
        return 0; // No location = can't do onsite
      }

      // Check if agent location supports onsite
      const supportsOnsite = agent.location.metadata?.supportTypes?.includes('onsite') ?? true;
      if (!supportsOnsite && !locationSettings.config.allowRemoteForOnsite) {
        return 0.1; // Location doesn't support onsite
      }

      // Perfect match: same location
      if (ticket.locationId && agent.location.id === ticket.locationId) {
        return 1.0;
      }

      // If cross-location is not allowed in strict mode
      if (locationSettings.config.mode === 'strict' && !locationSettings.config.allowCrossLocation) {
        return 0.2; // Different location in strict mode
      }

      // Good match: same timezone (if timezone matching is enabled)
      if (locationSettings.config.timezoneMatching && ticket.timezone && agent.location.timezone === ticket.timezone) {
        return 0.7;
      }

      // Calculate timezone difference for cross-timezone support
      if (locationSettings.config.timezoneMatching && ticket.timezone && agent.location.timezone) {
        const timezoneScore = this.calculateTimezoneScore(
          agent.location.timezone,
          ticket.timezone
        );
        return Math.max(0.2, timezoneScore * 0.5); // Min 0.2, max 0.5 for different locations
      }

      // Different location, no timezone matching or info
      return 0.3;
    }

    // Default neutral score
    return 0.5;
  }

  private async getLocationMatchingSettings(): Promise<any> {
    // Get eligibility rules from settings
    const rulesSettings = await this.settingsRepository.findOne({
      where: { key: 'eligibility.rules' }
    });

    if (rulesSettings && rulesSettings.value) {
      const rules = rulesSettings.value;
      const locationRule = rules.find((r: any) => r.id === 'location_matching');
      if (locationRule) {
        return locationRule;
      }
    }

    // Default settings
    return {
      enabled: true,
      config: {
        mode: 'flexible',
        strictMatching: false,
        allowCrossLocation: true,
        allowRemoteForOnsite: false,
        timezoneMatching: true
      }
    };
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
    // Reload workload limit before scoring to ensure we have latest settings
    await this.loadWorkloadLimit();
    
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