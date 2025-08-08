import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany } from 'typeorm';
import { Agent } from './agent.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'freshservice_id', unique: true })
  freshserviceId: string;

  @Column()
  name: string;

  @Column({ name: 'display_id', nullable: true })
  displayId: number;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'required_skills', type: 'jsonb', default: '[]' })
  requiredSkills: any;

  @Column({ name: 'priority_level', nullable: true })
  priorityLevel: string;

  @Column({ name: 'average_resolution_time', type: 'int', nullable: true })
  averageResolutionTime: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToMany(() => Agent, agent => agent.specializations)
  specialists: Agent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}