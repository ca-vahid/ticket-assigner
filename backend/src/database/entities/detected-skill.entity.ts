import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from './agent.entity';
import { SkillDetectionMethod } from './skill-detection-config.entity';

export enum DetectedSkillStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  AUTO_APPLIED = 'AUTO_APPLIED'
}

export enum SkillType {
  MANUAL = 'MANUAL',
  CATEGORY = 'CATEGORY',
  GROUP = 'GROUP',
  PATTERN = 'PATTERN',
  LLM = 'LLM'
}

@Entity('detected_skills')
export class DetectedSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ name: 'agent_id' })
  agentId: string;

  @Column({ name: 'skill_name' })
  skillName: string;

  @Column({ name: 'skill_type', type: 'enum', enum: SkillType })
  skillType: SkillType;

  @Column({ name: 'detection_method', type: 'enum', enum: SkillDetectionMethod })
  detectionMethod: SkillDetectionMethod;

  @Column({ type: 'float', nullable: true })
  confidence: number; // 0-1 confidence score

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    // For CATEGORY_BASED
    ticketCount?: number;
    categories?: string[];
    complexityScore?: number;
    dateRange?: { from: Date; to: Date };
    
    // For GROUP_MEMBERSHIP
    groupName?: string;
    
    // For PATTERN
    patternType?: string;
    frequency?: number;
    
    // For LLM
    llmReasoning?: string;
    sampleTickets?: string[];
  };

  @Column({ type: 'enum', enum: DetectedSkillStatus, default: DetectedSkillStatus.PENDING })
  status: DetectedSkillStatus;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string; // User who approved/rejected

  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'review_notes', nullable: true })
  reviewNotes: string;

  @CreateDateColumn({ name: 'detected_at' })
  detectedAt: Date;
  
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'is_active', default: false })
  isActive: boolean; // Whether skill is currently active on agent
}