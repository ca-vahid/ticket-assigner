import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhooksService } from './webhooks.service';

@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('freshservice/ticket')
  @HttpCode(200)
  async handleFreshserviceWebhook(
    @Body() body: any,
    @Headers('x-freshservice-signature') signature: string,
  ) {
    this.logger.log('📨 Received Freshservice webhook');
    
    // Verify webhook signature
    const webhookSecret = process.env.FRESHSERVICE_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const expectedSignature = createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        this.logger.warn('⚠️  Invalid webhook signature');
        return { status: 'invalid_signature' };
      }
      this.logger.log('✅ Webhook signature verified');
    }

    // Log the webhook payload
    this.logger.log('Webhook payload:', JSON.stringify(body, null, 2));

    // Process the webhook
    const result = await this.webhooksService.processTicketWebhook(body);
    
    return result;
  }

  @Post('test')
  @HttpCode(200)
  async testWebhook(@Body() body: any) {
    this.logger.log('🧪 Test webhook received:', body);
    return { 
      status: 'success', 
      message: 'Test webhook received',
      timestamp: new Date().toISOString(),
      received: body 
    };
  }
}