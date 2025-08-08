import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { Settings } from '../database/entities/settings.entity';
import { Agent } from '../database/entities/agent.entity';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settings, Agent]),
    SyncModule  // Import to get TicketWorkloadCalculator
  ],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService]
})
export class ScoringModule {}