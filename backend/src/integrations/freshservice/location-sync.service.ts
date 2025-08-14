import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../../database/entities/location.entity';
import { FreshserviceService } from './freshservice.service';
import { AxiosInstance } from 'axios';

@Injectable()
export class LocationSyncService {
  private readonly logger = new Logger(LocationSyncService.name);
  private apiClient: AxiosInstance;

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private freshserviceService: FreshserviceService,
  ) {
    // Use the same API client as FreshserviceService
    this.apiClient = this.freshserviceService['apiClient'];
  }

  /**
   * Fetch all unique departments from agents (these are the actual office locations)
   */
  async fetchLocations(): Promise<any[]> {
    try {
      // Fetch all agents to extract unique departments
      const agents = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.apiClient.get('/agents', {
          params: { page, per_page: 100 }
        });
        
        if (response.data.agents) {
          agents.push(...response.data.agents);
          hasMore = response.data.agents.length === 100;
        } else {
          hasMore = false;
        }
        page++;
      }

      // Extract unique departments (these are the actual office locations)
      const departmentMap = new Map<string, any>();
      
      for (const agent of agents) {
        if (agent.department_names && agent.department_names.length > 0) {
          // Use the first department as the primary location
          const deptName = agent.department_names[0];
          
          if (!departmentMap.has(deptName)) {
            // Get the actual location info if available
            const locationInfo = agent.location_name || '';
            
            departmentMap.set(deptName, {
              id: `dept_${deptName.toLowerCase().replace(/\s+/g, '_')}`, // Create a unique ID
              name: deptName,
              country: locationInfo.includes('Canada') ? 'Canada' : 
                      locationInfo.includes('US') || locationInfo.includes('United States') ? 'United States' : 
                      'Canada', // Default to Canada as most are there
              agent_count: 1
            });
          } else {
            // Increment agent count for this department
            const dept = departmentMap.get(deptName);
            dept.agent_count++;
          }
        }
      }

      const departments = Array.from(departmentMap.values());
      this.logger.log(`Found ${departments.length} unique departments (locations) from ${agents.length} agents`);
      return departments;
    } catch (error) {
      this.logger.error('Failed to fetch departments from Freshservice', error);
      throw error;
    }
  }

  /**
   * Sync locations from Freshservice to database
   */
  async syncLocations(): Promise<{ synced: number; created: number; updated: number }> {
    try {
      const departments = await this.fetchLocations();
      let created = 0;
      let updated = 0;

      for (const dept of departments) {
        let location = await this.locationRepository.findOne({
          where: { freshserviceId: dept.id }
        });

        // Determine if this is a Canadian city
        const canadianCities = ['Calgary', 'Edmonton', 'Vancouver', 'Toronto', 'Montreal', 'Ottawa', 'Winnipeg', 'Halifax'];
        const isCanadianCity = canadianCities.some(city => dept.name.includes(city));
        
        // Extract city name (department name is usually the city)
        const cityName = dept.name;
        
        const locationData = {
          freshserviceId: dept.id,
          name: cityName,
          city: cityName,
          country: isCanadianCity || dept.country === 'Canada' ? 'Canada' : dept.country,
          timezone: this.mapTimezone({ city: cityName, name: cityName }),
          isActive: true,
          metadata: {
            officeHours: this.extractOfficeHours(dept),
            isRemote: cityName.toLowerCase().includes('remote'),
            supportTypes: this.determineSupportTypes({ name: cityName }),
            agentCount: dept.agent_count
          }
        };

        if (!location) {
          location = this.locationRepository.create(locationData);
          await this.locationRepository.save(location);
          created++;
          this.logger.log(`Created location: ${location.name}, ${location.country}`);
        } else {
          Object.assign(location, locationData);
          await this.locationRepository.save(location);
          updated++;
          this.logger.log(`Updated location: ${location.name}, ${location.country}`);
        }
      }

      this.logger.log(`Location sync completed: ${created} created, ${updated} updated`);
      return { synced: departments.length, created, updated };
    } catch (error) {
      this.logger.error('Location sync failed', error);
      throw error;
    }
  }

  /**
   * Get location details by Freshservice ID
   */
  async getLocationByFreshserviceId(freshserviceId: string): Promise<Location | null> {
    return this.locationRepository.findOne({
      where: { freshserviceId }
    });
  }

  /**
   * Map timezone from Freshservice location data
   */
  private mapTimezone(fsLocation: any): string {
    // Map based on city/state or use default
    const timezoneMap: Record<string, string> = {
      'Vancouver': 'America/Vancouver',
      'Toronto': 'America/Toronto',
      'Montreal': 'America/Montreal',
      'Calgary': 'America/Edmonton',
      'New York': 'America/New_York',
      'Los Angeles': 'America/Los_Angeles',
      'Chicago': 'America/Chicago',
      'London': 'Europe/London',
      'Paris': 'Europe/Paris',
      'Tokyo': 'Asia/Tokyo',
      'Sydney': 'Australia/Sydney'
    };

    // Try to match city
    if (fsLocation.city) {
      for (const [city, tz] of Object.entries(timezoneMap)) {
        if (fsLocation.city.includes(city)) {
          return tz;
        }
      }
    }

    // Default to timezone from Freshservice or America/Toronto
    return fsLocation.time_zone || 'America/Toronto';
  }

  /**
   * Extract office hours from location data
   */
  private extractOfficeHours(fsLocation: any) {
    // Default office hours if not specified
    return {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };
  }

  /**
   * Determine support types based on location
   */
  private determineSupportTypes(fsLocation: any): string[] {
    const types = [];
    
    if (fsLocation.name?.toLowerCase().includes('remote')) {
      types.push('remote');
    } else {
      types.push('onsite');
    }

    // All locations can provide remote support
    if (!types.includes('remote')) {
      types.push('remote');
    }

    return types;
  }
}