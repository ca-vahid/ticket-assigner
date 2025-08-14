import { Agent } from '../database/entities/agent.entity';

export interface EligibilityContext {
  ticketId?: string;
  categoryId?: string;
  requiredSkills?: string[];
  minLevel?: string;
  requiresOnsite: boolean;
  location?: string; // Legacy field
  locationId?: string; // New location entity ID
  allowCrossLocation?: boolean;
  allowRemoteAgents?: boolean;
  preferredTimezone?: string;
  isUrgent?: boolean;
  checkPTO: boolean;
  ptoAgentIds?: string[];
  preferredTimezones?: string[];
  maxLoadPercentage?: number;
  minExperience?: number;
  minSatisfactionScore?: number;
  requireSpecialization?: boolean;
  maxTimezoneHoursDifference?: number;
  isTestScenario?: boolean; // Flag for test scenarios to bypass strict filters
}

export interface EligibilityResult {
  eligibleAgents: Agent[];
  totalAgents?: number;
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
    checkPTO?: boolean;
    maxLoadPercentage?: number;
    minLevel?: string;
    requiresOnsite?: boolean;
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