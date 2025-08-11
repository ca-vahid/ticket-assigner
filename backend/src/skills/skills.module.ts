import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SkillDetectionService } from './skill-detection.service';
import { SkillDetectionController } from './skill-detection.controller';
import { SkillDetectionScheduler } from './skill-detection.scheduler';
import { Agent } from '../database/entities/agent.entity';
import { DetectedSkill } from '../database/entities/detected-skill.entity';
import { SkillDetectionConfig } from '../database/entities/skill-detection-config.entity';
import { SkillAuditLog } from '../database/entities/skill-audit-log.entity';
import { FreshserviceModule } from '../integrations/freshservice/freshservice.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      DetectedSkill,
      SkillDetectionConfig,
      SkillAuditLog
    ]),
    FreshserviceModule
  ],
  providers: [
    SkillDetectionService,
    SkillDetectionScheduler
  ],
  controllers: [
    SkillDetectionController
  ],
  exports: [
    SkillDetectionService
  ]
})
export class SkillsModule {}