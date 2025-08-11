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

  async getTickets(params?: {
    filter?: string;
    page?: number;
    per_page?: number;
    include?: string;
    status?: number | number[];
  }): Promise<FreshserviceTicket[]> {
    try {
      const tickets: FreshserviceTicket[] = [];
      let page = params?.page || 1;
      let hasMore = true;
      const perPage = params?.per_page || 100;

      // Build query params
      const queryParams: any = {
        per_page: perPage
      };

      // Add include parameter if specified
      if (params?.include) {
        queryParams.include = params.include;
      }

      // Add filter parameter
      if (params?.filter) {
        queryParams.filter = params.filter;
      }
      
      // Add status filter if specified
      if (params?.status) {
        if (Array.isArray(params.status)) {
          // For multiple statuses, we need to make separate requests
          // Freshservice doesn't support OR in filter parameter
        } else {
          queryParams.filter = params.filter || `status:${params.status}`;
        }
      }

      let retryCount = 0;
      const maxRetries = 3;
      
      while (hasMore && page <= 50) { // Fetch up to 5000 tickets (50 pages * 100 per page)
        try {
          // Log progress every 5 pages
          if (page % 5 === 0 || page === 1) {
            this.logger.log(`Fetching tickets page ${page}... (${tickets.length} tickets so far)`);
          }
          
          // Strategic pauses: Take breaks every 20 pages to reset rate limit window
          if (page === 21 || page === 41) {
            this.logger.log(`Taking a 8 second break at page ${page} to reset rate limits...`);
            await new Promise(resolve => setTimeout(resolve, 8000));
          }
          
          const response = await this.apiClient.get('/tickets', {
            params: { ...queryParams, page }
          });
          
          tickets.push(...(response.data.tickets || []));
          
          // Check if there are more pages
          hasMore = response.data.tickets?.length === perPage;
          
          // If specific page was requested, don't continue
          if (params?.page) {
            hasMore = false;
          }
          
          // Progressive delay with more aggressive slowdown
          if (hasMore && page > 1) {
            let delay;
            if (page > 40) {
              delay = 1000; // 1 second after page 40
            } else if (page > 30) {
              delay = 500; // 500ms for pages 31-40
            } else if (page > 20) {
              delay = 300; // 300ms for pages 21-30  
            } else {
              delay = 150; // 150ms for pages 2-20
            }
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // Reset retry count on success
          retryCount = 0;
          page++;
        } catch (pageError: any) {
          // Handle rate limiting specifically
          if (pageError.response?.status === 429) {
            retryCount++;
            if (retryCount > maxRetries) {
              this.logger.error(`Failed after ${maxRetries} retries at page ${page}. Returning partial results.`);
              break; // Exit with partial results instead of failing completely
            }
            
            // Exponential backoff: 5s, 10s, 20s
            const waitTime = Math.min(5000 * Math.pow(2, retryCount - 1), 20000);
            this.logger.warn(`Rate limited at page ${page}, waiting ${waitTime/1000}s... (retry ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Don't increment page, retry the same page
            continue;
          }
          // For other errors, throw
          throw pageError;
        }
      }
      
      // Log final count
      if (tickets.length > 0) {
        this.logger.log(`✅ Successfully fetched ${tickets.length} tickets across ${page - 1} pages`);
      }

      return tickets;
    } catch (error) {
      this.logger.error('Failed to fetch tickets from Freshservice', error);
      throw new HttpException(
        'Failed to fetch tickets from Freshservice',
        HttpStatus.SERVICE_UNAVAILABLE
      );
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

  /**
   * Get tickets assigned to a specific agent
   */
  async getAgentTickets(
    agentId: string,
    options?: {
      status?: number[];
      limit?: number;
      include?: string;
    }
  ): Promise<FreshserviceTicket[]> {
    try {
      const limit = options?.limit || 1000;
      const statusFilter = options?.status || [4, 5]; // Default to resolved and closed
      const include = options?.include || 'custom_fields,tags,stats';
      
      // Fetch tickets for each status (Freshservice doesn't support OR in filters well)
      const allTickets: FreshserviceTicket[] = [];
      
      for (const status of statusFilter) {
        const tickets = await this.getTickets({
          filter: `responder_id:${agentId} AND status:${status}`,
          per_page: 100,
          include
        });
        
        allTickets.push(...tickets);
        
        // Stop if we've reached the limit
        if (allTickets.length >= limit) {
          return allTickets.slice(0, limit);
        }
      }
      
      return allTickets;
    } catch (error) {
      this.logger.error(`Failed to fetch tickets for agent ${agentId}:`, error);
      return [];
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