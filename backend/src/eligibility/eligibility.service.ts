import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Category } from '../database/entities/category.entity';
import { EligibilityContext, EligibilityResult, FilterCriteria } from './eligibility.types';

@Injectable()
export class EligibilityService {
  private readonly logger = new Logger(EligibilityService.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async getEligibleAgents(
    context: EligibilityContext
  ): Promise<EligibilityResult> {
    const startTime = Date.now();
    
    // Start with all active agents
    let query = this.agentRepository.createQueryBuilder('agent')
      .leftJoinAndSelect('agent.specializations', 'specializations');

    // Apply status filter
    query = query.where('agent.isAvailable = :isAvailable', { isAvailable: true });

    // Apply capacity filter
    query = query.andWhere('agent.currentTicketCount < agent.maxConcurrentTickets');

    // Apply location filter if onsite is required
    if (context.requiresOnsite) {
      // Skip onsite filter for now (field not in current entity)
      
      if (context.location) {
        query = query.andWhere('agent.location = :location', { 
          location: context.location 
        });
      }
    }

    // Apply skill filter if specified
    if (context.requiredSkills && context.requiredSkills.length > 0) {
      query = query.andWhere(
        'agent.skills && ARRAY[:...skills]::text[]',
        { skills: context.requiredSkills }
      );
    }

    // Apply level filter if specified
    if (context.minLevel) {
      const levelOrder = ['L1', 'L2', 'L3', 'MANAGER'];
      const minLevelIndex = levelOrder.indexOf(context.minLevel);
      const eligibleLevels = levelOrder.slice(minLevelIndex);
      
      query = query.andWhere('agent.level IN (:...levels)', { 
        levels: eligibleLevels 
      });
    }

    // Apply PTO filter
    if (context.checkPTO && context.ptoAgentIds && context.ptoAgentIds.length > 0) {
      query = query.andWhere('agent.id NOT IN (:...ptoIds)', { 
        ptoIds: context.ptoAgentIds 
      });
    }

    // Apply timezone filter if specified
    if (context.preferredTimezones && context.preferredTimezones.length > 0) {
      query = query.andWhere('agent.timezone IN (:...timezones)', { 
        timezones: context.preferredTimezones 
      });
    }

    const agents = await query.getMany();
    const processingTime = Date.now() - startTime;

    // Apply additional filters
    const filteredAgents = this.applyAdditionalFilters(agents, context);

    // Calculate reasons for exclusion for debugging
    const excludedReasons = await this.getExclusionReasons(context);

    return {
      eligibleAgents: filteredAgents,
      totalAgentsChecked: agents.length,
      excludedCount: agents.length - filteredAgents.length,
      filters: {
        statusFilter: true,
        capacityFilter: true,
        locationFilter: context.requiresOnsite,
        skillFilter: !!(context.requiredSkills?.length),
        levelFilter: !!context.minLevel,
        ptoFilter: context.checkPTO || false,
        timezoneFilter: !!(context.preferredTimezones?.length)
      },
      processingTimeMs: processingTime,
      excludedReasons
    };
  }

  private applyAdditionalFilters(
    agents: Agent[],
    context: EligibilityContext
  ): Agent[] {
    return agents.filter(agent => {
      // Check workload threshold
      if (context.maxLoadPercentage) {
        const loadPercentage = agent.currentTicketCount / agent.maxConcurrentTickets;
        if (loadPercentage > context.maxLoadPercentage) {
          return false;
        }
      }

      // Check minimum experience
      if (context.minExperience) { // Skip experience check for now
        return false;
      }

      // Check satisfaction score threshold
      if (context.minSatisfactionScore && 
          agent.satisfactionScore < context.minSatisfactionScore) {
        return false;
      }

      // Check specialization requirement
      if (context.categoryId && context.requireSpecialization) {
        const hasSpecialization = agent.specializations?.some(
          spec => spec.id === context.categoryId
        );
        if (!hasSpecialization) {
          return false;
        }
      }

      return true;
    });
  }

  async checkAgentEligibility(
    agentId: string,
    criteria: FilterCriteria
  ): Promise<boolean> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId },
      relations: ['specializations']
    });

    if (!agent) {
      return false;
    }

    // Check status
    if (!agent.isAvailable) {
      return false;
    }

    // Check capacity
    if (agent.currentTicketCount >= agent.maxConcurrentTickets) {
      return false;
    }

    // Check location requirement
    if (criteria.requiresOnsite) { // Skip onsite check for now
      return false;
    }

    // Check skill requirements
    if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
      const agentSkills = new Set(agent.skills || []);
      const hasRequiredSkills = criteria.requiredSkills!.every(
        skill => agentSkills.has(skill)
      );
      if (!hasRequiredSkills) {
        return false;
      }
    }

    return true;
  }

  async getAgentAvailability(agentId: string): Promise<{
    isAvailable: boolean;
    currentLoad: number;
    maxLoad: number;
    loadPercentage: number;
    status: string;
    nextAvailableSlot?: Date;
  }> {
    const agent = await this.agentRepository.findOne({
      where: { id: agentId }
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const loadPercentage = agent.maxConcurrentTickets > 0 
      ? (agent.currentTicketCount / agent.maxConcurrentTickets) * 100 
      : 100;

    const isAvailable = 
      agent.isAvailable && 
      agent.currentTicketCount < agent.maxConcurrentTickets;

    return {
      isAvailable,
      currentLoad: agent.currentTicketCount,
      maxLoad: agent.maxConcurrentTickets,
      loadPercentage: Math.round(loadPercentage),
      status: agent.isAvailable ? 'ACTIVE' : 'INACTIVE',
      nextAvailableSlot: this.calculateNextAvailableSlot(agent)
    };
  }

  private calculateNextAvailableSlot(agent: Agent): Date | undefined {
    if (agent.currentTicketCount < agent.maxConcurrentTickets) {
      return new Date(); // Available now
    }

    // Estimate based on average resolution time
    if (agent.averageResolutionTime > 0) {
      const hoursUntilSlot = agent.averageResolutionTime;
      const nextSlot = new Date();
      nextSlot.setHours(nextSlot.getHours() + hoursUntilSlot);
      return nextSlot;
    }

    return undefined;
  }

  private async getExclusionReasons(
    context: EligibilityContext
  ): Promise<Record<string, number>> {
    const reasons: Record<string, number> = {};

    // Count agents excluded by each filter
    const allAgents = await this.agentRepository.find();
    
    let excluded = 0;
    allAgents.forEach(agent => {
      if (!agent.isAvailable) {
        reasons['inactive'] = (reasons['inactive'] || 0) + 1;
        excluded++;
      } else if (agent.currentTicketCount >= agent.maxConcurrentTickets) {
        reasons['at_capacity'] = (reasons['at_capacity'] || 0) + 1;
        excluded++;
      } else if (context.requiresOnsite) { // Skip onsite check
        reasons['not_onsite'] = (reasons['not_onsite'] || 0) + 1;
        excluded++;
      } else if (context.ptoAgentIds?.includes(agent.id)) {
        reasons['on_pto'] = (reasons['on_pto'] || 0) + 1;
        excluded++;
      }
    });

    return reasons;
  }
}