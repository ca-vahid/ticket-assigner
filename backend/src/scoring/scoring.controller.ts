import { Controller, Post, Body, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import type { ScoringWeights } from './scoring.types';

@ApiTags('scoring')
@Controller('api/scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

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
}