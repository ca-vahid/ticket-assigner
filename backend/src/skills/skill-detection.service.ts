import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { DetectedSkill, SkillType, DetectedSkillStatus } from '../database/entities/detected-skill.entity';
import { SkillDetectionConfig, SkillDetectionMethod } from '../database/entities/skill-detection-config.entity';
import { SkillAuditLog, SkillAuditAction } from '../database/entities/skill-audit-log.entity';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';

interface SkillDetectionResult {
  agentId: string;
  detectedSkills: {
    skillName: string;
    type: SkillType;
    method: SkillDetectionMethod;
    confidence: number;
    metadata: any;
  }[];
}

@Injectable()
export class SkillDetectionService {
  private readonly logger = new Logger(SkillDetectionService.name);

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(DetectedSkill)
    private detectedSkillRepository: Repository<DetectedSkill>,
    @InjectRepository(SkillDetectionConfig)
    private configRepository: Repository<SkillDetectionConfig>,
    @InjectRepository(SkillAuditLog)
    private auditLogRepository: Repository<SkillAuditLog>,
    private freshserviceService: FreshserviceService,
  ) {}

  /**
   * Run skill detection for all agents or a specific agent
   */
  async runSkillDetection(agentId?: string): Promise<{
    success: boolean;
    agentsProcessed: number;
    skillsDetected: number;
    errors: string[];
  }> {
    this.logger.log(`🎯 Starting skill detection ${agentId ? `for agent ${agentId}` : 'for all agents'}`);
    
    const errors: string[] = [];
    let skillsDetected = 0;
    let agentsProcessed = 0;

    try {
      // Get enabled detection methods
      const configs = await this.configRepository.find({ where: { enabled: true } });
      
      if (configs.length === 0) {
        this.logger.warn('No detection methods enabled');
        return { success: true, agentsProcessed: 0, skillsDetected: 0, errors: [] };
      }

      // Get agents to process
      let agents: Agent[];
      if (agentId) {
        const agent = await this.agentRepository.findOne({ where: { id: agentId } });
        agents = agent ? [agent] : [];
      } else {
        agents = await this.agentRepository.find({ where: { isAvailable: true } });
      }

      this.logger.log(`Processing ${agents.length} agents with ${configs.length} detection methods`);

      // Process each agent
      for (const agent of agents) {
        try {
          const results: SkillDetectionResult[] = [];

          // Run each enabled detection method
          for (const config of configs) {
            switch (config.method) {
              case SkillDetectionMethod.CATEGORY_BASED:
                const categorySkills = await this.detectCategoryBasedSkills(agent, config);
                if (categorySkills) results.push(categorySkills);
                break;

              case SkillDetectionMethod.GROUP_MEMBERSHIP:
                const groupSkills = await this.detectGroupBasedSkills(agent, config);
                if (groupSkills) results.push(groupSkills);
                break;

              case SkillDetectionMethod.RESOLUTION_PATTERNS:
                // To be implemented
                break;

              case SkillDetectionMethod.TEXT_ANALYSIS_LLM:
                // To be implemented - will require LLM integration
                break;
            }
          }

          // Save detected skills
          for (const result of results) {
            for (const skill of result.detectedSkills) {
              const wasCreatedOrUpdated = await this.saveDetectedSkill(agent, skill);
              if (wasCreatedOrUpdated) {
                skillsDetected++;
              }
            }
          }

          agentsProcessed++;
          
          // Update agent's last skill detection timestamp
          agent.lastSkillDetectionAt = new Date();
          await this.agentRepository.save(agent);
          
        } catch (error) {
          const errorMsg = `Error processing agent ${agent.email}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Log audit entry for bulk detection
      await this.auditLogRepository.save({
        action: SkillAuditAction.BULK_DETECTION_RUN,
        performedBy: 'SYSTEM',
        metadata: {
          agentsProcessed,
          skillsDetected,
          errors
        }
      });

      // Update config last run info
      for (const config of configs) {
        config.lastRunAt = new Date();
        config.lastRunStatus = errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'SUCCESS';
        config.lastRunStats = { agentsProcessed, skillsDetected, errors };
        await this.configRepository.save(config);
      }

      this.logger.log(`✅ Skill detection complete: ${agentsProcessed} agents, ${skillsDetected} skills detected`);

      return {
        success: true,
        agentsProcessed,
        skillsDetected,
        errors
      };

    } catch (error) {
      this.logger.error('Skill detection failed:', error);
      return {
        success: false,
        agentsProcessed,
        skillsDetected,
        errors: [...errors, error.message]
      };
    }
  }

  /**
   * Detect skills based on ticket categories
   */
  private async detectCategoryBasedSkills(
    agent: Agent, 
    config: SkillDetectionConfig
  ): Promise<SkillDetectionResult | null> {
    try {
      const settings = config.settings || {};
      const minimumTickets = settings.minimumTickets || 5;
      const lookbackTickets = settings.lookbackTickets || 500;
      const includeComplexity = settings.includeComplexity !== false;

      this.logger.debug(`Detecting category skills for ${agent.email}`);
      this.logger.log(`Fetching tickets for agent ${agent.email} (FreshserviceID: ${agent.freshserviceId})`);

      // Fetch agent's ticket history from Freshservice
      const tickets = await this.fetchAgentTicketHistory(agent.freshserviceId, lookbackTickets);
      
      this.logger.log(`Found ${tickets.length} tickets for ${agent.email}`);
      
      // Log first few tickets to see their structure and custom fields
      if (tickets.length > 0) {
        this.logger.log(`Sample ticket structure:`, JSON.stringify(tickets[0], null, 2).substring(0, 500));
        if (tickets[0].custom_fields) {
          this.logger.log(`Available custom fields:`, Object.keys(tickets[0].custom_fields));
          this.logger.log(`Security field value:`, tickets[0].custom_fields.security || 'NOT FOUND');
        }
      }
      
      // Group tickets by category and count
      const categoryMap = new Map<string, { count: number; complexity: number }>();
      
      for (const ticket of tickets) {
        // Use the custom 'security' dropdown field as the primary category source
        const category = ticket.custom_fields?.security || 
                        ticket.custom_fields?.cf_security ||
                        null; // Only use the security field, ignore generic categories
        
        if (!category) {
          this.logger.debug(`No security category found for ticket ${ticket.id}`);
          continue;
        }
        
        this.logger.debug(`Ticket ${ticket.id} has security category: ${category}`);

        const current = categoryMap.get(category) || { count: 0, complexity: 0 };
        current.count++;
        
        // Add complexity score based on priority
        if (includeComplexity) {
          const priorityScore = this.getPriorityScore(ticket.priority);
          current.complexity += priorityScore;
        }
        
        categoryMap.set(category, current);
      }

      // Filter categories that meet the threshold
      const detectedSkills = [];
      
      this.logger.log(`Category analysis for ${agent.email}:`);
      for (const [category, stats] of categoryMap.entries()) {
        this.logger.log(`  - ${category}: ${stats.count} tickets`);
        
        if (stats.count >= minimumTickets) {
          const confidence = Math.min(stats.count / (minimumTickets * 2), 1); // Max confidence at 2x minimum
          const skillName = this.categoryToSkillName(category);
          
          this.logger.log(`    ✅ Meets threshold! Creating skill: ${skillName} (${(confidence * 100).toFixed(0)}% confidence)`);
          
          detectedSkills.push({
            skillName,
            type: SkillType.CATEGORY,
            method: SkillDetectionMethod.CATEGORY_BASED,
            confidence,
            metadata: {
              ticketCount: stats.count,
              categories: [category],
              complexityScore: stats.complexity / stats.count,
              dateRange: {
                from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
                to: new Date()
              }
            }
          });
        } else {
          this.logger.log(`    ❌ Below threshold (needs ${minimumTickets}, has ${stats.count})`);
        }
      }

      if (detectedSkills.length > 0) {
        this.logger.log(`🎯 Found ${detectedSkills.length} category-based skills for ${agent.email}`);
        return { agentId: agent.id, detectedSkills };
      } else {
        this.logger.log(`No skills met the threshold for ${agent.email}`);
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to detect category skills for ${agent.email}:`, error);
      return null;
    }
  }

  /**
   * Detect skills based on group membership
   */
  private async detectGroupBasedSkills(
    agent: Agent,
    config: SkillDetectionConfig
  ): Promise<SkillDetectionResult | null> {
    try {
      const groupSkillMappings = config.settings?.groupSkillMappings || {
        'Network Team': ['network', 'vpn', 'firewall', 'routing'],
        'Security Team': ['security', 'access_control', 'incident_response', 'compliance'],
        'Database Team': ['database', 'sql', 'backup', 'performance_tuning'],
        'Desktop Support': ['hardware', 'software', 'printer_support', 'user_training'],
        'Server Team': ['server_management', 'virtualization', 'storage', 'backup'],
        'Cloud Team': ['azure', 'aws', 'cloud_migration', 'devops']
      };

      // Fetch agent's group memberships from Freshservice
      const agentDetails = await this.freshserviceService.getAgent(agent.freshserviceId);
      const groups = agentDetails?.member_of || [];

      const detectedSkills = [];
      for (const group of groups) {
        const groupName = group.name || group;
        const skills = groupSkillMappings[groupName];
        
        if (skills && skills.length > 0) {
          for (const skill of skills) {
            detectedSkills.push({
              skillName: skill,
              type: SkillType.GROUP,
              method: SkillDetectionMethod.GROUP_MEMBERSHIP,
              confidence: 0.8, // High confidence for group membership
              metadata: {
                groupName
              }
            });
          }
        }
      }

      if (detectedSkills.length > 0) {
        this.logger.log(`Found ${detectedSkills.length} group-based skills for ${agent.email}`);
        return { agentId: agent.id, detectedSkills };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to detect group skills for ${agent.email}:`, error);
      return null;
    }
  }

  /**
   * Fetch agent's ticket history
   */
  private async fetchAgentTicketHistory(freshserviceId: string, limit: number = 500): Promise<any[]> {
    try {
      this.logger.log(`Fetching tickets from Freshservice for agent ID: ${freshserviceId}`);
      
      const tickets = await this.freshserviceService.getAgentTickets(freshserviceId, {
        status: [4, 5], // Resolved and Closed  
        limit
      });
      
      this.logger.log(`Freshservice returned ${tickets.length} tickets for agent ${freshserviceId}`);
      return tickets;
    } catch (error) {
      this.logger.error(`Failed to fetch ticket history for agent ${freshserviceId}:`, error);
      return [];
    }
  }

  /**
   * Save detected skill to database
   */
  private async saveDetectedSkill(agent: Agent, skill: any): Promise<boolean> {
    // Check if skill already exists as pending
    const existing = await this.detectedSkillRepository.findOne({
      where: {
        agentId: agent.id,
        skillName: skill.skillName,
        status: DetectedSkillStatus.PENDING
      }
    });

    if (existing) {
      // Update existing pending skill with new metadata and confidence
      existing.confidence = skill.confidence;
      existing.metadata = skill.metadata;
      // Don't update detectedAt as it's a CreateDateColumn
      
      await this.detectedSkillRepository.save(existing);
      
      this.logger.log(`Updated existing pending skill ${skill.skillName} for ${agent.email} (confidence: ${(skill.confidence * 100).toFixed(0)}%)`);
      
      // Return true - skill was updated
      return true;
    } else {
      // Check if skill was previously approved/rejected
      const previouslyReviewed = await this.detectedSkillRepository.findOne({
        where: {
          agentId: agent.id,
          skillName: skill.skillName
        }
      });
      
      // Only create new if not previously approved (rejected skills can be re-detected)
      if (!previouslyReviewed || previouslyReviewed.status === DetectedSkillStatus.REJECTED) {
        const detectedSkill = this.detectedSkillRepository.create({
          agent,
          agentId: agent.id,
          skillName: skill.skillName,
          skillType: skill.type,
          detectionMethod: skill.method,
          confidence: skill.confidence,
          metadata: skill.metadata,
          status: DetectedSkillStatus.PENDING
        });

        await this.detectedSkillRepository.save(detectedSkill);
        
        this.logger.log(`Created new pending skill ${skill.skillName} for ${agent.email}`);

        // Log audit entry
        await this.auditLogRepository.save({
          agentId: agent.id,
          action: SkillAuditAction.SKILL_DETECTED,
          skillName: skill.skillName,
          metadata: {
            detectionMethod: skill.method,
            confidence: skill.confidence,
            ...skill.metadata
          },
          performedBy: 'SYSTEM'
        });
        
        // Return true - new skill was created
        return true;
      } else {
        this.logger.log(`Skill ${skill.skillName} already approved for ${agent.email}, skipping`);
        // Return false - skill was not created/updated
        return false;
      }
    }
  }

  /**
   * Get pending skills for review
   */
  async getPendingSkills(agentId?: string): Promise<DetectedSkill[]> {
    const where: any = { status: DetectedSkillStatus.PENDING };
    if (agentId) where.agentId = agentId;
    
    return this.detectedSkillRepository.find({
      where,
      relations: ['agent'],
      order: { detectedAt: 'DESC' }
    });
  }

  /**
   * Approve detected skills
   */
  async approveSkills(skillIds: string[], approvedBy: string): Promise<void> {
    const skills = await this.detectedSkillRepository.findByIds(skillIds, {
      relations: ['agent']
    });

    for (const skill of skills) {
      skill.status = DetectedSkillStatus.APPROVED;
      skill.reviewedBy = approvedBy;
      skill.reviewedAt = new Date();
      skill.isActive = true;

      // Add to agent's skills
      const agent = skill.agent;
      if (!agent.categorySkills) agent.categorySkills = [];
      if (!agent.autoDetectedSkills) agent.autoDetectedSkills = [];
      
      if (skill.skillType === SkillType.CATEGORY) {
        if (!agent.categorySkills.includes(skill.skillName)) {
          agent.categorySkills.push(skill.skillName);
        }
      }
      
      if (!agent.autoDetectedSkills.includes(skill.skillName)) {
        agent.autoDetectedSkills.push(skill.skillName);
      }

      // Update skill metadata
      if (!agent.skillMetadata) agent.skillMetadata = {};
      const typeKey = skill.skillType.toLowerCase();
      if (!agent.skillMetadata[typeKey]) agent.skillMetadata[typeKey] = [];
      
      agent.skillMetadata[typeKey].push({
        skill: skill.skillName,
        confidence: skill.confidence,
        ...(skill.metadata || {})
      });

      await this.agentRepository.save(agent);
      await this.detectedSkillRepository.save(skill);

      // Log audit
      await this.auditLogRepository.save({
        agentId: agent.id,
        action: SkillAuditAction.SKILL_APPROVED,
        skillName: skill.skillName,
        metadata: {
          detectionMethod: skill.detectionMethod,
          confidence: skill.confidence
        },
        performedBy: approvedBy
      });
    }
  }

  /**
   * Reject detected skills
   */
  async rejectSkills(skillIds: string[], rejectedBy: string, reason?: string): Promise<void> {
    const skills = await this.detectedSkillRepository.findByIds(skillIds);

    for (const skill of skills) {
      skill.status = DetectedSkillStatus.REJECTED;
      skill.reviewedBy = rejectedBy;
      skill.reviewedAt = new Date();
      skill.reviewNotes = reason;

      await this.detectedSkillRepository.save(skill);

      // Log audit
      await this.auditLogRepository.save({
        agentId: skill.agentId,
        action: SkillAuditAction.SKILL_REJECTED,
        skillName: skill.skillName,
        metadata: {
          reason,
          detectionMethod: skill.detectionMethod
        },
        performedBy: rejectedBy
      });
    }
  }

  /**
   * Helper: Convert category to skill name
   */
  private categoryToSkillName(category: string): string {
    return category.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Helper: Get priority score for complexity calculation
   */
  private getPriorityScore(priority: number): number {
    const scores = { 1: 1, 2: 2, 3: 3, 4: 4 }; // Low to Urgent
    return scores[priority] || 1;
  }
}