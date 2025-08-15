import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany, JoinTable, ManyToOne, JoinColumn } from 'typeorm';
import { Decision } from './decision.entity';
import { Category } from './category.entity';
import { Location } from './location.entity';
import { AgentLeave } from './agent-leave.entity';

export enum AgentLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  MANAGER = 'MANAGER'
}

export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE'
}

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'freshservice_id', unique: true })
  freshserviceId: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column()
  email: string;

  @Column({ name: 'experience_level', nullable: true })
  experienceLevel: string;

  @Column({ type: 'enum', enum: AgentLevel, default: AgentLevel.L1 })
  level: AgentLevel;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ name: 'manually_deactivated', default: false })
  manuallyDeactivated: boolean;

  @Column('text', { array: true, nullable: true })
  skills: string[];

  @Column('text', { array: true, nullable: true, name: 'category_skills', default: () => "'{}'" })
  categorySkills?: string[]; // Auto-detected from ticket categories

  @Column('text', { array: true, nullable: true, name: 'auto_detected_skills', default: () => "'{}'" })
  autoDetectedSkills?: string[]; // All auto-detected skills (from various sources)

  @Column({ type: 'jsonb', nullable: true, name: 'skill_metadata', default: {} })
  skillMetadata?: {
    manual?: string[];
    category?: { skill: string; confidence: number; ticketCount: number }[];
    group?: string[];
    pattern?: { skill: string; confidence: number }[];
    llm?: { skill: string; confidence: number; reasoning?: string }[];
  };

  @ManyToOne(() => Location, location => location.agents, { eager: true })
  @JoinColumn({ name: 'location_id' })
  location?: Location;

  @Column({ nullable: true })
  timezone: string;

  @Column({ name: 'is_remote', default: false })
  isRemote: boolean;

  @Column({ name: 'current_ticket_count', default: 0 })
  currentTicketCount: number;

  @Column({ name: 'weighted_ticket_count', type: 'decimal', precision: 5, scale: 2, default: 0 })
  weightedTicketCount: number;

  @Column({ name: 'ticket_workload_breakdown', type: 'jsonb', nullable: true })
  ticketWorkloadBreakdown: {
    fresh: number;
    recent: number;
    stale: number;
    abandoned: number;
  };

  @Column({ name: 'max_concurrent_tickets', default: 5 })
  maxConcurrentTickets: number;

  @Column({ name: 'total_assignments', default: 0 })
  totalAssignments: number;



  @Column({ name: 'expertise_areas', type: 'jsonb', nullable: true })
  expertiseAreas: any;

  @Column({ name: 'average_resolution_time', type: 'int', nullable: true })
  averageResolutionTime: number;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  @Column({ name: 'last_skill_detection_at', nullable: true })
  lastSkillDetectionAt?: Date;

  @Column({ name: 'satisfaction_score', type: 'float', nullable: true })
  satisfactionScore: number;

  // PTO and Leave tracking
  @Column({ name: 'is_pto', default: false })
  isPto: boolean;

  @Column({ name: 'current_leave_type', nullable: true })
  currentLeaveType: string;

  @Column({ name: 'pto_start_date', type: 'timestamp', nullable: true })
  ptoStartDate: Date;

  @Column({ name: 'pto_end_date', type: 'timestamp', nullable: true })
  ptoEndDate: Date;

  @Column({ name: 'last_vacation_tracker_sync', type: 'timestamp', nullable: true })
  lastVacationTrackerSync: Date;

  @OneToMany(() => Decision, decision => decision.agent)
  decisions: Decision[];

  @OneToMany(() => AgentLeave, leave => leave.agent)
  leaves: AgentLeave[];

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'agent_categories',
    joinColumn: { name: 'agent_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' }
  })
  specializations: Category[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
