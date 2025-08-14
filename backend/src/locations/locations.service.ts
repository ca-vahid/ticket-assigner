import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Location } from '../database/entities/location.entity';
import { Agent } from '../database/entities/agent.entity';
import { LocationSyncService } from '../integrations/freshservice/location-sync.service';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    private locationSyncService: LocationSyncService,
  ) {}

  async getLocations(filters?: {
    active?: boolean;
    includeRemote?: boolean;
  }): Promise<Location[]> {
    const query = this.locationRepository.createQueryBuilder('location');

    if (filters?.active !== undefined) {
      query.andWhere('location.is_active = :active', { active: filters.active });
    }

    if (filters?.includeRemote === false) {
      query.andWhere("location.freshservice_id != 'remote'");
    }

    return query.orderBy('location.name', 'ASC').getMany();
  }

  async getLocationById(id: string): Promise<Location | null> {
    return this.locationRepository.findOne({
      where: { id },
      relations: ['agents']
    });
  }

  async getLocationByFreshserviceId(freshserviceId: string): Promise<Location | null> {
    return this.locationRepository.findOne({
      where: { freshserviceId }
    });
  }

  async getLocationAgents(locationId: string): Promise<Agent[]> {
    return this.agentRepository.find({
      where: { location: { id: locationId } },
      relations: ['location'],
      order: { firstName: 'ASC', lastName: 'ASC' }
    });
  }

  async getLocationStatistics(): Promise<any> {
    const locations = await this.locationRepository.find();
    const agents = await this.agentRepository.find({ relations: ['location'] });

    const stats = {
      totalLocations: locations.length,
      activeLocations: locations.filter(l => l.isActive).length,
      remoteWorkers: agents.filter(a => a.isRemote).length,
      locationDistribution: [] as any[],
      timezoneDistribution: {} as Record<string, number>,
      byLocation: {} as Record<string, number>,
      supportCoverage: {
        onsite: 0,
        remote: 0,
        hybrid: 0
      }
    };

    // Calculate distribution
    for (const location of locations) {
      const agentCount = agents.filter(a => a.location?.id === location.id).length;
      const activeAgents = agents.filter(
        a => a.location?.id === location.id && a.isAvailable
      ).length;

      // Add to byLocation for frontend compatibility
      stats.byLocation[location.name] = agentCount;

      stats.locationDistribution.push({
        id: location.id,
        name: location.name,
        city: location.city,
        timezone: location.timezone,
        agentCount,
        activeAgents,
        utilization: agentCount > 0 ? (activeAgents / agentCount) * 100 : 0,
        supportTypes: location.metadata?.supportTypes || []
      });

      // Timezone distribution
      if (!stats.timezoneDistribution[location.timezone]) {
        stats.timezoneDistribution[location.timezone] = 0;
      }
      stats.timezoneDistribution[location.timezone] += agentCount;

      // Support coverage
      const supportTypes = location.metadata?.supportTypes || [];
      if (supportTypes.includes('onsite') && supportTypes.includes('remote')) {
        stats.supportCoverage.hybrid += agentCount;
      } else if (supportTypes.includes('onsite')) {
        stats.supportCoverage.onsite += agentCount;
      } else if (supportTypes.includes('remote')) {
        stats.supportCoverage.remote += agentCount;
      }
    }

    // Sort by agent count
    stats.locationDistribution.sort((a, b) => b.agentCount - a.agentCount);

    return stats;
  }

  async syncLocationsFromFreshservice(): Promise<{ synced: number; created: number; updated: number }> {
    try {
      return await this.locationSyncService.syncLocations();
    } catch (error) {
      this.logger.error('Failed to sync locations', error);
      throw error;
    }
  }

  async updateLocation(id: string, updates: Partial<Location>): Promise<Location> {
    const location = await this.locationRepository.findOne({ where: { id } });
    
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    // Only allow updating certain fields
    const allowedUpdates = ['name', 'timezone', 'isActive', 'metadata'];
    const filteredUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (key in updates) {
        filteredUpdates[key] = updates[key as keyof Location];
      }
    }

    Object.assign(location, filteredUpdates);
    return this.locationRepository.save(location);
  }

  async setOfficeHours(
    id: string, 
    officeHours: { start: string; end: string; days: string[] }
  ): Promise<Location> {
    const location = await this.locationRepository.findOne({ where: { id } });
    
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    if (!location.metadata) {
      location.metadata = {};
    }

    location.metadata.officeHours = officeHours;
    return this.locationRepository.save(location);
  }

  async getCurrentTimeInTimezone(timezone: string): Promise<any> {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'long'
      });

      const parts = formatter.formatToParts(now);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const weekday = parts.find(p => p.type === 'weekday')?.value || '';

      // Check if within office hours (assuming 9-17)
      const isOfficeHours = hour >= 9 && hour < 17 && 
        !['Saturday', 'Sunday'].includes(weekday);

      return {
        timezone,
        currentTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        weekday,
        isOfficeHours,
        hour,
        minute
      };
    } catch (error) {
      this.logger.error(`Invalid timezone: ${timezone}`, error);
      throw new Error(`Invalid timezone: ${timezone}`);
    }
  }

  async calculateDistanceBetweenLocations(
    location1Id: string,
    location2Id: string
  ): Promise<number | null> {
    const loc1 = await this.locationRepository.findOne({ where: { id: location1Id } });
    const loc2 = await this.locationRepository.findOne({ where: { id: location2Id } });

    if (!loc1 || !loc2 || !loc1.latitude || !loc1.longitude || !loc2.latitude || !loc2.longitude) {
      return null;
    }

    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(Number(loc2.latitude) - Number(loc1.latitude));
    const dLon = this.toRad(Number(loc2.longitude) - Number(loc1.longitude));
    const lat1 = this.toRad(Number(loc1.latitude));
    const lat2 = this.toRad(Number(loc2.latitude));

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in kilometers
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  async deleteLocation(id: string): Promise<void> {
    const location = await this.locationRepository.findOne({ 
      where: { id },
      relations: ['agents']
    });
    
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    // Check if there are agents assigned to this location
    if (location.agents && location.agents.length > 0) {
      const agentNames = location.agents.slice(0, 3).map(a => `${a.firstName} ${a.lastName}`).join(', ');
      const moreText = location.agents.length > 3 ? ` and ${location.agents.length - 3} more` : '';
      throw new Error(`Cannot delete location "${location.name}" - ${location.agents.length} agent(s) are assigned to it (${agentNames}${moreText}). Please reassign these agents first.`);
    }

    await this.locationRepository.remove(location);
    this.logger.log(`Deleted location: ${location.name}`);
  }

  async reassignAgentsToDepartments(): Promise<{ reassigned: number; details: any[] }> {
    const agents = await this.agentRepository.find({ relations: ['location'] });
    const details = [];
    let reassignedCount = 0;

    // Get all department-based locations
    const departmentLocations = await this.locationRepository.find({
      where: { freshserviceId: ILike('dept_%') }
    });

    for (const agent of agents) {
      const oldLocation = agent.location?.name || 'None';
      
      // Try to match agent name to a city-based location
      // This is a heuristic - agents might have city names in their data
      let newLocation = null;
      
      // Check if agent's current location is "Canada" or "Remote" and needs reassignment
      if (!agent.location || agent.location.name === 'Canada' || 
          !agent.location.freshserviceId?.startsWith('dept_')) {
        
        // Try to find a matching department location based on agent's name or other properties
        // For now, we'll assign to Remote if we can't determine
        newLocation = departmentLocations.find(loc => loc.name === 'Remote') ||
                     await this.locationRepository.findOne({ where: { freshserviceId: 'remote' } });
        
        if (newLocation && newLocation.id !== agent.location?.id) {
          agent.location = newLocation;
          await this.agentRepository.save(agent);
          reassignedCount++;
          
          details.push({
            agent: `${agent.firstName} ${agent.lastName}`,
            oldLocation,
            newLocation: newLocation.name
          });
          
          this.logger.log(`Reassigned ${agent.firstName} ${agent.lastName} from ${oldLocation} to ${newLocation.name}`);
        }
      }
    }

    return { reassigned: reassignedCount, details };
  }

  async deleteEmptyLocations(): Promise<{ deleted: number; locations: string[] }> {
    const locations = await this.locationRepository.find({ relations: ['agents'] });
    const emptyLocations = locations.filter(loc => !loc.agents || loc.agents.length === 0);
    
    const deletedNames = [];
    for (const location of emptyLocations) {
      await this.locationRepository.remove(location);
      deletedNames.push(location.name);
      this.logger.log(`Deleted empty location: ${location.name}`);
    }
    
    return {
      deleted: deletedNames.length,
      locations: deletedNames
    };
  }
}