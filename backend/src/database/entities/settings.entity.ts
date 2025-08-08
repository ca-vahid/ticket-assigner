import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'system' })
  category: string;

  @Column({ name: 'is_editable', default: true })
  isEditable: boolean;

  @Column({ name: 'last_modified_by', nullable: true })
  lastModifiedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export const DEFAULT_SETTINGS = [
  {
    key: 'scoring.weights',
    value: {
      skillOverlap: 0.30,
      levelCloseness: 0.25,
      loadBalance: 0.25,
      locationFit: 0.10,
      vipAffinity: 0.10
    },
    description: 'Scoring algorithm weight distribution',
    category: 'scoring'
  },
  {
    key: 'assignment.autoAssignEnabled',
    value: false,
    description: 'Enable automatic ticket assignment',
    category: 'assignment'
  },
  {
    key: 'assignment.maxSuggestionsCount',
    value: 3,
    description: 'Maximum number of agent suggestions to provide',
    category: 'assignment'
  },
  {
    key: 'assignment.minScoreThreshold',
    value: 0.5,
    description: 'Minimum score required for agent eligibility',
    category: 'assignment'
  },
  {
    key: 'sync.intervalHours',
    value: 1,
    description: 'Hours between data synchronization runs',
    category: 'sync'
  },
  {
    key: 'notifications.enabled',
    value: true,
    description: 'Enable notification system',
    category: 'notifications'
  }
];