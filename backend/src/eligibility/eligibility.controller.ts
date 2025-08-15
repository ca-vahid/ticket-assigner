import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { EligibilityService } from './eligibility.service';
import { Agent } from '../database/entities/agent.entity';
import { AgentLeave, LeaveStatus } from '../database/entities/agent-leave.entity';
import { Settings } from '../database/entities/settings.entity';
import { startOfDay, endOfDay, addDays, format } from 'date-fns';
import type { EligibilityContext, EligibilityResult } from './eligibility.types';

@ApiTags('eligibility')
@Controller('api/eligibility')
export class EligibilityController {
  constructor(
    private readonly eligibilityService: EligibilityService,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(AgentLeave)
    private agentLeaveRepository: Repository<AgentLeave>,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>
  ) {}

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

  @Get('calendar')
  @ApiOperation({ summary: 'Get availability calendar data' })
  async getCalendarData(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : addDays(start, 30);

    // Fetch all approved leaves in the date range
    const leaves = await this.agentLeaveRepository.find({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: LessThanOrEqual(end),
        endDate: MoreThanOrEqual(start)
      },
      relations: ['agent']
    });

    // Group leaves by date
    const leavesByDate: Record<string, any[]> = {};
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      leavesByDate[dateStr] = [];
      
      for (const leave of leaves) {
        if (leave.startDate <= currentDate && leave.endDate >= currentDate) {
          leavesByDate[dateStr].push({
            id: leave.id,
            agentId: leave.agent.id,
            agentName: `${leave.agent.firstName} ${leave.agent.lastName}`,
            leaveType: leave.leaveType,
            isAvailableForWork: leave.isAvailableForWork,
            isAllDay: leave.isAllDay,
            duration: leave.duration,
            startDate: leave.startDate,
            endDate: leave.endDate
          });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get agent availability counts
    const agents = await this.agentRepository.find({
      where: { isAvailable: true }
    });

    const totalAgents = agents.length;

    return {
      success: true,
      data: {
        leavesByDate,
        totalAgents,
        dateRange: {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd')
        }
      }
    };
  }

  @Get('leaves')
  @ApiOperation({ summary: 'Get all leaves for a period' })
  async getLeaves(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agentId') agentId?: string
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : addDays(start, 30);

    const whereClause: any = {
      status: LeaveStatus.APPROVED,
      startDate: LessThanOrEqual(end),
      endDate: MoreThanOrEqual(start)
    };

    if (agentId) {
      whereClause.agent = { id: agentId };
    }

    const leaves = await this.agentLeaveRepository.find({
      where: whereClause,
      relations: ['agent', 'agent.location'],
      order: {
        startDate: 'ASC'
      }
    });

    const formattedLeaves = leaves.map(leave => ({
      id: leave.id,
      agentId: leave.agent.id,
      agentName: `${leave.agent.firstName} ${leave.agent.lastName}`,
      agentEmail: leave.agent.email,
      location: leave.agent.location?.name || 'Unknown',
      leaveType: leave.leaveType,
      status: leave.status,
      startDate: leave.startDate,
      endDate: leave.endDate,
      isAllDay: leave.isAllDay,
      duration: leave.duration,
      isAvailableForWork: leave.isAvailableForWork,
      reason: leave.reason,
      notes: leave.notes
    }));

    return {
      success: true,
      data: formattedLeaves
    };
  }

  @Get('coverage-analysis')
  @ApiOperation({ summary: 'Analyze team coverage based on PTO' })
  async getCoverageAnalysis(
    @Query('days') days: number = 14
  ) {
    const start = new Date();
    const end = addDays(start, days);

    // Get all active agents
    const agents = await this.agentRepository.find({
      where: { isAvailable: true }
    });

    const totalAgents = agents.length;

    // Get all approved leaves
    const leaves = await this.agentLeaveRepository.find({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: LessThanOrEqual(end),
        endDate: MoreThanOrEqual(start)
      },
      relations: ['agent']
    });

    // Analyze coverage by day
    const coverageByDay: any[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayName = format(currentDate, 'EEEE');
      
      // Count agents on leave this day
      const agentsOnLeave = leaves.filter(leave => 
        leave.startDate <= currentDate && 
        leave.endDate >= currentDate &&
        !leave.isAvailableForWork
      );

      const agentsOnWFH = leaves.filter(leave => 
        leave.startDate <= currentDate && 
        leave.endDate >= currentDate &&
        leave.isAvailableForWork
      );

      const availableCount = totalAgents - agentsOnLeave.length;
      const coveragePercent = totalAgents > 0 ? (availableCount / totalAgents) * 100 : 0;

      coverageByDay.push({
        date: dateStr,
        dayName,
        totalAgents,
        availableCount,
        onLeaveCount: agentsOnLeave.length,
        onWFHCount: agentsOnWFH.length,
        coveragePercent: Math.round(coveragePercent),
        status: coveragePercent >= 70 ? 'good' : coveragePercent >= 50 ? 'warning' : 'critical',
        agentsOnLeave: agentsOnLeave.map(l => ({
          name: `${l.agent.firstName} ${l.agent.lastName}`,
          type: l.leaveType
        })),
        agentsOnWFH: agentsOnWFH.map(l => ({
          name: `${l.agent.firstName} ${l.agent.lastName}`,
          type: l.leaveType
        }))
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Find critical days
    const criticalDays = coverageByDay.filter(day => day.status === 'critical');
    const warningDays = coverageByDay.filter(day => day.status === 'warning');

    return {
      success: true,
      data: {
        coverageByDay,
        summary: {
          totalDays: coverageByDay.length,
          criticalDays: criticalDays.length,
          warningDays: warningDays.length,
          goodDays: coverageByDay.length - criticalDays.length - warningDays.length,
          averageCoverage: Math.round(
            coverageByDay.reduce((sum, day) => sum + day.coveragePercent, 0) / coverageByDay.length
          )
        },
        alerts: [
          ...criticalDays.map(day => ({
            type: 'critical',
            date: day.date,
            message: `Critical coverage on ${day.dayName}: Only ${day.availableCount} of ${day.totalAgents} agents available`
          })),
          ...warningDays.slice(0, 3).map(day => ({
            type: 'warning',
            date: day.date,
            message: `Low coverage on ${day.dayName}: ${day.availableCount} of ${day.totalAgents} agents available`
          }))
        ]
      }
    };
  }

  @Get('leave-stats')
  @ApiOperation({ summary: 'Get leave statistics' })
  async getLeaveStats() {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    // Get current leaves
    const currentLeaves = await this.agentLeaveRepository.find({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now)
      },
      relations: ['agent']
    });

    // Get upcoming leaves (next 30 days)
    const upcomingLeaves = await this.agentLeaveRepository.find({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: Between(now, thirtyDaysFromNow)
      },
      relations: ['agent']
    });

    // Group by leave type
    const leaveTypeStats: Record<string, number> = {};
    [...currentLeaves, ...upcomingLeaves].forEach(leave => {
      leaveTypeStats[leave.leaveType] = (leaveTypeStats[leave.leaveType] || 0) + 1;
    });

    return {
      success: true,
      data: {
        currentlyOnLeave: currentLeaves.length,
        upcomingLeaves: upcomingLeaves.length,
        leaveTypeBreakdown: leaveTypeStats,
        currentLeaves: currentLeaves.map(l => ({
          agent: `${l.agent.firstName} ${l.agent.lastName}`,
          type: l.leaveType,
          endDate: l.endDate
        })),
        upcomingLeaves: upcomingLeaves.map(l => ({
          agent: `${l.agent.firstName} ${l.agent.lastName}`,
          type: l.leaveType,
          startDate: l.startDate,
          endDate: l.endDate
        }))
      }
    };
  }
}