import { Controller, Post, Body, Get, Param, Query, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AssignmentService } from './assignment.service';
import type { 
  AssignmentRequest, 
  AssignmentResult, 
  AssignmentFeedback 
} from './assignment.types';

@ApiTags('assignment')
@Controller('api/assignment')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post('assign')
  @ApiOperation({ summary: 'Assign or suggest agents for a ticket' })
  @ApiResponse({ status: 200, description: 'Assignment result' })
  async assignTicket(
    @Body() request: AssignmentRequest
  ): Promise<AssignmentResult> {
    return this.assignmentService.assignTicket(request);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Provide feedback on an assignment decision' })
  @ApiResponse({ status: 200, description: 'Feedback recorded' })
  async provideFeedback(
    @Body() feedback: AssignmentFeedback
  ): Promise<{ success: boolean }> {
    await this.assignmentService.provideFeedback(feedback);
    return { success: true };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get assignment history' })
  @ApiResponse({ status: 200, description: 'Assignment history' })
  async getHistory(
    @Query('ticketId') ticketId?: string,
    @Query('agentId') agentId?: string,
    @Query('limit') limit: number = 50
  ): Promise<any> {
    return this.assignmentService.getAssignmentHistory(ticketId, agentId, limit);
  }

  @Get('decision/:id')
  @ApiOperation({ summary: 'Get a specific assignment decision' })
  @ApiResponse({ status: 200, description: 'Decision details' })
  async getDecision(@Param('id') decisionId: string): Promise<any> {
    // TODO: Implement get single decision
    return { decisionId };
  }

  @Post('test-scenario')
  @ApiOperation({ summary: 'Test assignment scenario without creating records' })
  @ApiResponse({ status: 200, description: 'Test scenario results' })
  async testScenario(
    @Body() scenario: {
      skills: string[];
      level: string;
      locationId?: string;
      isVIP: boolean;
      categoryId?: string;
    }
  ): Promise<any> {
    return this.assignmentService.testAssignmentScenario(scenario);
  }

  @Get('debug/agent-skills')
  @ApiOperation({ summary: 'Debug endpoint to see agent skills' })
  @ApiResponse({ status: 200, description: 'Agent skills debug info' })
  async debugAgentSkills(): Promise<any> {
    return this.assignmentService.debugAgentSkills();
  }

  @Put('settings/reload')
  @ApiOperation({ summary: 'Reload assignment settings' })
  @ApiResponse({ status: 200, description: 'Settings reloaded' })
  async reloadSettings(): Promise<{ success: boolean }> {
    await this.assignmentService.loadSettings();
    return { success: true };
  }

  @Delete('history/old')
  @ApiOperation({ summary: 'Delete old assignment history' })
  @ApiResponse({ status: 200, description: 'Old assignments deleted' })
  async deleteOldAssignments(
    @Query('days') days: number = 90
  ): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.assignmentService.deleteOldAssignments(days);
    return { success: true, deleted };
  }

  @Delete('history/all')
  @ApiOperation({ summary: 'Delete all assignment history' })
  @ApiResponse({ status: 200, description: 'All assignments deleted' })
  async deleteAllAssignments(): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.assignmentService.deleteAllAssignments();
    return { success: true, deleted };
  }

  @Delete('history/:id')
  @ApiOperation({ summary: 'Delete a specific assignment' })
  @ApiResponse({ status: 200, description: 'Assignment deleted' })
  async deleteAssignment(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.assignmentService.deleteAssignment(id);
    return { success: true };
  }
}