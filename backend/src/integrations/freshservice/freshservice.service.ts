import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { 
  FreshserviceTicket, 
  FreshserviceAgent, 
  FreshserviceWebhookPayload,
  FreshserviceTicketUpdate,
  FreshserviceCategory
} from './freshservice.types';

@Injectable()
export class FreshserviceService {
  private readonly logger = new Logger(FreshserviceService.name);
  private readonly apiClient: AxiosInstance;
  private readonly domain: string;
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    this.domain = this.configService.get('FRESHSERVICE_DOMAIN', '');
    this.webhookSecret = this.configService.get('FRESHSERVICE_WEBHOOK_SECRET', '');
    
    const apiKey = this.configService.get('FRESHSERVICE_API_KEY', '');
    
    this.apiClient = axios.create({
      baseURL: `https://${this.domain}/api/v2`,
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiKey}:X`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  async getTicket(ticketId: string): Promise<FreshserviceTicket> {
    try {
      const response = await this.apiClient.get(`/tickets/${ticketId}`);
      return response.data.ticket;
    } catch (error) {
      this.logger.error(`Failed to fetch ticket ${ticketId}`, error);
      throw new HttpException(
        'Failed to fetch ticket from Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async updateTicket(
    ticketId: string, 
    update: FreshserviceTicketUpdate
  ): Promise<FreshserviceTicket> {
    try {
      const response = await this.apiClient.put(`/tickets/${ticketId}`, {
        ticket: update
      });
      return response.data.ticket;
    } catch (error) {
      this.logger.error(`Failed to update ticket ${ticketId}`, error);
      throw new HttpException(
        'Failed to update ticket in Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async assignTicket(
    ticketId: string,
    agentId: string,
    groupId?: string
  ): Promise<FreshserviceTicket> {
    const update: FreshserviceTicketUpdate = {
      responder_id: parseInt(agentId),
    };
    
    if (groupId) {
      update.group_id = parseInt(groupId);
    }

    return this.updateTicket(ticketId, update);
  }

  async addTicketNote(
    ticketId: string,
    noteContent: string,
    isPrivate: boolean = true
  ): Promise<void> {
    try {
      await this.apiClient.post(`/tickets/${ticketId}/notes`, {
        note: {
          body: noteContent,
          private: isPrivate
        }
      });
    } catch (error) {
      this.logger.error(`Failed to add note to ticket ${ticketId}`, error);
    }
  }

  async getAgent(agentId: string): Promise<FreshserviceAgent> {
    try {
      const response = await this.apiClient.get(`/agents/${agentId}`);
      return response.data.agent;
    } catch (error) {
      this.logger.error(`Failed to fetch agent ${agentId}`, error);
      throw new HttpException(
        'Failed to fetch agent from Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getAllAgents(): Promise<FreshserviceAgent[]> {
    try {
      const agents: FreshserviceAgent[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.apiClient.get('/agents', {
          params: { page, per_page: 100 }
        });
        
        agents.push(...response.data.agents);
        
        // Check if there are more pages
        hasMore = response.data.agents.length === 100;
        page++;
      }

      return agents;
    } catch (error) {
      this.logger.error('Failed to fetch agents from Freshservice', error);
      throw new HttpException(
        'Failed to fetch agents from Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getCategories(): Promise<FreshserviceCategory[]> {
    try {
      const response = await this.apiClient.get('/ticket_categories');
      return response.data.categories;
    } catch (error) {
      this.logger.error('Failed to fetch categories from Freshservice', error);
      throw new HttpException(
        'Failed to fetch categories from Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  validateWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping validation');
      return true;
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  parseWebhookPayload(payload: any): FreshserviceWebhookPayload {
    // Handle different payload formats
    const event = payload.event_type || payload.action || 'ticket_created';
    const ticket = payload.ticket || payload;
    const ticketId = ticket?.id?.toString() || ticket?.display_id?.toString();
    
    this.logger.log(`📨 Parsed webhook: event=${event}, ticketId=${ticketId}`);
    
    return {
      event: event,
      ticketId: ticketId,
      ticket: ticket,
      changes: payload.changes || {},
      timestamp: new Date(payload.timestamp || payload.created_at || Date.now())
    };
  }

  async createTicketAssignmentNote(
    ticketId: string,
    assignedAgent: string,
    alternatives: Array<{ name: string; score: number }>,
    reason: string
  ): Promise<void> {
    const noteContent = `
🤖 **Automated Assignment Recommendation**

**Recommended Agent:** ${assignedAgent}

**Reason:** ${reason}

**Alternative Options:**
${alternatives.map((alt, i) => `${i + 1}. ${alt.name} (Score: ${alt.score})`).join('\n')}

_This recommendation was generated by the Ticket Assignment System_
    `.trim();

    await this.addTicketNote(ticketId, noteContent, false);
  }

  async getTicketsByStatus(
    status: 'open' | 'pending' | 'resolved' | 'closed',
    limit: number = 100
  ): Promise<FreshserviceTicket[]> {
    try {
      const statusMap = {
        'open': 2,
        'pending': 3,
        'resolved': 4,
        'closed': 5
      };

      const response = await this.apiClient.get('/tickets', {
        params: {
          status: statusMap[status],
          per_page: limit
        }
      });

      return response.data.tickets;
    } catch (error) {
      this.logger.error(`Failed to fetch tickets by status ${status}`, error);
      throw new HttpException(
        'Failed to fetch tickets from Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getAgentWorkload(agentId: string): Promise<{
    openTickets: number;
    pendingTickets: number;
    totalActive: number;
  }> {
    try {
      const [openResponse, pendingResponse] = await Promise.all([
        this.apiClient.get('/tickets', {
          params: {
            responder_id: agentId,
            status: 2, // Open
            per_page: 1
          }
        }),
        this.apiClient.get('/tickets', {
          params: {
            responder_id: agentId,
            status: 3, // Pending
            per_page: 1
          }
        })
      ]);

      const openTickets = openResponse.headers['x-total-count'] || 0;
      const pendingTickets = pendingResponse.headers['x-total-count'] || 0;

      return {
        openTickets: parseInt(openTickets),
        pendingTickets: parseInt(pendingTickets),
        totalActive: parseInt(openTickets) + parseInt(pendingTickets)
      };
    } catch (error) {
      this.logger.error(`Failed to fetch workload for agent ${agentId}`, error);
      return {
        openTickets: 0,
        pendingTickets: 0,
        totalActive: 0
      };
    }
  }
}