import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Category } from '../database/entities/category.entity';
import { Settings } from '../database/entities/settings.entity';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';
import { SyncAgentsCommand } from './sync-agents.command';
import { SyncCategoriesCommand } from './sync-categories.command';
import { SyncTicketCountsCommand } from './sync-ticket-counts.command';
import { TicketWorkloadCalculator } from './ticket-workload-calculator';
import { SyncProgressService } from './sync-progress.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
    private freshserviceService: FreshserviceService,
    private syncAgentsCommand: SyncAgentsCommand,
    private syncCategoriesCommand: SyncCategoriesCommand,
    private syncTicketCountsCommand: SyncTicketCountsCommand,
    private workloadCalculator: TicketWorkloadCalculator,
    private syncProgressService: SyncProgressService,
  ) {}

  async syncAgents() {
    return this.syncAgentsCommand.execute();
  }

  async syncCategories() {
    return this.syncCategoriesCommand.execute();
  }

  async syncTicketCounts() {
    return this.syncTicketCountsCommand.execute();
  }

  /**
   * Get sync timestamps from settings
   */
  async getSyncTimestamps() {
    const keys = [
      'sync.lastAgentSync',
      'sync.lastTicketSync',
      'sync.lastWorkloadRecalc',
      'sync.lastSkillDetection'
    ];
    
    const settings = await this.settingsRepository.find({
      where: keys.map(key => ({ key }))
    });
    
    const timestamps: Record<string, string | null> = {};
    keys.forEach(key => {
      const setting = settings.find(s => s.key === key);
      const shortKey = key.replace('sync.', '');
      timestamps[shortKey] = setting?.value || null;
    });
    
    return timestamps;
  }

  /**
   * Run full sync: agents, categories, and ticket counts
   */
  async runFullSync() {
    this.logger.log('🔄 Starting full sync...');
    
    // Sync agents first
    const agents = await this.syncAgents();
    
    // Sync categories
    const categories = await this.syncCategories();
    
    // Sync ticket counts and workloads
    const ticketCounts = await this.syncTicketCounts();
    
    this.logger.log('✅ Full sync completed');
    return { agents, categories, ticketCounts };
  }

  async recalculateAllWorkloads(): Promise<{ updated: number }> {
    this.logger.log('🔄 Recalculating workloads with updated weights...');
    
    try {
      // Get all agents
      const agents = await this.agentRepository.find();
      let updated = 0;
      
      // Emit start event
      this.syncProgressService.startSync('workload', agents.length);
      
      // Load current ticket age weights once
      const settings = await this.settingsRepository.findOne({
        where: { key: 'scoring.ticketAgeWeights' }
      });
      
      const weights = settings?.value || {
        fresh: 2.0,
        recent: 1.2,
        stale: 0.5,
        old: 0.1
      };
      
      this.logger.log(`Using weights: Fresh=${weights.fresh}, Recent=${weights.recent}, Stale=${weights.stale}, Old=${weights.old}`);
      
      // Recalculate based on existing breakdown
      let processedCount = 0;
      for (const agent of agents) {
        processedCount++;
        
        // Emit progress
        this.syncProgressService.updateProgress(
          'workload',
          processedCount,
          agents.length,
          `Recalculating workload for ${agent.firstName} ${agent.lastName}...`
        );
        
        try {
          // Use existing ticket breakdown if available
          const breakdown = agent.ticketWorkloadBreakdown || {
            fresh: 0,
            recent: 0,
            stale: 0,
            abandoned: 0
          };
          
          // Calculate new weighted count using current weights
          const newWeightedCount = 
            (breakdown.fresh || 0) * weights.fresh +
            (breakdown.recent || 0) * weights.recent +
            (breakdown.stale || 0) * weights.stale +
            (breakdown.abandoned || 0) * weights.old;
          
          // Update if changed
          const roundedWeightedCount = parseFloat(newWeightedCount.toFixed(2));
          if (agent.weightedTicketCount !== roundedWeightedCount) {
            agent.weightedTicketCount = roundedWeightedCount;
            await this.agentRepository.save(agent);
            updated++;
            
            this.logger.log(
              `Updated ${agent.firstName} ${agent.lastName}: ` +
              `${agent.currentTicketCount} tickets → ${roundedWeightedCount} weighted ` +
              `(${breakdown.fresh}f, ${breakdown.recent}r, ${breakdown.stale}s, ${breakdown.abandoned}o)`
            );
          }
        } catch (error) {
          this.logger.error(`Failed to recalculate for agent ${agent.email}:`, error.message);
        }
      }
      
      this.logger.log(`✅ Recalculated workloads for ${updated} agents`);
      
      // Update last recalc timestamp
      await this.updateSyncTimestamp('sync.lastWorkloadRecalc');
      
      // Emit completion
      this.syncProgressService.completeSync(
        'workload',
        `Recalculated workloads for ${updated} agents`,
        { updated, total: agents.length }
      );
      
      return { updated };
    } catch (error) {
      this.logger.error('Failed to recalculate workloads:', error);
      
      // Emit error
      this.syncProgressService.errorSync('workload', error.message);
      
      throw error;
    }
  }

  /**
   * Update sync timestamp in settings
   */
  private async updateSyncTimestamp(key: string): Promise<void> {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    
    if (setting) {
      setting.value = new Date().toISOString();
      await this.settingsRepository.save(setting);
    } else {
      await this.settingsRepository.save({
        key,
        value: new Date().toISOString(),
        description: `Last ${key.replace('sync.', '').replace(/([A-Z])/g, ' $1').toLowerCase()} timestamp`,
        category: 'sync',
        isEditable: false
      });
    }
  }
}