import { 
  Controller, 
  Post, 
  Body, 
  Headers, 
  HttpException, 
  HttpStatus,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FreshserviceService } from './freshservice.service';
import { AssignmentService } from '../../assignment/assignment.service';
import { Category } from '../../database/entities/category.entity';

@ApiTags('freshservice')
@Controller('api/webhooks/freshservice')
export class FreshserviceController {
  private readonly logger = new Logger(FreshserviceController.name);

  constructor(
    private readonly freshserviceService: FreshserviceService,
    private readonly assignmentService: AssignmentService,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  @Post('ticket')
  @ApiOperation({ summary: 'Handle Freshservice ticket webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleTicketWebhook(
    @Body() payload: any,
    @Headers('x-webhook-secret') webhookSecret: string
  ): Promise<any> {
    // Log the received webhook
    this.logger.log('📨 Received Freshservice webhook');
    
    // Validate webhook secret (simple shared secret approach)
    const expectedSecret = process.env.FRESHSERVICE_WEBHOOK_SECRET;
    if (expectedSecret && expectedSecret !== 'your-webhook-secret-here') {
      // Check if secret is in header or body
      const providedSecret = webhookSecret || payload.webhook_secret;
      
      if (providedSecret !== expectedSecret) {
        this.logger.warn('⚠️  Invalid webhook secret');
        throw new HttpException(
          'Invalid webhook secret',
          HttpStatus.UNAUTHORIZED
        );
      }
      this.logger.log('✅ Webhook secret verified');
    }
    
    this.logger.log('Payload:', JSON.stringify(payload, null, 2));

    // Parse webhook payload
    let webhookData;
    try {
      webhookData = this.freshserviceService.parseWebhookPayload(payload);
      this.logger.log(`Received webhook event: ${webhookData.event} for ticket ${webhookData.ticketId}`);
    } catch (error) {
      this.logger.error('Failed to parse webhook payload:', error);
      return {
        success: false,
        message: 'Failed to parse webhook payload'
      };
    }

    // Extract category from custom_fields
    const customFields = webhookData.ticket?.custom_fields || {};
    const categoryId = customFields.security; // The "security" field contains our category ID
    
    let category = null;
    if (categoryId) {
      // Find the category in our database
      category = await this.categoryRepository.findOne({
        where: { freshserviceId: categoryId.toString() }
      });
      this.logger.log(`Found category: ${category?.name || 'Unknown'} for ticket ${webhookData.ticketId}`);
    }

    // Handle different event types
    this.logger.log(`🎬 Processing event: ${webhookData.event}`);
    switch (webhookData.event) {
      case 'ticket_created':
        // Trigger assignment process for new tickets
        this.logger.log(`🆕 New ticket created: ${webhookData.ticketId}`);
        
        try {
          const assignmentResult = await this.assignmentService.assignTicket({
            ticketId: webhookData.ticketId || '',
            categoryId: category?.id,
            location: (webhookData.ticket as any)?.location_name,
            requireSpecialization: !!category,
            suggestOnly: false, // Auto-assign if enabled
            ticketData: webhookData.ticket // Pass ticket data directly
          });
          
          this.logger.log(`Assignment result: ${assignmentResult.success ? 'Success' : 'Failed'} - ${assignmentResult.message || ''}`);
          
          return {
            success: assignmentResult.success,
            message: assignmentResult.message || 'Ticket assignment processed',
            result: assignmentResult
          };
        } catch (error) {
          this.logger.error('Failed to assign ticket:', error);
          return {
            success: false,
            message: 'Failed to assign ticket'
          };
        }
        
      case 'ticket_updated':
        // Check if ticket needs reassignment
        if (webhookData.changes?.responder_id === null) {
          this.logger.log(`Ticket unassigned: ${webhookData.ticketId}`);
          
          // Trigger reassignment
          try {
            const assignmentResult = await this.assignmentService.assignTicket({
              ticketId: webhookData.ticketId || '',
              categoryId: category?.id,
              location: (webhookData.ticket as any)?.location_name,
              requireSpecialization: !!category,
              suggestOnly: false,
              ticketData: webhookData.ticket // Pass ticket data directly
            });
            
            return {
              success: true,
              message: 'Ticket reassignment processed',
              result: assignmentResult
            };
          } catch (error) {
            this.logger.error('Failed to reassign ticket:', error);
            return {
              success: false,
              message: 'Failed to reassign ticket'
            };
          }
        }
        break;
        
      case 'ticket_escalated':
        // Handle escalated tickets
        this.logger.log(`Ticket escalated: ${webhookData.ticketId}`);
        // Could implement special logic for escalated tickets
        break;
        
      default:
        this.logger.log(`Unhandled event type: ${webhookData.event}`);
    }

    return {
      success: true,
      message: `Webhook processed for event: ${webhookData.event}`
    };
  }
}