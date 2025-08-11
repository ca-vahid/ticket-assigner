import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SkillDetectionMethod {
  CATEGORY_BASED = 'CATEGORY_BASED',
  GROUP_MEMBERSHIP = 'GROUP_MEMBERSHIP', 
  RESOLUTION_PATTERNS = 'RESOLUTION_PATTERNS',
  TEXT_ANALYSIS_LLM = 'TEXT_ANALYSIS_LLM'
}

@Entity('skill_detection_config')
export class SkillDetectionConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SkillDetectionMethod })
  method: SkillDetectionMethod;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  settings: {
    // For CATEGORY_BASED
    minimumTickets?: number; // Default 5
    lookbackTickets?: number; // Default 1000
    includeComplexity?: boolean; // Weight by priority/complexity
    
    // For GROUP_MEMBERSHIP
    groupSkillMappings?: Record<string, string[]>;
    
    // For RESOLUTION_PATTERNS
    frequencyThreshold?: number;
    
    // For TEXT_ANALYSIS_LLM
    llmModel?: string;
    batchSize?: number;
    keywordMappings?: Record<string, string[]>;
  };

  @Column({ name: 'last_run_at', nullable: true })
  lastRunAt: Date;

  @Column({ name: 'last_run_status', nullable: true })
  lastRunStatus: string;

  @Column({ name: 'last_run_stats', type: 'jsonb', nullable: true })
  lastRunStats: {
    agentsProcessed?: number;
    skillsDetected?: number;
    errors?: string[];
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}