import { Controller, Post, Body, Get, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@ApiTags('sync')
@Controller('api/admin/sync')
// @UseGuards(AuthGuard) // TODO: Add authentication guard
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly syncProgressService: SyncProgressService,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>
  ) {}

  @Post('agents')
  @ApiOperation({ summary: 'Manually sync agents from Freshservice' })
  @ApiResponse({ status: 200, description: 'Sync completed successfully' })
  async syncAgents(
    @Body() body: { workspaceId?: number } = {}
  ): Promise<{ success: boolean; synced: number; skipped: number; message: string }> {
    try {
      const result = await this.syncService.syncAgents(body.workspaceId);
      return {
        success: true,
        synced: result.synced,
        skipped: result.skipped,
        message: `Successfully synced ${result.synced} agents (${result.skipped} skipped)`
      };
    } catch (error) {
      return {
        success: false,
        synced: 0,
        skipped: 0,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  @Post('ticket-counts')
  @ApiOperation({ summary: 'Sync ticket counts for all agents' })
  @ApiResponse({ status: 200, description: 'Ticket count sync completed' })
  async syncTicketCounts(): Promise<{ success: boolean; updated: number; total: number; message: string }> {
    try {
      const result = await this.syncService.syncTicketCounts();
      return {
        success: true,
        updated: result.updated,
        total: result.total,
        message: `Updated ticket counts for ${result.updated}/${result.total} agents`
      };
    } catch (error) {
      return {
        success: false,
        updated: 0,
        total: 0,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  @Post('recalculate-workloads')
  @ApiOperation({ summary: 'Recalculate workloads with current weights' })
  @ApiResponse({ status: 200, description: 'Workloads recalculated successfully' })
  async recalculateWorkloads(): Promise<{ success: boolean; updated: number; message: string }> {
    try {
      const result = await this.syncService.recalculateAllWorkloads();
      return {
        success: true,
        updated: result.updated,
        message: `Recalculated workloads for ${result.updated} agents`
      };
    } catch (error) {
      return {
        success: false,
        updated: 0,
        message: `Recalculation failed: ${error.message}`
      };
    }
  }

  @Post('categories')
  @ApiOperation({ summary: 'Manually sync categories from Freshservice' })
  @ApiResponse({ status: 200, description: 'Category sync completed' })
  async syncCategories(): Promise<{ success: boolean; synced: number; skipped: number; message: string }> {
    try {
      const result = await this.syncService.syncCategories();
      return {
        success: true,
        synced: result.synced,
        skipped: result.skipped,
        message: `Successfully synced ${result.synced} categories`
      };
    } catch (error) {
      return {
        success: false,
        synced: 0,
        skipped: 0,
        message: `Sync failed: ${error.message}`
      };
    }
  }

  @Post('all')
  @ApiOperation({ summary: 'Sync all data from external sources' })
  @ApiResponse({ status: 200, description: 'Full sync completed' })
  async syncAll(): Promise<{ 
    success: boolean; 
    agents: { synced: number; skipped: number };
    categories: { synced: number; skipped: number };
    ticketCounts: { updated: number; total: number };
    message: string 
  }> {
    try {
      const result = await this.syncService.syncAll();
      return {
        success: true,
        agents: result.agents,
        categories: result.categories,
        ticketCounts: result.ticketCounts,
        message: 'Full sync completed successfully'
      };
    } catch (error) {
      return {
        success: false,
        agents: { synced: 0, skipped: 0 },
        categories: { synced: 0, skipped: 0 },
        ticketCounts: { updated: 0, total: 0 },
        message: `Sync failed: ${error.message}`
      };
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync status and last sync times' })
  @ApiResponse({ status: 200, description: 'Sync status' })
  async getSyncStatus(): Promise<{
    lastAgentSync?: Date;
    totalAgents: number;
    activeAgents: number;
    workspaceBreakdown?: Record<string, number>;
  }> {
    // Get the latest sync time
    const lastSyncedAgent = await this.agentRepository.findOne({
      where: { lastSyncAt: Not(IsNull()) },
      order: { lastSyncAt: 'DESC' }
    });

    // Count total and active agents
    const totalAgents = await this.agentRepository.count();
    const activeAgents = await this.agentRepository.count({
      where: { isAvailable: true }
    });

    return {
      lastAgentSync: lastSyncedAgent?.lastSyncAt,
      totalAgents,
      activeAgents,
      workspaceBreakdown: {
        IT: totalAgents // All synced agents are from IT workspace now
      }
    };
  }

  @Get('timestamps')
  @ApiOperation({ summary: 'Get last sync timestamps for all operations' })
  @ApiResponse({ status: 200, description: 'Sync timestamps' })
  async getSyncTimestamps(): Promise<{
    lastAgentSync?: Date;
    lastTicketSync?: Date;
    lastWorkloadRecalc?: Date;
    lastSkillDetection?: Date;
  }> {
    return await this.syncService.getSyncTimestamps();
  }

  @Sse('progress')
  @ApiOperation({ summary: 'Stream real-time sync progress updates' })
  @ApiResponse({ status: 200, description: 'SSE stream of progress updates' })
  syncProgress(): Observable<MessageEvent> {
    return this.syncProgressService.progress$.pipe(
      map(progress => ({
        data: progress,
        type: 'sync-progress'
      } as MessageEvent))
    );
  }
}