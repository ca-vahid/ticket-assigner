import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from './agent.entity';

export enum SkillAuditAction {
  SKILL_DETECTED = 'SKILL_DETECTED',
  SKILL_APPROVED = 'SKILL_APPROVED',
  SKILL_REJECTED = 'SKILL_REJECTED',
  SKILL_ADDED = 'SKILL_ADDED',
  SKILL_REMOVED = 'SKILL_REMOVED',
  SKILL_MODIFIED = 'SKILL_MODIFIED',
  BULK_DETECTION_RUN = 'BULK_DETECTION_RUN'
}

@Entity('skill_audit_logs')
export class SkillAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ name: 'agent_id', nullable: true })
  agentId: string;

  @Column({ type: 'enum', enum: SkillAuditAction })
  action: SkillAuditAction;

  @Column({ name: 'skill_name', nullable: true })
  skillName: string;

  @Column({ name: 'previous_value', type: 'jsonb', nullable: true })
  previousValue: any;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    detectionMethod?: string;
    confidence?: number;
    ticketCount?: number;
    source?: string;
    reason?: string;
    affectedAgents?: number;
    skillsDetected?: number;
    errors?: string[];
  };

  @Column({ nullable: true })
  performedBy: string; // User or 'SYSTEM'

  @CreateDateColumn()
  createdAt: Date;
}