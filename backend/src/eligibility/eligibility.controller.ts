import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EligibilityService } from './eligibility.service';
import type { EligibilityContext, EligibilityResult } from './eligibility.types';

@ApiTags('eligibility')
@Controller('api/eligibility')
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Post('check')
  @ApiOperation({ summary: 'Get eligible agents for a ticket' })
  @ApiResponse({ status: 200, description: 'List of eligible agents' })
  async getEligibleAgents(
    @Body() context: EligibilityContext
  ): Promise<EligibilityResult> {
    return this.eligibilityService.getEligibleAgents(context);
  }

  @Get('agent/:id/availability')
  @ApiOperation({ summary: 'Check agent availability' })
  @ApiResponse({ status: 200, description: 'Agent availability details' })
  async getAgentAvailability(
    @Param('id') agentId: string
  ): Promise<any> {
    return this.eligibilityService.getAgentAvailability(agentId);
  }
}