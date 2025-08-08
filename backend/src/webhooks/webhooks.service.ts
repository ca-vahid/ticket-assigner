import { Injectable, Logger } from '@nestjs/common';
import { AssignmentService } from '../assignment/assignment.service';
import { DecisionsService } from '../decisions/decisions.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly decisionsService: DecisionsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async processTicketWebhook(webhookData: any) {
    const { event_type, ticket } = webhookData;
    
    if (!ticket) {
      this.logger.warn('No ticket data in webhook');
      return { success: false, message: 'No ticket data' };
    }

    this.logger.log(`Processing ${event_type} for ticket #${ticket.id}`);

    // Only process new tickets or tickets that need assignment
    if (event_type !== 'ticket_created' && event_type !== 'ticket_updated') {
      return { success: false, message: 'Event type not handled' };
    }

    // Extract category from custom field
    const categoryId = ticket.custom_fields?.security;
    if (!categoryId) {
      this.logger.warn(`No category ID found for ticket #${ticket.id}`);
      return { success: false, message: 'No category specified' };
    }

    // Find the category to get required skills
    const category = await this.categoriesService.findByCategoryId(categoryId);
    if (!category) {
      this.logger.warn(`Category ${categoryId} not found in database`);
      return { success: false, message: 'Category not found' };
    }

    // Prepare ticket data for assignment
    const ticketData = {
      id: ticket.id.toString(),
      displayId: ticket.display_id || `INC-${ticket.id}`,
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      categoryId: category.id, // Use internal category ID
      categoryName: category.name,
      requiredSkills: category.requiredSkills || [],
      requester: {
        id: ticket.requester?.id,
        name: ticket.requester?.name,
        email: ticket.requester?.email,
      },
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };

    try {
      // Trigger assignment
      const result = await this.assignmentService.assignTicket(ticketData);
      
      if (result.success) {
        this.logger.log(`✅ Ticket #${ticket.id} assigned to ${result.assignedAgent?.name}`);
        
        // Create decision record
        await this.decisionsService.create({
          ticketId: ticketData.id,
          ticketSubject: ticketData.subject,
          agentId: result.assignedAgent?.id,
          type: result.confidence >= 0.7 ? 'AUTO_ASSIGNED' : 'SUGGESTED',
          score: result.confidence,
          scoreBreakdown: result.scoreBreakdown,
          alternatives: result.alternatives,
          contextData: {
            categoryId: categoryId,
            categoryName: category.name,
            requiredSkills: category.requiredSkills,
            eventType: event_type,
          },
        });

        return {
          success: true,
          result: result,
          message: `Ticket assigned to ${result.assignedAgent?.name}`,
        };
      } else {
        this.logger.warn(`Failed to assign ticket #${ticket.id}: ${result.message}`);
        return result;
      }
    } catch (error) {
      this.logger.error(`Error processing ticket #${ticket.id}:`, error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }
}