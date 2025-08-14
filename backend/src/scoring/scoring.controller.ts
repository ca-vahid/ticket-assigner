import { Controller, Post, Body, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import type { ScoringWeights } from './scoring.types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../database/entities/settings.entity';

@ApiTags('scoring')
@Controller('api/scoring')
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
  ) {}

  @Get('weights')
  @ApiOperation({ summary: 'Get current scoring weights' })
  @ApiResponse({ status: 200, description: 'Current scoring weights' })
  async getWeights(): Promise<any> {
    await this.scoringService.loadWeights();
    return this.scoringService['weights'];
  }

  @Put('weights')
  @ApiOperation({ summary: 'Update scoring weights' })
  @ApiResponse({ status: 200, description: 'Weights updated successfully' })
  async updateWeights(
    @Body() weights: Partial<ScoringWeights>
  ): Promise<{ success: boolean }> {
    await this.scoringService.updateWeights(weights);
    return { success: true };
  }

  @Get('ticket-age-weights')
  @ApiOperation({ summary: 'Get current ticket age weights' })
  @ApiResponse({ status: 200, description: 'Current ticket age weights' })
  async getTicketAgeWeights(): Promise<any> {
    const setting = await this.settingsRepository.findOne({
      where: { key: 'scoring.ticketAgeWeights' }
    });
    
    if (!setting) {
      // Return default weights
      return {
        fresh: 2.0,
        recent: 1.2,
        stale: 0.5,
        old: 0.1
      };
    }
    
    return setting.value;
  }

  @Put('ticket-age-weights')
  @ApiOperation({ summary: 'Update ticket age weights' })
  @ApiResponse({ status: 200, description: 'Ticket age weights updated successfully' })
  async updateTicketAgeWeights(
    @Body() weights: { fresh: number; recent: number; stale: number; old: number }
  ): Promise<{ success: boolean }> {
    let setting = await this.settingsRepository.findOne({
      where: { key: 'scoring.ticketAgeWeights' }
    });
    
    if (!setting) {
      setting = this.settingsRepository.create({
        key: 'scoring.ticketAgeWeights',
        value: weights,
        description: 'Ticket age weight multipliers for workload calculation',
        category: 'scoring'
      });
    } else {
      setting.value = weights;
    }
    
    await this.settingsRepository.save(setting);
    return { success: true };
  }
}