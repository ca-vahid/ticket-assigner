import { Controller, Post, Get, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VacationTrackerService } from './vacation-tracker.service';
import { AgentLeave } from '../../database/entities/agent-leave.entity';

@ApiTags('vacation-tracker')
@Controller('api/vacation-tracker')
export class VacationTrackerController {
  constructor(private readonly vacationTrackerService: VacationTrackerService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync leave data from Vacation Tracker' })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  async syncLeaveData() {
    return this.vacationTrackerService.syncLeaveData();
  }

  @Post('update-pto-status')
  @ApiOperation({ summary: 'Update agent PTO status based on current leaves' })
  @ApiResponse({ status: 200, description: 'PTO status updated' })
  async updatePtoStatus() {
    await this.vacationTrackerService.updateAgentPtoStatus();
    return { success: true, message: 'PTO status updated for all agents' };
  }

  @Get('agents-on-pto')
  @ApiOperation({ summary: 'Get list of agents currently on PTO' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of agent IDs on PTO' })
  async getAgentsOnPto(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    const agentIds = await this.vacationTrackerService.getAgentsOnPto(start, end);
    return { agentIds, count: agentIds.length };
  }

  @Get('agent/:agentId/pto-status')
  @ApiOperation({ summary: 'Check if a specific agent is on PTO' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Agent PTO status' })
  async checkAgentPtoStatus(
    @Param('agentId') agentId: string,
    @Query('date') date?: string,
  ) {
    const checkDate = date ? new Date(date) : new Date();
    const isOnPto = await this.vacationTrackerService.isAgentOnPto(agentId, checkDate);
    return { agentId, isOnPto, date: checkDate };
  }

  @Get('agent/:agentId/upcoming-leaves')
  @ApiOperation({ summary: 'Get upcoming leaves for an agent' })
  @ApiResponse({ status: 200, description: 'List of upcoming leaves' })
  async getAgentUpcomingLeaves(
    @Param('agentId') agentId: string,
  ): Promise<{ leaves: AgentLeave[]; count: number }> {
    const leaves = await this.vacationTrackerService.getAgentUpcomingLeaves(agentId);
    return { leaves, count: leaves.length };
  }
}