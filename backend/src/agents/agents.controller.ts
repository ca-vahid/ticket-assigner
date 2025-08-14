import { 
  Controller, 
  Get, 
  Put, 
  Delete,
  Param, 
  Body, 
  Query,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Settings } from '../database/entities/settings.entity';

@ApiTags('agents')
@Controller('api/agents')
export class AgentsController {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
  ) {}

  private async getWorkloadLimit(): Promise<number> {
    const rulesSettings = await this.settingsRepository.findOne({
      where: { key: 'eligibility.rules' }
    });

    if (rulesSettings && rulesSettings.value) {
      const rules = rulesSettings.value;
      const workloadRule = rules.find((r: any) => r.id === 'workload_limit');
      if (workloadRule && workloadRule.config && workloadRule.config.maxTickets) {
        return workloadRule.config.maxTickets;
      }
    }
    return 5; // Default fallback
  }

  @Get()
  @ApiOperation({ summary: 'Get all agents' })
  @ApiResponse({ status: 200, description: 'List of agents' })
  async getAgents(
    @Query('available') available?: boolean,
    @Query('level') level?: string,
    @Query('skill') skill?: string
  ): Promise<Agent[]> {
    const query = this.agentRepository.createQueryBuilder('agent')
      .leftJoinAndSelect('agent.location', 'location');
    
    if (available !== undefined) {
      query.andWhere('agent.is_available = :available', { available });
    }
    
    if (level) {
      query.andWhere('agent.level = :level', { level });
    }
    
    if (skill) {
      query.andWhere(':skill = ANY(agent.skills)', { skill });
    }
    
    return query.orderBy('agent.first_name', 'ASC').getMany();
  }

  @Delete('inactive/all')
  @ApiOperation({ summary: 'Delete all inactive agents' })
  @ApiResponse({ status: 200, description: 'Inactive agents deleted' })
  async deleteInactiveAgents(): Promise<{ success: boolean; deleted: number }> {
    const result = await this.agentRepository
      .createQueryBuilder()
      .delete()
      .where('is_available = false')
      .execute();
    
    return { success: true, deleted: result.affected || 0 };
  }

  @Delete('skills/detected')
  @ApiOperation({ summary: 'Clear all detected skills for all agents' })
  @ApiResponse({ status: 200, description: 'Detected skills cleared' })
  async clearAllDetectedSkills(): Promise<{ success: boolean; affected: number }> {
    const agents = await this.agentRepository.find();
    let affected = 0;
    
    for (const agent of agents) {
      if (agent.autoDetectedSkills && agent.autoDetectedSkills.length > 0) {
        // Remove detected skills from main skills array
        agent.skills = agent.skills.filter(skill => 
          !agent.autoDetectedSkills.includes(skill)
        );
        agent.autoDetectedSkills = [];
        
        // Clear category metadata
        if (agent.skillMetadata?.category) {
          delete agent.skillMetadata.category;
        }
        
        await this.agentRepository.save(agent);
        affected++;
      }
    }
    
    return { success: true, affected };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent by ID' })
  @ApiResponse({ status: 200, description: 'Agent details' })
  async getAgent(@Param('id') id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    
    return agent;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update agent details' })
  @ApiResponse({ status: 200, description: 'Updated agent' })
  async updateAgent(
    @Param('id') id: string,
    @Body() updates: Partial<Agent>
  ): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ 
      where: { id },
      relations: ['location']
    });
    
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    
    // Only allow updating certain fields
    const allowedUpdates = ['isAvailable', 'skills', 'level', 'maxConcurrentTickets', 'location'];
    const filteredUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (key in updates) {
        filteredUpdates[key] = updates[key as keyof Agent];
      }
    }
    
    // If isAvailable is being manually changed, track it
    if ('isAvailable' in filteredUpdates) {
      // If manually deactivating, set the flag
      if (!filteredUpdates.isAvailable) {
        filteredUpdates.manuallyDeactivated = true;
      } else {
        // If manually reactivating, clear the flag
        filteredUpdates.manuallyDeactivated = false;
      }
    }
    
    Object.assign(agent, filteredUpdates);
    return this.agentRepository.save(agent);
  }

  @Get(':id/workload')
  @ApiOperation({ summary: 'Get agent workload statistics' })
  @ApiResponse({ status: 200, description: 'Agent workload stats' })
  async getAgentWorkload(@Param('id') id: string): Promise<any> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    
    // Get workload limit from settings
    const workloadLimit = await this.getWorkloadLimit();
    
    return {
      agentId: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      currentTickets: agent.currentTicketCount,
      maxTickets: workloadLimit, // Use settings value
      utilizationPercentage: Math.round((agent.currentTicketCount / workloadLimit) * 100),
      totalAssignments: agent.totalAssignments || 0,
      isAvailable: agent.isAvailable,
      isPto: agent.isPto
    };
  }

  @Put(':id/clear-skills')
  @ApiOperation({ summary: 'Clear all skills for an agent' })
  @ApiResponse({ status: 200, description: 'Skills cleared' })
  async clearAgentSkills(@Param('id') id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    
    agent.skills = [];
    agent.autoDetectedSkills = [];
    agent.skillMetadata = {};
    
    return this.agentRepository.save(agent);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agent' })
  @ApiResponse({ status: 200, description: 'Agent deleted' })
  async deleteAgent(@Param('id') id: string): Promise<{ success: boolean }> {
    const result = await this.agentRepository.delete(id);
    
    if (result.affected === 0) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    
    return { success: true };
  }
}