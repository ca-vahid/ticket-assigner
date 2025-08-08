import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncAgentsCommand } from './sync-agents.command';
import { SyncCategoriesCommand } from './sync-categories.command';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private syncAgentsCommand: SyncAgentsCommand,
    private syncCategoriesCommand: SyncCategoriesCommand,
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

  async syncAll(): Promise<{ 
    agents: { synced: number; skipped: number };
    categories: { synced: number; skipped: number };
  }> {
    this.logger.log('🔄 Starting full sync...');
    const agents = await this.syncAgents();
    const categories = await this.syncCategories();
    // TODO: Add VacationTracker sync
    this.logger.log('✅ Full sync completed');
    return { agents, categories };
  }
}