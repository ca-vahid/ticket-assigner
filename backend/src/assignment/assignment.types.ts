export interface AssignmentRequest {
  ticketId: string;
  categoryId?: string;
  location?: string;
  ptoAgentIds?: string[];
  requireSpecialization?: boolean;
  suggestOnly?: boolean;
  overrideAutoAssign?: boolean;
  ticketData?: any; // Optional ticket data to avoid fetching from Freshservice
}

export interface AssignmentResult {
  success: boolean;
  mode: AssignmentMode;
  ticketId: string;
  assignedAgent?: {
    id: string;
    name: string;
    email: string;
  };
  suggestions: any[];
  confidence?: number;
  decisionId?: string;
  message?: string;
  processingTimeMs: number;
  metadata?: Record<string, any>;
}

export enum AssignmentMode {
  AUTO_ASSIGNED = 'AUTO_ASSIGNED',
  SUGGESTED = 'SUGGESTED',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
  FAILED = 'FAILED'
}

export interface AssignmentFeedback {
  decisionId: string;
  score: number;
  comments?: string;
  wasAccepted: boolean;
  overriddenBy?: string;
  overrideReason?: string;
  selectedAgentId?: string;
}

export interface AssignmentStats {
  totalAssignments: number;
  autoAssignments: number;
  manualOverrides: number;
  averageScore: number;
  averageConfidence: number;
  successRate: number;
  averageProcessingTime: number;
}