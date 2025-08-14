import { Controller, Post, Body, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import type { ScoringWeights, TicketContext } from './scoring.types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../database/entities/settings.entity';
import { Agent, AgentLevel } from '../database/entities/agent.entity';
import { Location } from '../database/entities/location.entity';

@ApiTags('scoring')
@Controller('api/scoring')
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
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

  @Get('available-skills')
  @ApiOperation({ summary: 'Get all available skills from agents' })
  @ApiResponse({ status: 200, description: 'List of available skills' })
  async getAvailableSkills(): Promise<string[]> {
    const agents = await this.agentRepository.find({
      where: { isAvailable: true }
    });
    
    const skillSet = new Set<string>();
    agents.forEach(agent => {
      // Add skills from all sources
      if (agent.skills) {
        agent.skills.forEach(skill => skillSet.add(skill));
      }
      if (agent.categorySkills) {
        agent.categorySkills.forEach(skill => skillSet.add(skill));
      }
      if (agent.autoDetectedSkills) {
        agent.autoDetectedSkills.forEach(skill => skillSet.add(skill));
      }
      if (agent.skillMetadata) {
        if (agent.skillMetadata.manual) {
          agent.skillMetadata.manual.forEach(skill => skillSet.add(skill));
        }
        if (agent.skillMetadata.category) {
          agent.skillMetadata.category.forEach(item => skillSet.add(item.skill));
        }
        if (agent.skillMetadata.group) {
          agent.skillMetadata.group.forEach(skill => skillSet.add(skill));
        }
        if (agent.skillMetadata.pattern) {
          agent.skillMetadata.pattern.forEach(item => skillSet.add(item.skill));
        }
        if (agent.skillMetadata.llm) {
          agent.skillMetadata.llm.forEach(item => skillSet.add(item.skill));
        }
      }
    });
    
    return Array.from(skillSet).sort();
  }

  @Get('available-locations')
  @ApiOperation({ summary: 'Get all available locations' })
  @ApiResponse({ status: 200, description: 'List of available locations' })
  async getAvailableLocations(): Promise<{ id: string; name: string; timezone?: string }[]> {
    const locations = await this.locationRepository.find({
      order: { name: 'ASC' }
    });
    
    return locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      timezone: loc.timezone
    }));
  }

  @Post('test-scenario')
  @ApiOperation({ summary: 'Test scoring scenario with live agent data' })
  @ApiResponse({ status: 200, description: 'Scoring results for test scenario' })
  async testScenario(
    @Body() scenario: {
      skills: string[];
      level: string;
      locationId?: string;
      isVIP: boolean;
    }
  ): Promise<{
    topMatches: any[];
    availableAgents: number;
    eligibleAgents: number;
    averageScore: number;
    scoreDistribution: { range: string; count: number }[];
  }> {
    // Create ticket context from scenario
    const ticketContext: TicketContext = {
      id: 'test-ticket',
      title: 'Test Scenario',
      requiredSkills: scenario.skills,
      requiredLevel: scenario.level as AgentLevel,
      locationId: scenario.locationId,
      isVip: scenario.isVIP,
      requiresOnsite: !!scenario.locationId,
      relatedSkills: []
    };

    // Get all available agents with their locations
    const agents = await this.agentRepository.find({
      where: { isAvailable: true },
      relations: ['location']
    });

    // Score all agents
    const scoringResults = await this.scoringService.scoreMultipleAgents(agents, ticketContext);
    
    // Filter eligible agents (those who meet basic requirements)
    const eligibleResults = scoringResults.filter(result => 
      result.eligibility.isAvailable && 
      result.eligibility.hasCapacity &&
      result.eligibility.meetsLevel
    );

    // Calculate statistics
    const averageScore = eligibleResults.length > 0
      ? eligibleResults.reduce((sum, r) => sum + r.totalScore, 0) / eligibleResults.length
      : 0;

    // Create score distribution
    const distribution = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 }
    ];

    eligibleResults.forEach(result => {
      const score = Math.round(result.totalScore);
      if (score <= 20) distribution[0].count++;
      else if (score <= 40) distribution[1].count++;
      else if (score <= 60) distribution[2].count++;
      else if (score <= 80) distribution[3].count++;
      else distribution[4].count++;
    });

    // Get top 5 matches with agent details
    const topMatches = eligibleResults.slice(0, 5).map(result => {
      const agent = agents.find(a => a.id === result.agentId);
      return {
        agentId: result.agentId,
        agentName: result.agentName,
        email: agent?.email,
        level: agent?.level,
        location: agent?.location?.name || 'Remote',
        skills: agent?.skills || [],
        currentWorkload: agent?.currentTicketCount || 0,
        weightedWorkload: Number(agent?.weightedTicketCount || 0),
        totalScore: result.totalScore,
        breakdown: result.breakdown,
        eligibility: result.eligibility
      };
    });

    return {
      topMatches,
      availableAgents: agents.length,
      eligibleAgents: eligibleResults.length,
      averageScore: Math.round(averageScore * 100) / 100,
      scoreDistribution: distribution
    };
  }
}