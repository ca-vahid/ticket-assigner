import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  Delete,
  HttpStatus,
  HttpCode,
  Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogType } from '../database/entities/audit-log.entity';

@ApiTags('audit')
@Controller('api/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('log')
  @ApiOperation({ summary: 'Create an audit log entry' })
  @ApiResponse({ status: 201, description: 'Audit log created' })
  @HttpCode(HttpStatus.CREATED)
  async createAuditLog(
    @Body() body: {
      action: string;
      type: AuditLogType;
      user: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, any>;
    }
  ) {
    return this.auditService.logAction(
      body.action,
      body.type,
      body.user,
      {
        entityType: body.entityType,
        entityId: body.entityId,
        ...body.metadata
      }
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: AuditLogType })
  @ApiQuery({ name: 'user', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  async getAuditLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('type') type?: AuditLogType,
    @Query('user') user?: string,
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    
    if (type) filters.type = type;
    if (user) filters.user = user;
    if (entityType) filters.entityType = entityType;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.auditService.getAuditLogs(
      limit || 100,
      offset || 0,
      filters
    );
  }

  @Delete('old')
  @ApiOperation({ summary: 'Clear old audit logs' })
  @ApiResponse({ status: 200, description: 'Old logs cleared' })
  async clearOldLogs(
    @Query('days') days?: number
  ): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.auditService.clearOldLogs(days || 90);
    return { success: true, deleted };
  }
}