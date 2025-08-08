import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Category } from '../database/entities/category.entity';
import { FreshserviceModule } from '../integrations/freshservice/freshservice.module';
import { SyncAgentsCommand } from './sync-agents.command';
import { SyncCategoriesCommand } from './sync-categories.command';
import { SyncTicketCountsCommand } from './sync-ticket-counts.command';
import { TicketWorkloadCalculator } from './ticket-workload-calculator';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Category]),
    FreshserviceModule,
  ],
  controllers: [SyncController],
  providers: [
    SyncAgentsCommand, 
    SyncCategoriesCommand, 
    SyncTicketCountsCommand, 
    TicketWorkloadCalculator,
    SyncService
  ],
  exports: [SyncService, TicketWorkloadCalculator],
})
export class SyncModule {}