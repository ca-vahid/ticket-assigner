import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Agent } from './agent.entity';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'freshservice_id', unique: true })
  freshserviceId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ name: 'postal_code', nullable: true })
  postalCode?: string;

  @Column()
  timezone: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    officeHours?: {
      start: string; // e.g., "09:00"
      end: string;   // e.g., "17:00"
      days: string[]; // e.g., ["Monday", "Tuesday", ...]
    };
    isRemote?: boolean;
    capacity?: number;
    supportTypes?: string[]; // e.g., ["onsite", "remote", "hybrid"]
    primaryContact?: string;
    phoneNumber?: string;
  };

  @OneToMany(() => Agent, agent => agent.location)
  agents?: Agent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}