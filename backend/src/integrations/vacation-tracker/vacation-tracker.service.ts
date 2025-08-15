import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { Agent } from '../../database/entities/agent.entity';
import { AgentLeave, LeaveType, LeaveStatus, isAgentAvailableDuringLeave } from '../../database/entities/agent-leave.entity';
import { addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface VacationTrackerLeave {
  id: string;
  userId: string;
  approverId?: string;
  autoApproved?: boolean;
  durationCalendarDays: number;
  durationWorkingDays: number;
  startDate: string;
  endDate: string;
  isFullDayLeave: boolean;
  startHour?: number;
  endHour?: number;
  startMinute?: number;
  endMinute?: number;
  leaveTypeId: string;
  locationId?: string;
  departmentId?: string;
  status: string;
  createdAt: string;
  leaveType?: {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    isAdmin: boolean;
    locationId?: string;
    departmentId?: string;
    labels?: string[];
    status: string;
    employeeId?: string;
  };
}

interface VacationTrackerUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

@Injectable()
export class VacationTrackerService {
  private readonly logger = new Logger(VacationTrackerService.name);
  private client: AxiosInstance;
  private apiKey: string;
  private apiUrl: string;
  private organizationId: string | null;
  private leaveTypesCache: Map<string, string> = new Map(); // Cache leave type ID to name mapping

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(AgentLeave)
    private agentLeaveRepository: Repository<AgentLeave>,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('VACATION_TRACKER_API_KEY', '');
    this.apiUrl = this.configService.get<string>('VACATION_TRACKER_API_URL', 'https://api.vacationtracker.io/api');
    this.organizationId = this.configService.get<string>('VACATION_TRACKER_ORG_ID', null);

    if (this.apiKey) {
      this.client = axios.create({
        baseURL: this.apiUrl,
        headers: {
          'X-Api-Key': this.apiKey, // Vacation Tracker uses X-Api-Key header
          'Content-Type': 'application/json',
        },
      });
    } else {
      this.logger.warn('Vacation Tracker API key not configured');
    }
  }

  /**
   * Map Vacation Tracker leave type to our internal leave type
   */
  private mapLeaveType(leaveTypeName: string): LeaveType {
    if (!leaveTypeName) return LeaveType.PTO;
    
    const mapping: Record<string, LeaveType> = {
      'wfh': LeaveType.WFH,
      'work from home': LeaveType.WFH,
      'remote work': LeaveType.WFH,
      'working from home': LeaveType.WFH,
      'site visit': LeaveType.SITE_VISIT,
      'training': LeaveType.TRAINING,
      'training & conferences': LeaveType.TRAINING,
      'conference': LeaveType.TRAINING,
      'training hourly': LeaveType.TRAINING_HOURLY,
      'sick': LeaveType.SICK_DAY,
      'sick day': LeaveType.SICK_DAY,
      'sick leave': LeaveType.SICK_DAY,
      'illness': LeaveType.SICK_DAY,
      'sick hourly': LeaveType.SICK_DAY_HOURLY,
      'vacation': LeaveType.VACATION,
      'holiday': LeaveType.VACATION,
      'annual leave': LeaveType.VACATION,
      'pto': LeaveType.PTO,
      'personal time off': LeaveType.PTO,
      'personal': LeaveType.PTO,
      'pto hourly': LeaveType.PTO_HOURLY,
    };

    const normalizedType = leaveTypeName.toLowerCase().trim();
    return mapping[normalizedType] || LeaveType.PTO;
  }

  /**
   * Sync leave data from Vacation Tracker
   */
  async syncLeaveData(): Promise<{
    success: boolean;
    synced: number;
    updated: number;
    errors: string[];
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        synced: 0,
        updated: 0,
        errors: ['Vacation Tracker API not configured'],
      };
    }

    const errors: string[] = [];
    let synced = 0;
    let updated = 0;

    try {
      this.logger.log('Starting Vacation Tracker sync...');

      // Get all users from Vacation Tracker
      const users = await this.fetchUsers();
      this.logger.log(`Fetched ${users.length} users from Vacation Tracker`);

      // For now, we'll sync user data and mark users as available/unavailable based on their status
      // The leaves endpoint appears to have issues, so we'll handle that separately
      
      // Create email to agent mapping
      const agents = await this.agentRepository.find();
      const agentByEmail = new Map(agents.map(a => [a.email.toLowerCase(), a]));

      // Process each user to update agent status
      for (const user of users) {
        try {
          const agent = agentByEmail.get(user.email.toLowerCase());
          if (!agent) {
            this.logger.debug(`No agent found for email: ${user.email}`);
            continue;
          }

          // Update agent with user info
          agent.lastVacationTrackerSync = new Date();
          
          // Check if user has any status indicators (you may need to adjust based on actual API)
          if (user.status !== 'ACTIVE') {
            agent.isAvailable = false;
          }
          
          await this.agentRepository.save(agent);
          updated++;
        } catch (error) {
          const errorMsg = `Failed to process user ${user.id}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`Vacation Tracker sync completed. Updated: ${updated} agents`);

      // Fetch leave types first to get proper mapping
      await this.fetchLeaveTypes();

      // Fetch and process leave data
      try {
        const startDate = new Date();
        const endDate = addDays(startDate, 30);
        const leaves = await this.fetchLeaves(startDate, endDate);
        
        if (leaves && leaves.length > 0) {
          this.logger.log(`Processing ${leaves.length} leave records...`);
          
          // Process each leave record
          for (const leave of leaves) {
            try {
              // Get user email from expanded user data or match by ID
              const userEmail = leave.user?.email;
              if (!userEmail) {
                this.logger.debug(`No email found for leave ${leave.id}`);
                continue;
              }
              
              const agent = agentByEmail.get(userEmail.toLowerCase());
              if (!agent) {
                this.logger.debug(`No agent found for email: ${userEmail}`);
                continue;
              }

              // Check if leave already exists
              let agentLeave = await this.agentLeaveRepository.findOne({
                where: {
                  vacationTrackerId: leave.id,
                },
              });

              // Map leave type from cached types or the leaveType object
              let leaveTypeName = leave.leaveType?.name;
              if (!leaveTypeName && leave.leaveTypeId) {
                leaveTypeName = this.leaveTypesCache.get(leave.leaveTypeId);
              }
              if (!leaveTypeName) {
                leaveTypeName = 'PTO'; // Default fallback
              }
              
              this.logger.debug(`Processing leave for ${userEmail}: ${leaveTypeName} (${leave.startDate} to ${leave.endDate})`);
              const leaveType = this.mapLeaveType(leaveTypeName);
              const isAvailable = isAgentAvailableDuringLeave(leaveType);

              if (agentLeave) {
                // Update existing leave
                agentLeave.leaveType = leaveType;
                agentLeave.startDate = new Date(leave.startDate);
                agentLeave.endDate = new Date(leave.endDate);
                agentLeave.status = this.mapLeaveStatus(leave.status);
                agentLeave.isAllDay = leave.isFullDayLeave;
                agentLeave.duration = leave.durationWorkingDays;
                agentLeave.isAvailableForWork = isAvailable;
                agentLeave.metadata = {
                  ...agentLeave.metadata,
                  originalData: leave,
                  leaveTypeName: leaveTypeName,
                  lastSyncAt: new Date(),
                };
                await this.agentLeaveRepository.save(agentLeave);
                updated++;
              } else {
                // Create new leave
                agentLeave = this.agentLeaveRepository.create({
                  vacationTrackerId: leave.id,
                  agent,
                  leaveType,
                  startDate: new Date(leave.startDate),
                  endDate: new Date(leave.endDate),
                  status: this.mapLeaveStatus(leave.status),
                  isAllDay: leave.isFullDayLeave,
                  duration: leave.durationWorkingDays,
                  isAvailableForWork: isAvailable,
                  metadata: {
                    source: 'vacation_tracker',
                    originalData: leave,
                    leaveTypeName: leaveTypeName,
                    lastSyncAt: new Date(),
                  },
                });
                await this.agentLeaveRepository.save(agentLeave);
                synced++;
              }
            } catch (error) {
              const errorMsg = `Failed to process leave ${leave.id}: ${error.message}`;
              this.logger.error(errorMsg);
              errors.push(errorMsg);
            }
          }
          
          // Update agent PTO status based on current leaves
          await this.updateAgentPtoStatus();
        }
      } catch (leaveError) {
        this.logger.warn('Could not fetch leave data:', leaveError.message);
        errors.push('Could not fetch leave data. Check API configuration.');
      }

      return {
        success: true,
        synced,     // New leave records created
        updated,    // Existing records updated
        errors: errors.length > 0 ? errors : [],
      };
    } catch (error) {
      this.logger.error('Vacation Tracker sync failed:', error);
      return {
        success: false,
        synced,
        updated,
        errors: [...errors, error.message],
      };
    }
  }

  /**
   * Fetch leave types from Vacation Tracker
   */
  private async fetchLeaveTypes(): Promise<void> {
    try {
      const response = await this.client.get('/leave-types');
      
      if (response.data && response.data.status === 'ok') {
        const leaveTypes = response.data.data || [];
        this.leaveTypesCache.clear();
        
        for (const leaveType of leaveTypes) {
          this.leaveTypesCache.set(leaveType.id, leaveType.name);
          this.logger.debug(`Cached leave type: ${leaveType.id} => ${leaveType.name}`);
        }
        
        this.logger.log(`Cached ${this.leaveTypesCache.size} leave types`);
      }
    } catch (error) {
      this.logger.error('Failed to fetch leave types:', error.response?.data || error.message);
    }
  }

  /**
   * Fetch users from Vacation Tracker
   */
  private async fetchUsers(): Promise<VacationTrackerUser[]> {
    try {
      // The API uses /v1/users endpoint with X-Api-Key header
      const response = await this.client.get('/users');
      
      // The API returns { status: "ok", data: [...users...] }
      if (response.data && response.data.status === 'ok') {
        return response.data.data || [];
      }
      
      // Fallback to direct data if status field not present
      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch users from Vacation Tracker:', error);
      throw error;
    }
  }

  /**
   * Fetch leaves from Vacation Tracker
   */
  private async fetchLeaves(startDate: Date, endDate: Date): Promise<VacationTrackerLeave[]> {
    try {
      // Use the correct API parameters according to documentation
      const params = {
        startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        endDate: endDate.toISOString().split('T')[0],     // YYYY-MM-DD format
        status: 'APPROVED',  // Only get approved leaves
        expand: 'user,leaveType', // Expand user and leave type info
        limit: '500' // Get up to 500 leave records
      };
      
      this.logger.debug('Fetching leaves with params:', params);
      const response = await this.client.get('/leaves', { params });
      
      // The API returns { status: "ok", data: [...], nextToken: "..." }
      if (response.data && response.data.status === 'ok') {
        this.logger.log(`Fetched ${response.data.data?.length || 0} leave records from Vacation Tracker`);
        return response.data.data || [];
      }
      
      // Fallback to direct data if status field not present
      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to fetch leaves from Vacation Tracker:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Map Vacation Tracker status to our internal status
   */
  private mapLeaveStatus(vtStatus: string): LeaveStatus {
    // According to API docs: APPROVED, OPEN, DENIED, CANCELLED, EXPIRED, DELETED
    const mapping: Record<string, LeaveStatus> = {
      'approved': LeaveStatus.APPROVED,
      'open': LeaveStatus.PENDING,
      'pending': LeaveStatus.PENDING,
      'denied': LeaveStatus.REJECTED,
      'rejected': LeaveStatus.REJECTED,
      'cancelled': LeaveStatus.CANCELLED,
      'expired': LeaveStatus.CANCELLED,
      'deleted': LeaveStatus.CANCELLED,
    };
    return mapping[vtStatus.toLowerCase()] || LeaveStatus.APPROVED;
  }

  /**
   * Update agent PTO status based on current date
   */
  async updateAgentPtoStatus(): Promise<void> {
    const now = new Date();
    const agents = await this.agentRepository.find({
      relations: ['leaves'],
    });

    for (const agent of agents) {
      const currentLeaves = agent.leaves.filter(leave => {
        return (
          leave.status === LeaveStatus.APPROVED &&
          isWithinInterval(now, {
            start: startOfDay(leave.startDate),
            end: endOfDay(leave.endDate),
          })
        );
      });

      if (currentLeaves.length > 0) {
        // Agent is on leave
        const unavailableLeave = currentLeaves.find(
          leave => !leave.isAvailableForWork
        );

        if (unavailableLeave) {
          // Agent is on PTO/unavailable leave
          agent.isPto = true;
          agent.currentLeaveType = unavailableLeave.leaveType;
          agent.ptoStartDate = unavailableLeave.startDate;
          agent.ptoEndDate = unavailableLeave.endDate;
          agent.isAvailable = false;
        } else {
          // Agent is on available leave (WFH, Training, etc.)
          agent.isPto = false;
          agent.currentLeaveType = currentLeaves[0].leaveType;
          agent.ptoStartDate = currentLeaves[0].startDate;
          agent.ptoEndDate = currentLeaves[0].endDate;
          // Keep availability as is (WFH agents are still available)
        }
      } else {
        // Agent is not on leave
        agent.isPto = false;
        agent.currentLeaveType = null;
        agent.ptoStartDate = null;
        agent.ptoEndDate = null;
      }

      await this.agentRepository.save(agent);
    }
  }

  /**
   * Get agents on PTO for a specific date range
   */
  async getAgentsOnPto(startDate?: Date, endDate?: Date): Promise<string[]> {
    const start = startDate || new Date();
    const end = endDate || new Date();

    const leaves = await this.agentLeaveRepository.find({
      where: {
        status: LeaveStatus.APPROVED,
        isAvailableForWork: false,
        startDate: Between(
          startOfDay(start),
          endOfDay(end)
        ),
      },
      relations: ['agent'],
    });

    return [...new Set(leaves.map(leave => leave.agent.id))];
  }

  /**
   * Check if a specific agent is on PTO
   */
  async isAgentOnPto(agentId: string, date?: Date): Promise<boolean> {
    const checkDate = date || new Date();

    const leave = await this.agentLeaveRepository.findOne({
      where: {
        agent: { id: agentId },
        status: LeaveStatus.APPROVED,
        isAvailableForWork: false,
      },
      relations: ['agent'],
    });

    if (!leave) return false;

    return isWithinInterval(checkDate, {
      start: startOfDay(leave.startDate),
      end: endOfDay(leave.endDate),
    });
  }

  /**
   * Get upcoming leaves for an agent
   */
  async getAgentUpcomingLeaves(agentId: string): Promise<AgentLeave[]> {
    const today = startOfDay(new Date());

    return this.agentLeaveRepository.find({
      where: {
        agent: { id: agentId },
        status: LeaveStatus.APPROVED,
        startDate: Between(today, addDays(today, 30)),
      },
      order: {
        startDate: 'ASC',
      },
    });
  }
}