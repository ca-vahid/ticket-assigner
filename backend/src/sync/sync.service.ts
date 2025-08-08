import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncAgentsCommand } from './sync-agents.command';
import { SyncCategoriesCommand } from './sync-categories.command';
import { SyncTicketCountsCommand } from './sync-ticket-counts.command';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private syncAgentsCommand: SyncAgentsCommand,
    private syncCategoriesCommand: SyncCategoriesCommand,
    private syncTicketCountsCommand: SyncTicketCountsCommand,
  ) {}

  // Run sync every hour
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledSync() {
    this.logger.log('⏰ Running scheduled sync...');
    await this.syncAgents();
  }

  async syncAgents(workspaceId?: number): Promise<{ synced: number; skipped: number }> {
    try {
      const result = await this.syncAgentsCommand.execute({ workspaceId });
      return result;
    } catch (error) {
      this.logger.error('Failed to sync agents:', error);
      throw error;
    }
  }

  async syncCategories(): Promise<{ synced: number; skipped: number }> {
    try {
      const result = await this.syncCategoriesCommand.execute();
      return result;
    } catch (error) {
      this.logger.error('Failed to sync categories:', error);
      throw error;
    }
  }

  async syncTicketCounts(): Promise<{ updated: number; total: number }> {
    try {
      const result = await this.syncTicketCountsCommand.execute();
      return result;
    } catch (error) {
      this.logger.error('Failed to sync ticket counts:', error);
      throw error;
    }
  }

  async syncAll(): Promise<{ 
    agents: { synced: number; skipped: number };
    categories: { synced: number; skipped: number };
    ticketCounts: { updated: number; total: number };
  }> {
    this.logger.log('🔄 Starting full sync...');
    const agents = await this.syncAgents();
    const categories = await this.syncCategories();
    const ticketCounts = await this.syncTicketCounts();
    this.logger.log('✅ Full sync completed');
    return { agents, categories, ticketCounts };
  }
}