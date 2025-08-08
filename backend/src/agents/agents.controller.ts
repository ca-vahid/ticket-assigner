import { 
  Controller, 
  Get, 
  Put, 
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

@ApiTags('agents')
@Controller('api/agents')
export class AgentsController {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all agents' })
  @ApiResponse({ status: 200, description: 'List of agents' })
  async getAgents(
    @Query('available') available?: boolean,
    @Query('level') level?: string,
    @Query('skill') skill?: string
  ): Promise<Agent[]> {
    const query = this.agentRepository.createQueryBuilder('agent');
    
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
    const agent = await this.agentRepository.findOne({ where: { id } });
    
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }
    
    // Only allow updating certain fields
    const allowedUpdates = ['isAvailable', 'skills', 'level', 'maxConcurrentTickets'];
    const filteredUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (key in updates) {
        filteredUpdates[key] = updates[key as keyof Agent];
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
    
    return {
      agentId: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      currentTickets: agent.currentTicketCount,
      maxTickets: agent.maxConcurrentTickets || 10,
      utilizationPercentage: Math.round((agent.currentTicketCount / (agent.maxConcurrentTickets || 10)) * 100),
      totalAssignments: agent.totalAssignments || 0,
      isAvailable: agent.isAvailable,
      isPto: agent.isPto
    };
  }
}