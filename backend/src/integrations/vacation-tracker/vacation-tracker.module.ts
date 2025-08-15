import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { VacationTrackerService } from './vacation-tracker.service';
import { VacationTrackerController } from './vacation-tracker.controller';
import { Agent } from '../../database/entities/agent.entity';
import { AgentLeave } from '../../database/entities/agent-leave.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, AgentLeave]),
    ConfigModule,
  ],
  controllers: [VacationTrackerController],
  providers: [VacationTrackerService],
  exports: [VacationTrackerService],
})
export class VacationTrackerModule {}