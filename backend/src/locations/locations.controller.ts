import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete,
  Param, 
  Body, 
  Query,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { Location } from '../database/entities/location.entity';

@ApiTags('locations')
@Controller('api/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all locations' })
  @ApiResponse({ status: 200, description: 'List of locations' })
  async getLocations(
    @Query('active') active?: boolean,
    @Query('includeRemote') includeRemote?: boolean
  ): Promise<Location[]> {
    return this.locationsService.getLocations({ active, includeRemote });
  }

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get location statistics' })
  @ApiResponse({ status: 200, description: 'Location statistics' })
  async getLocationStats(): Promise<any> {
    return this.locationsService.getLocationStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiResponse({ status: 200, description: 'Location details' })
  async getLocation(@Param('id') id: string): Promise<Location> {
    const location = await this.locationsService.getLocationById(id);
    if (!location) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }
    return location;
  }

  @Get(':id/agents')
  @ApiOperation({ summary: 'Get agents in a location' })
  @ApiResponse({ status: 200, description: 'List of agents in location' })
  async getLocationAgents(@Param('id') id: string): Promise<any[]> {
    return this.locationsService.getLocationAgents(id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync locations from Freshservice' })
  @ApiResponse({ status: 200, description: 'Sync results' })
  async syncLocations(): Promise<{ synced: number; created: number; updated: number }> {
    return this.locationsService.syncLocationsFromFreshservice();
  }

  @Get('timezone/:timezone/current-time')
  @ApiOperation({ summary: 'Get current time in a timezone' })
  @ApiResponse({ status: 200, description: 'Current time info' })
  async getCurrentTime(@Param('timezone') timezone: string): Promise<any> {
    return this.locationsService.getCurrentTimeInTimezone(timezone);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update location details' })
  @ApiResponse({ status: 200, description: 'Updated location' })
  async updateLocation(
    @Param('id') id: string,
    @Body() updates: Partial<Location>
  ): Promise<Location> {
    return this.locationsService.updateLocation(id, updates);
  }

  @Post(':id/set-office-hours')
  @ApiOperation({ summary: 'Set office hours for a location' })
  @ApiResponse({ status: 200, description: 'Updated location' })
  async setOfficeHours(
    @Param('id') id: string,
    @Body() officeHours: {
      start: string;
      end: string;
      days: string[];
    }
  ): Promise<Location> {
    return this.locationsService.setOfficeHours(id, officeHours);
  }

  @Post('reassign-agents')
  @ApiOperation({ summary: 'Reassign all agents to department-based locations' })
  @ApiResponse({ status: 200, description: 'Agents reassigned' })
  async reassignAgentsToDepartments(): Promise<{ success: boolean; reassigned: number; details: any[] }> {
    const result = await this.locationsService.reassignAgentsToDepartments();
    return { success: true, ...result };
  }

  @Delete('cleanup/empty')
  @ApiOperation({ summary: 'Delete all locations with no agents' })
  @ApiResponse({ status: 200, description: 'Empty locations deleted' })
  async deleteEmptyLocations(): Promise<{ success: boolean; deleted: number; locations: string[] }> {
    const result = await this.locationsService.deleteEmptyLocations();
    return { success: true, ...result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a location' })
  @ApiResponse({ status: 200, description: 'Location deleted successfully' })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async deleteLocation(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    await this.locationsService.deleteLocation(id);
    return { success: true, message: 'Location deleted successfully' };
  }
}