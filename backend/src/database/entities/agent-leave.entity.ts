import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, Index, JoinColumn } from 'typeorm';
import { Agent } from './agent.entity';

export enum LeaveType {
  WFH = 'WFH',
  SITE_VISIT = 'Site Visit',
  TRAINING = 'Training & Conferences',
  TRAINING_HOURLY = 'Training & Conferences (Hourly)',
  SICK_DAY = 'Sick Day',
  SICK_DAY_HOURLY = 'Sick Day (Hourly)',
  VACATION = 'Vacation',
  PTO = 'Personal Time Off (PTO)',
  PTO_HOURLY = 'Personal Time Off (PTO) (Hourly)'
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

@Entity('agent_leaves')
@Index(['agent', 'startDate', 'endDate'])
@Index(['leaveType', 'status'])
export class AgentLeave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vacation_tracker_id', nullable: true })
  vacationTrackerId: string;

  @ManyToOne(() => Agent, agent => agent.leaves, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({
    name: 'leave_type',
    type: 'enum',
    enum: LeaveType
  })
  leaveType: LeaveType;

  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.APPROVED
  })
  status: LeaveStatus;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'is_all_day', default: false })
  isAllDay: boolean;

  @Column({ type: 'float', nullable: true })
  duration: number; // in hours for hourly leave types

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  notes: string;

  // Determines if agent is available during this leave
  @Column({ name: 'is_available_for_work', default: false })
  isAvailableForWork: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    source?: 'vacation_tracker' | 'manual' | 'import';
    originalData?: any;
    lastSyncAt?: Date;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// Helper function to determine if leave type makes agent unavailable
export function isLeaveTypeUnavailable(leaveType: LeaveType): boolean {
  const unavailableTypes = [
    LeaveType.VACATION,
    LeaveType.PTO,
    LeaveType.PTO_HOURLY,
    LeaveType.SICK_DAY,
    LeaveType.SICK_DAY_HOURLY
  ];
  
  return unavailableTypes.includes(leaveType);
}

// Helper function to determine if agent is available during specific leave
export function isAgentAvailableDuringLeave(leaveType: LeaveType): boolean {
  const availableTypes = [
    LeaveType.WFH,
    LeaveType.SITE_VISIT,
    LeaveType.TRAINING,
    LeaveType.TRAINING_HOURLY
  ];
  
  return availableTypes.includes(leaveType);
}