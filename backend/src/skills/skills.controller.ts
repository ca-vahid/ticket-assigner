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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillDetectionService } from './skill-detection.service';
import { CategoryService } from './category.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillDetectionConfig } from '../database/entities/skill-detection-config.entity';
import { DetectedSkill, DetectedSkillStatus } from '../database/entities/detected-skill.entity';
import { SkillAuditLog } from '../database/entities/skill-audit-log.entity';
import { Agent } from '../database/entities/agent.entity';

@ApiTags('skills')
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

    // Get all skills for this agent (pending and approved)
    const [pendingSkills, approvedSkills] = await Promise.all([
      this.detectedSkillRepository.find({
        where: { 
          agentId: body.agentId, 
          status: DetectedSkillStatus.PENDING 
        },
        select: ['id', 'skillName', 'skillType', 'confidence']
      }),
      this.detectedSkillRepository.find({
        where: { 
          agentId: body.agentId, 
          status: DetectedSkillStatus.APPROVED 
        },
        select: ['id', 'skillName', 'skillType', 'confidence']
      })
    ]);

    return {
      agentId: agent.id,
      agentName: `${agent.firstName} ${agent.lastName}`,
      detectedSkills: pendingSkills.map(s => s.skillName),
      pendingSkillsCount: result.pendingSkillsCount || pendingSkills.length,
      approvedSkillsCount: approvedSkills.length,
      alreadyDetected: result.skillsDetected === 0 && approvedSkills.length > 0,
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
    
    // Cache agents to avoid overwriting skills when multiple skills are approved for the same agent
    const agentCache = new Map<string, any>();

    for (const skill of skills) {
      try {
        skill.status = DetectedSkillStatus.APPROVED;
        skill.reviewedBy = body.reviewedBy || body.approvedBy || 'Admin';
        skill.reviewedAt = new Date();
        skill.isActive = true;

        // Get agent from cache or load from DB
        let agent = agentCache.get(skill.agentId);
        
        if (!agent) {
          // Try to get from skill relation first
          agent = skill.agent;
          
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
          }
          
          // Add to cache for subsequent skills
          agentCache.set(skill.agentId, agent);
        }
        
        // Add to main skills array
        if (!agent.skills) {
          agent.skills = [];
        }
        if (!agent.skills.includes(skill.skillName)) {
          agent.skills.push(skill.skillName);
          console.log(`Added skill ${skill.skillName} to agent ${agent.firstName} ${agent.lastName}'s skills array`);
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
        
        // Check if skill already exists in metadata to avoid duplicates
        const existingMetadata = agent.skillMetadata.category.find(m => m.skill === skill.skillName);
        if (!existingMetadata) {
          agent.skillMetadata.category.push({
            skill: skill.skillName,
            confidence: skill.confidence,
            ticketCount: skill.metadata?.ticketCount || 0,
          });
        }

        // Save the skill status update
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
    
    // Save all modified agents after processing all skills
    console.log(`Saving ${agentCache.size} modified agents...`);
    for (const [agentId, agent] of agentCache) {
      try {
        await this.agentRepository.save(agent);
        console.log(`Saved agent ${agent.firstName} ${agent.lastName} with ${agent.skills?.length || 0} skills`);
      } catch (error) {
        console.error(`Failed to save agent ${agentId}:`, error);
        errors.push(`Agent ${agentId}: ${error.message}`);
      }
    }

    console.log(`Approval complete: ${approvedCount} approved, ${errors.length} errors`);
    return { 
      approved: approvedCount,
      requested: body.skillIds.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  @Post('fix-approved-skills')
  @ApiOperation({ summary: 'Fix approved skills not showing in agent skills array' })
  async fixApprovedSkills() {
    const approvedSkills = await this.detectedSkillRepository.find({
      where: { status: DetectedSkillStatus.APPROVED },
      relations: ['agent']
    });
    
    console.log(`Found ${approvedSkills.length} approved skills`);
    
    // Group by agent
    const agentSkillsMap = new Map<string, any[]>();
    for (const skill of approvedSkills) {
      if (!skill.agent) continue;
      
      const agentId = skill.agent.id;
      if (!agentSkillsMap.has(agentId)) {
        agentSkillsMap.set(agentId, []);
      }
      agentSkillsMap.get(agentId)!.push(skill);
    }
    
    // Update each agent
    let updated = 0;
    let totalSkillsAdded = 0;
    
    for (const [agentId, skills] of agentSkillsMap) {
      const agent = await this.agentRepository.findOne({ where: { id: agentId } });
      if (!agent) continue;
      
      if (!agent.skills) agent.skills = [];
      
      let added = 0;
      for (const skill of skills) {
        if (!agent.skills.includes(skill.skillName)) {
          agent.skills.push(skill.skillName);
          added++;
        }
      }
      
      if (added > 0) {
        await this.agentRepository.save(agent);
        console.log(`Updated agent ${agent.email}: added ${added} skills to main skills array`);
        updated++;
        totalSkillsAdded += added;
      }
    }
    
    return { 
      success: true, 
      agentsUpdated: updated, 
      skillsAdded: totalSkillsAdded,
      totalApprovedSkills: approvedSkills.length 
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