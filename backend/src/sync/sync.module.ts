import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Agent } from '../database/entities/agent.entity';
import { Category } from '../database/entities/category.entity';
import { Location } from '../database/entities/location.entity';
import { Settings } from '../database/entities/settings.entity';
import { AgentLeave } from '../database/entities/agent-leave.entity';
import { FreshserviceModule } from '../integrations/freshservice/freshservice.module';
import { VacationTrackerService } from '../integrations/vacation-tracker/vacation-tracker.service';
import { SyncAgentsCommand } from './sync-agents.command';
import { SyncCategoriesCommand } from './sync-categories.command';
import { SyncTicketCountsCommand } from './sync-ticket-counts.command';
import { TicketWorkloadCalculator } from './ticket-workload-calculator';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SyncProgressService } from './sync-progress.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Category, Location, Settings, AgentLeave]),
    FreshserviceModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [SyncController],
  providers: [
    SyncAgentsCommand, 
    SyncCategoriesCommand, 
    SyncTicketCountsCommand, 
    TicketWorkloadCalculator,
    SyncService,
    SyncProgressService,
    VacationTrackerService
  ],
  exports: [SyncService, TicketWorkloadCalculator, SyncProgressService, VacationTrackerService],
})
export class SyncModule {}