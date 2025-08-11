import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillDetectionService } from './skill-detection.service';
import { SkillDetectionConfig } from '../database/entities/skill-detection-config.entity';

@Injectable()
export class SkillDetectionScheduler {
  private readonly logger = new Logger(SkillDetectionScheduler.name);
  private isRunning = false;

  constructor(
    private skillDetectionService: SkillDetectionService,
    @InjectRepository(SkillDetectionConfig)
    private configRepository: Repository<SkillDetectionConfig>,
  ) {}

  /**
   * Run skill detection daily at 2 AM
   */
  @Cron('0 2 * * *')
  async runDailySkillDetection() {
    await this.runScheduledDetection('daily');
  }

  /**
   * Run skill detection weekly on Sunday at 3 AM
   */
  @Cron('0 3 * * 0')
  async runWeeklySkillDetection() {
    await this.runScheduledDetection('weekly');
  }

  /**
   * Check if scheduled detection should run
   */
  private async runScheduledDetection(schedule: 'daily' | 'weekly') {
    if (this.isRunning) {
      this.logger.warn(`Skill detection already running, skipping ${schedule} run`);
      return;
    }

    try {
      // Check if any detection method is enabled for this schedule
      const configs = await this.configRepository.find({ where: { enabled: true } });
      
      if (configs.length === 0) {
        this.logger.debug(`No detection methods enabled, skipping ${schedule} run`);
        return;
      }

      // Check if we should run based on schedule settings
      const shouldRun = await this.shouldRunSchedule(schedule, configs);
      
      if (!shouldRun) {
        this.logger.debug(`Skipping ${schedule} skill detection run`);
        return;
      }

      this.isRunning = true;
      this.logger.log(`⏰ Starting scheduled ${schedule} skill detection`);

      const result = await this.skillDetectionService.runSkillDetection();

      if (result.success) {
        this.logger.log(
          `✅ Scheduled skill detection complete: ${result.agentsProcessed} agents, ${result.skillsDetected} skills detected`
        );
      } else {
        this.logger.error(`Scheduled skill detection failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Error in scheduled skill detection:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if schedule should run based on configuration
   */
  private async shouldRunSchedule(
    schedule: 'daily' | 'weekly',
    configs: SkillDetectionConfig[]
  ): Promise<boolean> {
    // Check if enough time has passed since last run
    for (const config of configs) {
      const scheduleSettings = config.settings?.schedule;
      
      if (!scheduleSettings) continue;
      
      // Check if this schedule type is enabled
      if (schedule === 'daily' && !scheduleSettings.dailyEnabled) continue;
      if (schedule === 'weekly' && !scheduleSettings.weeklyEnabled) continue;
      
      // Check last run time
      if (config.lastRunAt) {
        const hoursSinceLastRun = 
          (Date.now() - config.lastRunAt.getTime()) / (1000 * 60 * 60);
        
        // For daily, ensure at least 20 hours have passed
        if (schedule === 'daily' && hoursSinceLastRun < 20) {
          return false;
        }
        
        // For weekly, ensure at least 6 days have passed
        if (schedule === 'weekly' && hoursSinceLastRun < 144) {
          return false;
        }
      }
      
      return true;
    }
    
    return true;
  }

  /**
   * Get next scheduled run time
   */
  async getNextRunTime(): Promise<{
    daily?: Date;
    weekly?: Date;
  }> {
    const now = new Date();
    const nextDaily = new Date(now);
    const nextWeekly = new Date(now);
    
    // Calculate next daily run (2 AM)
    nextDaily.setDate(nextDaily.getDate() + 1);
    nextDaily.setHours(2, 0, 0, 0);
    
    // Calculate next weekly run (Sunday 3 AM)
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    nextWeekly.setDate(nextWeekly.getDate() + daysUntilSunday);
    nextWeekly.setHours(3, 0, 0, 0);
    
    return {
      daily: nextDaily,
      weekly: nextWeekly
    };
  }
}