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