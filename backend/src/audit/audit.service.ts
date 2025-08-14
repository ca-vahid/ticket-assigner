import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditLogType } from '../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async logAction(
    action: string,
    type: AuditLogType,
    user: string,
    metadata?: {
      entityType?: string;
      entityId?: string;
      ipAddress?: string;
      [key: string]: any;
    }
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      action,
      type,
      user,
      entityType: metadata?.entityType,
      entityId: metadata?.entityId,
      ipAddress: metadata?.ipAddress,
      metadata: metadata ? { ...metadata } : undefined,
    });

    const saved = await this.auditLogRepository.save(auditLog);
    this.logger.log(`Audit log created: ${action} by ${user}`);
    return saved;
  }

  async getAuditLogs(
    limit = 100,
    offset = 0,
    filters?: {
      type?: AuditLogType;
      user?: string;
      entityType?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters?.type) {
      query.andWhere('audit.type = :type', { type: filters.type });
    }

    if (filters?.user) {
      query.andWhere('audit.user = :user', { user: filters.user });
    }

    if (filters?.entityType) {
      query.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters?.startDate) {
      query.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    }

    const [logs, total] = await query
      .orderBy('audit.timestamp', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { logs, total };
  }

  async clearOldLogs(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Cleared ${result.affected} old audit logs`);
    return result.affected || 0;
  }
}