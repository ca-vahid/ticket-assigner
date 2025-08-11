import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SkillDetectionService } from './skill-detection.service';
import { CategoryService } from './category.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillDetectionConfig } from '../database/entities/skill-detection-config.entity';
import { DetectedSkill, DetectedSkillStatus } from '../database/entities/detected-skill.entity';
import { SkillAuditLog } from '../database/entities/skill-audit-log.entity';
import { Agent } from '../database/entities/agent.entity';

@Controller('api/skills')
export class SkillsController {
  constructor(
    private readonly skillDetectionService: SkillDetectionService,
    private readonly categoryService: CategoryService,
    @InjectRepository(SkillDetectionConfig)
    private configRepository: Repository<SkillDetectionConfig>,
    @InjectRepository(DetectedSkill)
    private detectedSkillRepository: Repository<DetectedSkill>,
    @InjectRepository(SkillAuditLog)
    private auditLogRepository: Repository<SkillAuditLog>,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
  ) {}

  @Get('test')
  async test() {
    return { message: 'Skills controller is working!' };
  }

  @Get('config')
  async getConfigurations() {
    return await this.configRepository.find({
      order: { method: 'ASC' },
    });
  }

  @Post('config')
  async createConfiguration(@Body() body: Partial<SkillDetectionConfig>) {
    const existing = await this.configRepository.findOne({
      where: { method: body.method },
    });

    if (existing) {
      throw new HttpException('Configuration already exists', HttpStatus.CONFLICT);
    }

    const config = this.configRepository.create(body);
    return await this.configRepository.save(config);
  }

  @Put('config/:id')
  async updateConfiguration(
    @Param('id') id: string,
    @Body() body: Partial<SkillDetectionConfig>,
  ) {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new HttpException('Configuration not found', HttpStatus.NOT_FOUND);
    }

    Object.assign(config, body);
    return await this.configRepository.save(config);
  }

  @Post('detect')
  async detectSkills(@Body() body: { agentId?: string; runAll?: boolean }) {
    console.log('Detection request:', body);
    
    if (body.runAll) {
      const result = await this.skillDetectionService.runSkillDetection();
      console.log('Batch detection result:', result);
      return result;
    }

    if (!body.agentId) {
      throw new HttpException('Agent ID is required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.skillDetectionService.runSkillDetection(body.agentId);
    console.log('Single agent detection result:', result);
    
    // Get the agent details for the response
    const agent = await this.agentRepository.findOne({
      where: { id: body.agentId },
    });

    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    return {
      agentId: agent.id,
      agentName: `${agent.firstName} ${agent.lastName}`,
      detectedSkills: [], // Will be populated after detection
      ...result
    };
  }

  @Get('detected')
  async getDetectedSkills(@Query('status') status?: DetectedSkillStatus) {
    const where = status ? { status } : {};
    return await this.detectedSkillRepository.find({
      where,
      relations: ['agent'],
      order: { detectedAt: 'DESC' },
    });
  }

  @Get('detected/pending')
  async getPendingSkills() {
    // First try to get skills with agent relation
    const skills = await this.detectedSkillRepository.find({
      where: { status: DetectedSkillStatus.PENDING },
      relations: ['agent'],
      order: { updatedAt: 'DESC' },
    });
    
    console.log(`Found ${skills.length} pending skills with agents`);
    
    // Also check for orphaned skills without agent relation
    const allPendingSkills = await this.detectedSkillRepository.find({
      where: { status: DetectedSkillStatus.PENDING },
      order: { updatedAt: 'DESC' },
    });
    
    console.log(`Total pending skills in DB: ${allPendingSkills.length}`);
    
    if (allPendingSkills.length > skills.length) {
      console.log(`Warning: ${allPendingSkills.length - skills.length} skills have invalid agent references`);
    }

    // Group by agent for easier review
    const byAgent = {};
    const byMethod = {};
    
    skills.forEach(skill => {
      // Group by agent
      const agentId = skill.agentId;
      if (!byAgent[agentId]) {
        byAgent[agentId] = {
          agentName: skill.agent ? `${skill.agent.firstName} ${skill.agent.lastName}` : 'Unknown',
          skills: [],
        };
      }
      byAgent[agentId].skills.push(skill);
      
      // Count by method
      const method = skill.detectionMethod || 'UNKNOWN';
      byMethod[method] = (byMethod[method] || 0) + 1;
    });

    return {
      total: skills.length,
      byAgent,
      byMethod
    };
  }

  @Get('detected/approved')
  async getApprovedSkills() {
    const skills = await this.detectedSkillRepository.find({
      where: { status: DetectedSkillStatus.APPROVED },
      relations: ['agent'],
      order: { reviewedAt: 'DESC' },
    });

    // Group by agent for consistency with pending endpoint
    const byAgent: Record<string, { agentName: string; skills: any[] }> = {};
    const byMethod: Record<string, number> = {};

    skills.forEach(skill => {
      const agentId = skill.agent?.id || skill.agentId;
      const agentName = skill.agent ? 
        `${skill.agent.firstName} ${skill.agent.lastName}` : 
        'Unknown Agent';
      
      if (!byAgent[agentId]) {
        byAgent[agentId] = {
          agentName,
          skills: []
        };
      }
      
      byAgent[agentId].skills.push({
        id: skill.id,
        skillName: skill.skillName,
        confidence: skill.confidence,
        detectionMethod: skill.detectionMethod,
        metadata: skill.metadata,
        reviewedAt: skill.reviewedAt,
        reviewedBy: skill.reviewedBy
      });

      const method = skill.detectionMethod || 'UNKNOWN';
      byMethod[method] = (byMethod[method] || 0) + 1;
    });

    return {
      total: skills.length,
      byAgent,
      byMethod
    };
  }

  @Get('detected/rejected')
  async getRejectedSkills() {
    const skills = await this.detectedSkillRepository.find({
      where: { status: DetectedSkillStatus.REJECTED },
      relations: ['agent'],
      order: { reviewedAt: 'DESC' },
    });

    // Group by agent for consistency with pending endpoint
    const byAgent: Record<string, { agentName: string; skills: any[] }> = {};
    const byMethod: Record<string, number> = {};

    skills.forEach(skill => {
      const agentId = skill.agent?.id || skill.agentId;
      const agentName = skill.agent ? 
        `${skill.agent.firstName} ${skill.agent.lastName}` : 
        'Unknown Agent';
      
      if (!byAgent[agentId]) {
        byAgent[agentId] = {
          agentName,
          skills: []
        };
      }
      
      byAgent[agentId].skills.push({
        id: skill.id,
        skillName: skill.skillName,
        confidence: skill.confidence,
        detectionMethod: skill.detectionMethod,
        metadata: skill.metadata,
        reviewedAt: skill.reviewedAt,
        reviewedBy: skill.reviewedBy,
        rejectionReason: skill.rejectionReason
      });

      const method = skill.detectionMethod || 'UNKNOWN';
      byMethod[method] = (byMethod[method] || 0) + 1;
    });

    return {
      total: skills.length,
      byAgent,
      byMethod
    };
  }

  @Post('detected/approve')
  async approveSkills(@Body() body: { skillIds: string[]; approvedBy?: string; reviewedBy?: string }) {
    console.log('Approve request:', { skillIds: body.skillIds, approvedBy: body.approvedBy });
    
    if (!body.skillIds || body.skillIds.length === 0) {
      throw new HttpException('No skill IDs provided', HttpStatus.BAD_REQUEST);
    }
    
    const { In } = await import('typeorm');
    const skills = await this.detectedSkillRepository.find({
      where: { id: In(body.skillIds) },
      relations: ['agent'],
    });
    
    console.log(`Found ${skills.length} skills to approve out of ${body.skillIds.length} requested`);
    
    let approvedCount = 0;
    let errors = [];

    for (const skill of skills) {
      try {
        skill.status = DetectedSkillStatus.APPROVED;
        skill.reviewedBy = body.reviewedBy || body.approvedBy || 'Admin';
        skill.reviewedAt = new Date();
        skill.isActive = true;

      // Add to agent's skills - check if agent exists
      let agent = skill.agent;
      if (!agent) {
        // Load agent if not loaded
        console.log(`Agent not loaded for skill ${skill.skillName}, loading from DB...`);
        agent = await this.agentRepository.findOne({
          where: { id: skill.agentId }
        });
        if (!agent) {
          console.error(`Agent not found for skill ${skill.skillName} (agentId: ${skill.agentId})`);
          // Still update the skill status even if agent is missing
          await this.detectedSkillRepository.save(skill);
          continue;
        }
        skill.agent = agent;
      }
      
      // Add to main skills array
      if (!agent.skills) {
        agent.skills = [];
      }
      if (!agent.skills.includes(skill.skillName)) {
        agent.skills.push(skill.skillName);
      }
      
      // Also track in auto-detected skills
      if (!agent.autoDetectedSkills) {
        agent.autoDetectedSkills = [];
      }
      if (!agent.autoDetectedSkills.includes(skill.skillName)) {
        agent.autoDetectedSkills.push(skill.skillName);
      }

      // Update skill metadata
      if (!agent.skillMetadata) {
        agent.skillMetadata = {};
      }
      if (!agent.skillMetadata.category) {
        agent.skillMetadata.category = [];
      }
      
      agent.skillMetadata.category.push({
        skill: skill.skillName,
        confidence: skill.confidence,
        ticketCount: skill.metadata?.ticketCount || 0,
      });

      await this.agentRepository.save(agent);
      await this.detectedSkillRepository.save(skill);

      // Create audit log
      await this.auditLogRepository.save({
        agentId: agent.id,
        action: 'SKILL_APPROVED',
        skillName: skill.skillName,
        newValue: { skill: skill.skillName, confidence: skill.confidence },
        performedBy: body.reviewedBy || body.approvedBy || 'Admin',
        metadata: {
          detectionMethod: skill.detectionMethod,
          confidence: skill.confidence,
        },
      });
      
      approvedCount++;
      console.log(`Successfully approved skill ${skill.skillName} for agent ${agent.firstName} ${agent.lastName}`);
      
      } catch (error) {
        console.error(`Failed to approve skill ${skill.skillName}:`, error);
        errors.push(`${skill.skillName}: ${error.message}`);
      }
    }

    console.log(`Approval complete: ${approvedCount} approved, ${errors.length} errors`);
    return { 
      approved: approvedCount,
      requested: body.skillIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  @Post('detected/reject')
  async rejectSkills(@Body() body: { skillIds: string[]; rejectedBy?: string; reviewedBy?: string; reason?: string }) {
    console.log('Reject request:', { skillIds: body.skillIds, rejectedBy: body.rejectedBy, reason: body.reason });
    
    if (!body.skillIds || body.skillIds.length === 0) {
      throw new HttpException('No skill IDs provided', HttpStatus.BAD_REQUEST);
    }
    
    const { In } = await import('typeorm');
    const skills = await this.detectedSkillRepository.find({
      where: { id: In(body.skillIds) }
    });
    const reviewer = body.reviewedBy || body.rejectedBy || 'Admin';
    
    console.log(`Found ${skills.length} skills to reject out of ${body.skillIds.length} requested`);
    
    let rejectedCount = 0;
    let errors = [];

    for (const skill of skills) {
      try {
        skill.status = DetectedSkillStatus.REJECTED;
        skill.reviewedBy = reviewer;
        skill.reviewedAt = new Date();
        skill.reviewNotes = body.reason;
        await this.detectedSkillRepository.save(skill);

        // Create audit log
        await this.auditLogRepository.save({
          agentId: skill.agentId,
          action: 'SKILL_REJECTED',
          skillName: skill.skillName,
          performedBy: reviewer,
          metadata: {
            reason: body.reason,
            detectionMethod: skill.detectionMethod,
          },
        });
        
        rejectedCount++;
        console.log(`Successfully rejected skill ${skill.skillName}`);
        
      } catch (error) {
        console.error(`Failed to reject skill ${skill.skillName}:`, error);
        errors.push(`${skill.skillName}: ${error.message}`);
      }
    }

    console.log(`Rejection complete: ${rejectedCount} rejected, ${errors.length} errors`);
    return { 
      rejected: rejectedCount,
      requested: body.skillIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  @Get('audit-logs')
  async getAuditLogs(@Query('agentId') agentId?: string) {
    const where = agentId ? { agentId } : {};
    return await this.auditLogRepository.find({
      where,
      relations: ['agent'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  @Post('schedule/run')
  async runScheduledDetection() {
    return await this.skillDetectionService.runSkillDetection();
  }

  @Get('stats')
  async getStats() {
    const [pendingCount, approvedCount, rejectedCount, totalCount] = await Promise.all([
      this.detectedSkillRepository.count({ where: { status: DetectedSkillStatus.PENDING } }),
      this.detectedSkillRepository.count({ where: { status: DetectedSkillStatus.APPROVED } }),
      this.detectedSkillRepository.count({ where: { status: DetectedSkillStatus.REJECTED } }),
      this.detectedSkillRepository.count(),
    ]);

    const configs = await this.configRepository.find();
    const enabledMethods = configs.filter(c => c.enabled).map(c => c.method);

    const recentLogs = await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 5,
      relations: ['agent'],
    });

    // Get pending skills grouped by method
    const pendingSkills = await this.detectedSkillRepository.find({
      where: { status: DetectedSkillStatus.PENDING },
      relations: ['agent'],
    });

    const pendingByMethod = {};
    pendingSkills.forEach(skill => {
      const method = skill.detectionMethod || 'UNKNOWN';
      pendingByMethod[method] = (pendingByMethod[method] || 0) + 1;
    });

    return {
      detectedSkills: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      pendingByMethod,
      enabledMethods,
      recentActivity: recentLogs,
    };
  }

  @Get('categories')
  async getCategories(@Query('refresh') refresh?: string) {
    const forceRefresh = refresh === 'true';
    const categories = await this.categoryService.getCategories(forceRefresh);
    return categories;
  }

  @Post('categories/sync')
  async syncCategories() {
    const result = await this.categoryService.syncCategories();
    return result;
  }
}