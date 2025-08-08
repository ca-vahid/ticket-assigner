export interface FreshserviceTicket {
  id: number;
  subject: string;
  description: string;
  description_text?: string;
  status: number;
  priority: number;
  urgency: number;
  impact: number;
  category?: string;
  sub_category?: string;
  item_category?: string;
  department_id?: number;
  requester_id: number;
  responder_id?: number;
  group_id?: number;
  type: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
  due_by?: string;
  fr_due_by?: string;
  is_escalated: boolean;
  attachments?: any[];
}

export interface FreshserviceAgent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  active: boolean;
  job_title?: string;
  department_ids?: number[];
  reporting_manager_id?: number;
  time_zone?: string;
  location_id?: number;
  group_ids?: number[];
  role_ids?: number[];
  workspace_ids?: number[];
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FreshserviceCategory {
  id: number;
  name: string;
  description?: string;
  visible_to?: string;
  sub_categories?: Array<{
    id: number;
    name: string;
    description?: string;
  }>;
}

export interface FreshserviceWebhookPayload {
  event: string;
  ticketId?: string;
  ticket?: FreshserviceTicket;
  changes?: Record<string, any>;
  timestamp: Date;
}

export interface FreshserviceTicketUpdate {
  subject?: string;
  description?: string;
  status?: number;
  priority?: number;
  urgency?: number;
  impact?: number;
  category?: string;
  sub_category?: string;
  item_category?: string;
  responder_id?: number;
  group_id?: number;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export enum FreshserviceTicketStatus {
  Open = 2,
  Pending = 3,
  Resolved = 4,
  Closed = 5
}

export enum FreshserviceTicketPriority {
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4
}