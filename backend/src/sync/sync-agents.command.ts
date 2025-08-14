import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { Location } from '../database/entities/location.entity';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';
import { SyncProgressService } from './sync-progress.service';

@Injectable()
export class SyncAgentsCommand {
  private readonly logger = new Logger(SyncAgentsCommand.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private freshserviceService: FreshserviceService,
    private syncProgressService: SyncProgressService,
  ) {}

  async execute(options: { workspaceId?: number } = {}): Promise<{ synced: number; skipped: number }> {
    this.logger.log('🔄 Starting agent sync from Freshservice...');
    
    // Default to IT workspace (ID: 2) if not specified
    const IT_WORKSPACE_ID = options.workspaceId || 2;
    let syncedCount = 0;
    let skippedCount = 0;

    try {
      // Emit start event
      this.syncProgressService.startSync('agents', 100);
      this.syncProgressService.updateProgress('agents', 0, 100, 'Fetching agents from Freshservice...');
      
      // Fetch all agents from Freshservice
      const freshserviceAgents = await this.freshserviceService.getAllAgents();
      this.logger.log(`📥 Fetched ${freshserviceAgents.length} agents from Freshservice`);

      // Filter for IT workspace agents only
      const itAgents = freshserviceAgents.filter(agent => {
        // Check if agent is in IT workspace
        return agent.workspace_ids && agent.workspace_ids.includes(IT_WORKSPACE_ID);
      });

      this.logger.log(`🎯 Found ${itAgents.length} agents in IT workspace (ID: ${IT_WORKSPACE_ID})`);
      
      // Update progress with actual count
      this.syncProgressService.updateProgress('agents', 0, itAgents.length, `Processing ${itAgents.length} agents...`);

      // Sync each IT agent
      let processedCount = 0;
      for (const fsAgent of itAgents) {
        processedCount++;
        
        // Emit progress
        this.syncProgressService.updateProgress(
          'agents',
          processedCount,
          itAgents.length,
          `Processing ${fsAgent.first_name} ${fsAgent.last_name}...`
        );
        
        if (!fsAgent.active) {
          this.logger.debug(`Skipping inactive agent: ${fsAgent.first_name} ${fsAgent.last_name}`);
          skippedCount++;
          continue;
        }

        // Check if agent exists
        let agent = await this.agentRepository.findOne({
          where: { freshserviceId: fsAgent.id.toString() }
        });

        if (!agent) {
          // Create new agent
          const skills = this.extractSkills(fsAgent);
          const level = this.mapAgentLevel(fsAgent);
          
          // Get or create location
          const location = await this.getOrCreateLocation(fsAgent);
          
          agent = this.agentRepository.create({
            freshserviceId: fsAgent.id.toString(),
            email: fsAgent.email,
            firstName: fsAgent.first_name,
            lastName: fsAgent.last_name,
            experienceLevel: level,
            level: level as any, // Map to AgentLevel enum
            isAvailable: fsAgent.active,
            location: location || undefined,
            timezone: fsAgent.time_zone || location?.timezone || 'America/Toronto',
            isRemote: this.isRemoteAgent(fsAgent),
            skills: skills.length > 0 ? skills : [],
            currentTicketCount: 0,
            maxConcurrentTickets: 10,
            lastSyncAt: new Date()
          });
          
          await this.agentRepository.save(agent);
          this.logger.log(`✅ Created agent: ${agent.firstName} ${agent.lastName}`);
          syncedCount++;
        } else {
          // Update existing agent
          agent.email = fsAgent.email;
          agent.firstName = fsAgent.first_name;
          agent.lastName = fsAgent.last_name;
          
          // Only update availability if not manually deactivated
          if (!agent.manuallyDeactivated) {
            agent.isAvailable = fsAgent.active;
          } else {
            this.logger.debug(`⚠️ Preserving manual deactivation for ${agent.firstName} ${agent.lastName}`);
          }
          
          // Update location
          const location = await this.getOrCreateLocation(fsAgent);
          if (location) {
            agent.location = location;
          }
          agent.timezone = fsAgent.time_zone || location?.timezone || agent.timezone;
          agent.isRemote = this.isRemoteAgent(fsAgent);
          agent.lastSyncAt = new Date();
          
          await this.agentRepository.save(agent);
          this.logger.log(`📝 Updated agent: ${agent.firstName} ${agent.lastName}`);
          syncedCount++;
        }
      }

      this.logger.log(`✅ Agent sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
      
      // Emit completion
      this.syncProgressService.completeSync(
        'agents',
        `Completed: ${syncedCount} agents synced, ${skippedCount} skipped`,
        { synced: syncedCount, skipped: skippedCount }
      );
      
      return { synced: syncedCount, skipped: skippedCount };
    } catch (error) {
      this.logger.error('❌ Agent sync failed:', error);
      this.syncProgressService.errorSync('agents', 'Agent sync failed', { error: error.message });
      throw error;
    }
  }

  private mapAgentLevel(fsAgent: any): string {
    // Map Freshservice roles to experience levels
    if (fsAgent.roles?.some((r: any) => r.role_name?.includes('Admin'))) {
      return 'L3';
    } else if (fsAgent.roles?.some((r: any) => r.role_name?.includes('Supervisor'))) {
      return 'L2';
    }
    return 'L1';
  }

  private extractSkills(fsAgent: any): string[] {
    // Extract skills from agent's group memberships or custom fields
    const skills = [];
    
    if (fsAgent.group_ids?.length > 0) {
      // Map group IDs to skill categories
      // This would be customized based on your Freshservice setup
      skills.push('general_support');
    }
    
    if (fsAgent.roles?.some((r: any) => r.role_name?.includes('IT'))) {
      skills.push('hardware', 'software');
    }
    
    return skills;
  }

  private async getOrCreateLocation(fsAgent: any): Promise<Location | null> {
    // Log what we're working with
    this.logger.debug(`Getting location for ${fsAgent.first_name} ${fsAgent.last_name}:`);
    this.logger.debug(`  - Department: ${JSON.stringify(fsAgent.department_names)}`);
    this.logger.debug(`  - Location: ${fsAgent.location_name}`);
    
    // Use department as the primary location
    if (fsAgent.department_names && fsAgent.department_names.length > 0) {
      const deptName = fsAgent.department_names[0];
      const locationId = `dept_${deptName.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Try to find existing location by department ID or name
      let location = await this.locationRepository.findOne({
        where: [
          { freshserviceId: locationId },
          { name: deptName }
        ]
      });

      if (!location) {
        // Determine if this is a Canadian city
        const canadianCities = ['Calgary', 'Edmonton', 'Vancouver', 'Toronto', 'Montreal', 'Ottawa', 'Winnipeg', 'Halifax', 'Victoria', 'Kamloops', 'Surrey', 'Fredericton'];
        const isCanadianCity = canadianCities.some(city => deptName.includes(city));
        
        // Create location based on department
        location = this.locationRepository.create({
          freshserviceId: locationId,
          name: deptName,
          city: deptName,
          country: isCanadianCity ? 'Canada' : 'Unknown',
          timezone: this.getTimezoneForCity(deptName),
          isActive: true,
          metadata: {
            isRemote: deptName.toLowerCase().includes('remote'),
            supportTypes: deptName.toLowerCase().includes('remote') ? ['remote'] : ['onsite', 'remote']
          }
        });
        await this.locationRepository.save(location);
        this.logger.log(`📍 Created location from department: ${location.name}, ${location.country}`);
      }
      
      return location;
    }
    
    // If no department, check if it's a remote agent
    if (this.isRemoteAgent(fsAgent)) {
      // Get or create the "Remote" location
      let remoteLocation = await this.locationRepository.findOne({
        where: { freshserviceId: 'remote' }
      });
      
      if (!remoteLocation) {
        remoteLocation = this.locationRepository.create({
          freshserviceId: 'remote',
          name: 'Remote',
          city: 'Remote',
          country: 'Various',
          timezone: 'UTC',
          isActive: true,
          metadata: {
            isRemote: true,
            supportTypes: ['remote']
          }
        });
        await this.locationRepository.save(remoteLocation);
      }
      
      return remoteLocation;
    }
    
    return null;
  }
  
  private getTimezoneForCity(cityName: string): string {
    const timezoneMap: Record<string, string> = {
      'Calgary': 'America/Edmonton',
      'Edmonton': 'America/Edmonton',
      'Vancouver': 'America/Vancouver',
      'Toronto': 'America/Toronto',
      'Montreal': 'America/Montreal',
      'Ottawa': 'America/Toronto',
      'Winnipeg': 'America/Winnipeg',
      'Halifax': 'America/Halifax'
    };
    
    for (const [city, tz] of Object.entries(timezoneMap)) {
      if (cityName.includes(city)) {
        return tz;
      }
    }
    
    return 'America/Toronto'; // Default to Toronto timezone
  }

  private isRemoteAgent(fsAgent: any): boolean {
    // Check various indicators that agent is remote
    if (fsAgent.job_title?.toLowerCase().includes('remote')) return true;
    if (fsAgent.custom_fields?.work_location?.toLowerCase() === 'remote') return true;
    if (!fsAgent.location_id && fsAgent.time_zone) return true; // No office but has timezone
    
    // Check if agent is in a remote group
    // This would need to be customized based on your Freshservice setup
    
    return false;
  }
}