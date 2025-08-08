import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { Agent } from '../database/entities/agent.entity';
import { Decision } from '../database/entities/decision.entity';
import { Category } from '../database/entities/category.entity';
import { Settings } from '../database/entities/settings.entity';
import { EligibilityModule } from '../eligibility/eligibility.module';
import { ScoringModule } from '../scoring/scoring.module';
import { FreshserviceModule } from '../integrations/freshservice/freshservice.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Decision, Category, Settings]),
    EligibilityModule,
    ScoringModule,
    FreshserviceModule
  ],
  controllers: [AssignmentController],
  providers: [AssignmentService],
  exports: [AssignmentService]
})
export class AssignmentModule {}