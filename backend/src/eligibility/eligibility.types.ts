import { Agent } from '../database/entities/agent.entity';

export interface EligibilityContext {
  ticketId?: string;
  categoryId?: string;
  requiredSkills?: string[];
  minLevel?: string;
  requiresOnsite: boolean;
  location?: string;
  checkPTO: boolean;
  ptoAgentIds?: string[];
  preferredTimezones?: string[];
  maxLoadPercentage?: number;
  minExperience?: number;
  minSatisfactionScore?: number;
  requireSpecialization?: boolean;
}

export interface EligibilityResult {
  eligibleAgents: Agent[];
  totalAgentsChecked: number;
  excludedCount: number;
  filters: {
    statusFilter: boolean;
    capacityFilter: boolean;
    locationFilter: boolean;
    skillFilter: boolean;
    levelFilter: boolean;
    ptoFilter: boolean;
    timezoneFilter: boolean;
  };
  processingTimeMs: number;
  excludedReasons?: Record<string, number>;
}

export interface FilterCriteria {
  requiresOnsite?: boolean;
  requiredSkills?: string[];
  minLevel?: string;
  location?: string;
  maxLoadPercentage?: number;
}