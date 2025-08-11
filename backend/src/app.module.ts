import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { AssignmentModule } from './assignment/assignment.module';
import { EligibilityModule } from './eligibility/eligibility.module';
import { ScoringModule } from './scoring/scoring.module';
import { FreshserviceModule } from './integrations/freshservice/freshservice.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SyncModule } from './sync/sync.module';
import { AgentsModule } from './agents/agents.module';
import { CategoriesModule } from './categories/categories.module';
import { DecisionsModule } from './decisions/decisions.module';
import { SettingsModule } from './settings/settings.module';
import { SkillsModule } from './skills/skills.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 3600,
    }),
    ScheduleModule.forRoot(),
    AssignmentModule,
    EligibilityModule,
    ScoringModule,
    FreshserviceModule,
    WebhooksModule,
    SyncModule,
    AgentsModule,
    CategoriesModule,
    DecisionsModule,
    SettingsModule,
    SkillsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}