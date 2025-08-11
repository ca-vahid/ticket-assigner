import { Controller, Get, Post, Put, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkillDetectionService } from './skill-detection.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillDetectionConfig, SkillDetectionMethod } from '../database/entities/skill-detection-config.entity';
import { DetectedSkill } from '../database/entities/detected-skill.entity';
import { SkillAuditLog } from '../database/entities/skill-audit-log.entity';
import { Agent } from '../database/entities/agent.entity';

class SkillDetectionConfigDto {
  method: SkillDetectionMethod;
  enabled: boolean;
  settings?: any;
}

class ApproveSkillsDto {
  skillIds: string[];
  approvedBy: string;
}

class RejectSkillsDto {
  skillIds: string[];
  rejectedBy: string;
  reason?: string;
}

@ApiTags('skill-detection')
@Controller('api/skills/detection')
export class SkillDetectionController {
  constructor(
    private readonly skillDetectionService: SkillDetectionService,
    @InjectRepository(SkillDetectionConfig)
    private configRepository: Repository<SkillDetectionConfig>,
    @InjectRepository(DetectedSkill)
    private detectedSkillRepository: Repository<DetectedSkill>,
    @InjectRepository(SkillAuditLog)
    private auditLogRepository: Repository<SkillAuditLog>,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  /**
   * Get skill detection configuration
   */
  @Get('config')
  @ApiOperation({ summary: 'Get skill detection configuration' })
  async getConfig(): Promise<SkillDetectionConfig[]> {
    return this.configRepository.find();
  }

  /**
   * Update skill detection configuration
   */
  @Put('config/:method')
  @ApiOperation({ summary: 'Update skill detection configuration' })
  async updateConfig(
    @Param('method') method: SkillDetectionMethod,
    @Body() config: SkillDetectionConfigDto
  ): Promise<SkillDetectionConfig> {
    let existingConfig = await this.configRepository.findOne({ where: { method } });
    
    if (!existingConfig) {
      existingConfig = this.configRepository.create({
        method,
        enabled: config.enabled,
        settings: config.settings
      });
    } else {
      existingConfig.enabled = config.enabled;
      existingConfig.settings = { ...existingConfig.settings, ...config.settings };
    }

    return this.configRepository.save(existingConfig);
  }

  /**
   * Run skill detection for all agents
   */
  @Post('run')
  @ApiOperation({ summary: 'Run skill detection for all agents' })
  async runDetection(@Query('agentId') agentId?: string): Promise<any> {
    return this.skillDetectionService.runSkillDetection(agentId);
  }

  /**
   * Get pending skills for review
   */
  @Get('pending')
  @ApiOperation({ summary: 'Get pending detected skills' })
  async getPendingSkills(@Query('agentId') agentId?: string): Promise<{
    total: number;
    byAgent: Record<string, {
      agentName: string;
      skills: DetectedSkill[];
    }>;
    byMethod: Record<string, number>;
  }> {
    const skills = await this.skillDetectionService.getPendingSkills(agentId);
    
    // Group by agent
    const byAgent: Record<string, any> = {};
    const byMethod: Record<string, number> = {};
    
    for (const skill of skills) {
      // Group by agent
      if (!byAgent[skill.agentId]) {
        byAgent[skill.agentId] = {
          agentName: `${skill.agent.firstName} ${skill.agent.lastName}`,
          skills: []
        };
      }
      byAgent[skill.agentId].skills.push(skill);
      
      // Count by method
      byMethod[skill.detectionMethod] = (byMethod[skill.detectionMethod] || 0) + 1;
    }

    return {
      total: skills.length,
      byAgent,
      byMethod
    };
  }

  /**
   * Get skill detection preview for an agent
   */
  @Get('preview/:agentId')
  @ApiOperation({ summary: 'Preview detected skills for an agent' })
  async getSkillPreview(@Param('agentId') agentId: string): Promise<{
    current: {
      manual: string[];
      category: string[];
      autoDetected: string[];
    };
    pending: DetectedSkill[];
    suggested: {
      category: any[];
      group: any[];
      pattern: any[];
    };
  }> {
    // Get agent with current skills
    const agent = await this.agentRepository.findOne({ where: { id: agentId } });
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    // Get pending skills
    const pending = await this.skillDetectionService.getPendingSkills(agentId);

    // Run detection (without saving) to get suggestions
    const suggestions = await this.runDetectionPreview(agentId);

    return {
      current: {
        manual: agent.skills || [],
        category: agent.categorySkills || [],
        autoDetected: agent.autoDetectedSkills || []
      },
      pending,
      suggested: suggestions
    };
  }

  /**
   * Approve detected skills
   */
  @Post('approve')
  @ApiOperation({ summary: 'Approve detected skills' })
  async approveSkills(@Body() dto: ApproveSkillsDto): Promise<{ success: boolean }> {
    await this.skillDetectionService.approveSkills(dto.skillIds, dto.approvedBy);
    return { success: true };
  }

  /**
   * Reject detected skills
   */
  @Post('reject')
  @ApiOperation({ summary: 'Reject detected skills' })
  async rejectSkills(@Body() dto: RejectSkillsDto): Promise<{ success: boolean }> {
    await this.skillDetectionService.rejectSkills(dto.skillIds, dto.rejectedBy, dto.reason);
    return { success: true };
  }

  /**
   * Apply all pending skills for an agent
   */
  @Post('apply-all/:agentId')
  @ApiOperation({ summary: 'Apply all pending skills for an agent' })
  async applyAllSkills(
    @Param('agentId') agentId: string,
    @Body() body: { appliedBy: string }
  ): Promise<{ success: boolean; applied: number }> {
    const pending = await this.skillDetectionService.getPendingSkills(agentId);
    const skillIds = pending.map(s => s.id);
    
    if (skillIds.length > 0) {
      await this.skillDetectionService.approveSkills(skillIds, body.appliedBy);
    }
    
    return { success: true, applied: skillIds.length };
  }

  /**
   * Get skill detection history/audit log
   */
  @Get('audit')
  @ApiOperation({ summary: 'Get skill detection audit log' })
  async getAuditLog(
    @Query('agentId') agentId?: string,
    @Query('limit') limit: number = 100
  ): Promise<SkillAuditLog[]> {
    const where: any = {};
    if (agentId) where.agentId = agentId;
    
    return this.auditLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['agent']
    });
  }

  /**
   * Get skill statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get skill detection statistics' })
  async getStats(): Promise<{
    totalDetected: number;
    pending: number;
    approved: number;
    rejected: number;
    topSkills: { skill: string; count: number }[];
    lastRun?: Date;
  }> {
    const [totalDetected, pending, approved, rejected] = await Promise.all([
      this.detectedSkillRepository.count(),
      this.detectedSkillRepository.count({ where: { status: 'PENDING' } }),
      this.detectedSkillRepository.count({ where: { status: 'APPROVED' } }),
      this.detectedSkillRepository.count({ where: { status: 'REJECTED' } })
    ]);

    // Get top skills
    const skills = await this.detectedSkillRepository
      .createQueryBuilder('skill')
      .select('skill.skillName', 'skill')
      .addSelect('COUNT(*)', 'count')
      .where('skill.status = :status', { status: 'APPROVED' })
      .groupBy('skill.skillName')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Get last run time
    const lastConfig = await this.configRepository.findOne({
      where: { enabled: true },
      order: { lastRunAt: 'DESC' }
    });

    return {
      totalDetected,
      pending,
      approved,
      rejected,
      topSkills: skills.map(s => ({ skill: s.skill, count: parseInt(s.count) })),
      lastRun: lastConfig?.lastRunAt
    };
  }

  /**
   * Initialize default configuration
   */
  @Post('init')
  @ApiOperation({ summary: 'Initialize default skill detection configuration' })
  async initializeConfig(): Promise<{ success: boolean }> {
    const defaultConfigs = [
      {
        method: SkillDetectionMethod.CATEGORY_BASED,
        enabled: true,
        settings: {
          minimumTickets: 5,
          lookbackTickets: 1000,
          includeComplexity: true
        }
      },
      {
        method: SkillDetectionMethod.GROUP_MEMBERSHIP,
        enabled: true,
        settings: {
          groupSkillMappings: {
            'Network Team': ['network', 'vpn', 'firewall', 'routing'],
            'Security Team': ['security', 'access_control', 'incident_response'],
            'Database Team': ['database', 'sql', 'backup'],
            'Desktop Support': ['hardware', 'software', 'printer_support'],
            'Server Team': ['server_management', 'virtualization', 'storage'],
            'Cloud Team': ['azure', 'aws', 'cloud_migration']
          }
        }
      },
      {
        method: SkillDetectionMethod.RESOLUTION_PATTERNS,
        enabled: false,
        settings: {
          frequencyThreshold: 10
        }
      },
      {
        method: SkillDetectionMethod.TEXT_ANALYSIS_LLM,
        enabled: false,
        settings: {
          llmModel: 'gpt-4',
          batchSize: 50
        }
      }
    ];

    for (const config of defaultConfigs) {
      const existing = await this.configRepository.findOne({ 
        where: { method: config.method } 
      });
      
      if (!existing) {
        await this.configRepository.save(config);
      }
    }

    return { success: true };
  }

  /**
   * Helper: Run detection preview without saving
   */
  private async runDetectionPreview(agentId: string): Promise<any> {
    // This would run detection methods but not save results
    // For now, returning mock structure
    return {
      category: [],
      group: [],
      pattern: []
    };
  }

}