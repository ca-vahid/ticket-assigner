import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() settings: any) {
    return this.settingsService.updateSettings(settings);
  }

  @Get('auto-assign')
  async getAutoAssignStatus() {
    const settings = await this.settingsService.getSettings();
    return { enabled: settings?.autoAssignEnabled ?? true };
  }

  @Put('auto-assign')
  async updateAutoAssignStatus(@Body() body: { enabled: boolean }) {
    return this.settingsService.updateAutoAssignStatus(body.enabled);
  }
}