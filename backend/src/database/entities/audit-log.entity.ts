import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditLogType {
  DELETE = 'delete',
  CREATE = 'create',
  UPDATE = 'update',
  RESET = 'reset',
  EXPORT = 'export',
  IMPORT = 'import',
  SYNC = 'sync',
  SETTINGS = 'settings'
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  action: string;

  @Column({ 
    type: 'enum',
    enum: AuditLogType,
    default: AuditLogType.UPDATE
  })
  type: AuditLogType;

  @Column({ type: 'varchar', length: 255 })
  user: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100, nullable: true })
  entityType?: string; // e.g., 'agent', 'assignment', 'settings'

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId?: string; // ID of the affected entity

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // Additional data like count of deleted items

  @Column({ name: 'ip_address', type: 'varchar', length: 50, nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  timestamp: Date;
}