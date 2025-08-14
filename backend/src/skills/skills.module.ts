import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SkillDetectionService } from './skill-detection.service';
import { CategoryService } from './category.service';
import { SkillsController } from './skills.controller';
import { SkillDetectionScheduler } from './skill-detection.scheduler';
import { Agent } from '../database/entities/agent.entity';
import { DetectedSkill } from '../database/entities/detected-skill.entity';
import { SkillDetectionConfig } from '../database/entities/skill-detection-config.entity';
import { SkillAuditLog } from '../database/entities/skill-audit-log.entity';
import { Settings } from '../database/entities/settings.entity';
import { FreshserviceModule } from '../integrations/freshservice/freshservice.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent,
      DetectedSkill,
      SkillDetectionConfig,
      SkillAuditLog,
      Settings
    ]),
    FreshserviceModule,
    SyncModule
  ],
  providers: [
    SkillDetectionService,
    CategoryService,
    SkillDetectionScheduler
  ],
  controllers: [
    SkillsController
  ],
  exports: [
    SkillDetectionService
  ]
})
export class SkillsModule {}