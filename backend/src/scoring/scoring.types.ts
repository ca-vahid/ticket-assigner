export interface ScoringWeights {
  skillOverlap: number;
  levelCloseness: number;
  loadBalance: number;
  locationFit: number;
  vipAffinity: number;
}

export interface TicketContext {
  ticketId: string;
  subject: string;
  description?: string;
  categoryId?: string;
  requiredSkills: string[];
  relatedSkills?: string[];
  requiredLevel?: string;
  requiresOnsite: boolean;
  location?: string;
  isVip: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedHours?: number;
  requesterId?: string;
  requesterDepartment?: string;
}

export interface ScoringResult {
  agentId: string;
  agentName: string;
  totalScore: number;
  breakdown: {
    skillScore: number;
    levelScore: number;
    loadScore: number;
    locationScore: number;
    vipScore: number;
  };
  eligibility: {
    isAvailable: boolean;
    hasCapacity: boolean;
    meetsLocation: boolean;
    meetsLevel: boolean;
  };
}

export interface AssignmentRecommendation {
  recommendedAgent: ScoringResult;
  alternatives: ScoringResult[];
  confidence: number;
  reasoning: string[];
}