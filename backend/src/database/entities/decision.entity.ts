import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from './agent.entity';

export enum DecisionType {
  AUTO_ASSIGNED = 'AUTO_ASSIGNED',
  SUGGESTED = 'SUGGESTED',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
  REASSIGNED = 'REASSIGNED'
}

@Entity('decisions')
export class Decision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ name: 'ticket_subject' })
  ticketSubject: string;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => Agent, agent => agent.decisions)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ type: 'enum', enum: DecisionType })
  type: DecisionType;

  @Column({ type: 'float' })
  score: number;

  @Column({ name: 'score_breakdown', type: 'jsonb' })
  scoreBreakdown: {
    skillScore: number;
    levelScore: number;
    loadScore: number;
    locationScore: number;
    vipScore: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  alternatives: Array<{
    agentId: string;
    agentName: string;
    score: number;
    scoreBreakdown: Record<string, number>;
  }>;

  @Column({ name: 'overridden_by', type: 'varchar', nullable: true })
  overriddenBy: string | null;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string | null;

  @Column({ name: 'feedback_score', type: 'int', nullable: true })
  feedbackScore: number;

  @Column({ name: 'feedback_comments', type: 'text', nullable: true })
  feedbackComments: string | null;

  @Column({ name: 'was_accepted', default: false })
  wasAccepted: boolean;

  @Column({ name: 'context_data', type: 'jsonb', nullable: true })
  contextData: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ name: 'resolution_time', nullable: true })
  resolutionTime: number;
}