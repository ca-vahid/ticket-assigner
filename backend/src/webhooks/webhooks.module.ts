import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { AssignmentModule } from '../assignment/assignment.module';
import { DecisionsModule } from '../decisions/decisions.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [AssignmentModule, DecisionsModule, CategoriesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}