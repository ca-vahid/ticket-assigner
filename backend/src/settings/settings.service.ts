import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../database/entities/settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,
  ) {}

  async getSettings(): Promise<Settings> {
    // Get the first (and usually only) settings record
    let settings = await this.settingsRepository.findOne({ 
      where: {}, 
      order: { id: 'ASC' } 
    });
    
    // Create default settings if none exist
    if (!settings) {
      settings = await this.createDefaultSettings();
    }
    
    return settings;
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const settings = await this.getSettings();
    Object.assign(settings, updates);
    return this.settingsRepository.save(settings);
  }

  async updateAutoAssignStatus(enabled: boolean): Promise<Settings> {
    const settings = await this.getSettings();
    settings.autoAssignEnabled = enabled;
    return this.settingsRepository.save(settings);
  }

  async getEligibilityRules(): Promise<any[]> {
    // Get eligibility rules setting
    const setting = await this.settingsRepository.findOne({
      where: { key: 'eligibility.rules' }
    });

    if (!setting) {
      // Return default rules
      return this.getDefaultEligibilityRules();
    }

    return setting.value;
  }

  async updateEligibilityRules(rules: any[]): Promise<any> {
    let setting = await this.settingsRepository.findOne({
      where: { key: 'eligibility.rules' }
    });

    if (!setting) {
      // Create new setting
      setting = this.settingsRepository.create({
        key: 'eligibility.rules',
        value: rules,
        description: 'Eligibility rules configuration',
        category: 'eligibility'
      });
    } else {
      // Update existing setting
      setting.value = rules;
    }

    await this.settingsRepository.save(setting);
    return { success: true, rules };
  }

  private getDefaultEligibilityRules(): any[] {
    return [
      {
        id: 'availability_check',
        name: 'Availability Check',
        description: 'Only assign tickets to agents who are currently available',
        enabled: true,
        type: 'availability',
        config: {
          checkPTO: true,
          checkWorkingHours: true,
          respectTimezones: true
        }
      },
      {
        id: 'workload_limit',
        name: 'Workload Limit',
        description: 'Prevent assignment if agent has too many active tickets',
        enabled: true,
        type: 'workload',
        config: {
          maxTickets: 5,
          warningThreshold: 4
        }
      },
      {
        id: 'location_matching',
        name: 'Location Matching',
        description: 'Control how location affects agent eligibility and scoring',
        enabled: true,
        type: 'location',
        config: {
          mode: 'flexible',  // 'strict' | 'flexible' | 'disabled'
          strictMatching: false,  // Only exact location matches (when mode is 'strict')
          allowCrossLocation: true,  // Allow assignments across locations
          allowRemoteForOnsite: false,  // Allow remote agents for onsite tickets
          timezoneMatching: true,  // Consider timezone proximity in scoring
          preferredLocations: []
        }
      },
      {
        id: 'skill_requirement',
        name: 'Skill Requirement',
        description: 'Only assign to agents with required skills',
        enabled: true,
        type: 'skills',
        config: {
          minimumMatch: 80,
          requireAllSkills: false
        }
      },
      {
        id: 'business_hours',
        name: 'Business Hours',
        description: 'Only assign during business hours',
        enabled: true,
        type: 'time',
        config: {
          startHour: 8,
          endHour: 18,
          weekendsAllowed: false
        }
      }
    ];
  }

  private async createDefaultSettings(): Promise<Settings> {
    const defaultSettings = this.settingsRepository.create({
      minimumConfidenceScore: 0.7,
      autoAssignEnabled: true,
      maxConcurrentTickets: 10,
      skillWeight: 0.3,
      levelWeight: 0.25,
      loadWeight: 0.25,
      locationWeight: 0.1,
      vipWeight: 0.1,
    });
    
    return this.settingsRepository.save(defaultSettings);
  }
}