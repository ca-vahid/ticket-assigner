// Temporary safe version of Agent entity that works without new columns
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Decision } from './decision.entity';
import { Category } from './category.entity';

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
export class AgentSafe {
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

  @Column('text', { array: true, nullable: true })
  skills: string[];

  // These are the new columns - they may not exist in DB yet
  categorySkills?: string[];
  autoDetectedSkills?: string[];
  skillMetadata?: any;
  lastSkillDetectionAt?: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  timezone: string;

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

  @Column({ name: 'satisfaction_score', type: 'float', nullable: true })
  satisfactionScore: number;

  @OneToMany(() => Decision, decision => decision.agent)
  decisions: Decision[];

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