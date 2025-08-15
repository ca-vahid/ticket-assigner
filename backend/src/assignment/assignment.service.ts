import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Agent } from '../database/entities/agent.entity';
import { Decision, DecisionType } from '../database/entities/decision.entity';
import { Category } from '../database/entities/category.entity';
import { Settings } from '../database/entities/settings.entity';
import { Location } from '../database/entities/location.entity';
import { EligibilityService } from '../eligibility/eligibility.service';
import { ScoringService } from '../scoring/scoring.service';
import { FreshserviceService } from '../integrations/freshservice/freshservice.service';
import { 
  AssignmentRequest, 
  AssignmentResult, 
  AssignmentMode,
  AssignmentFeedback 
} from './assignment.types';
import { TicketContext } from '../scoring/scoring.types';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);
  private autoAssignEnabled: boolean = false;
  private maxSuggestions: number = 3;
  private minScoreThreshold: number = 0.5;

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(Decision)
    private decisionRepository: Repository<Decision>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private eligibilityService: EligibilityService,
    private scoringService: ScoringService,
    private freshserviceService: FreshserviceService,
    private configService: ConfigService
  ) {
    this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    const settings = await this.settingsRepository.find({
      where: { category: 'assignment' }
    });

    settings.forEach(setting => {
      switch (setting.key) {
        case 'assignment.autoAssignEnabled':
          this.autoAssignEnabled = setting.value;
          break;
        case 'assignment.maxSuggestionsCount':
          this.maxSuggestions = setting.value;
          break;
        case 'assignment.minScoreThreshold':
          this.minScoreThreshold = setting.value;
          break;
      }
    });
  }

  async assignTicket(request: AssignmentRequest): Promise<AssignmentResult> {
    const startTime = Date.now();
    this.logger.log(`🎯 Starting assignment for ticket ${request.ticketId}`);
    this.logger.log(`📦 Request has ticketData: ${!!request.ticketData}`);
    
    // Get the workload limit from settings for use throughout assignment
    const workloadLimit = await this.getWorkloadLimitFromSettings();
    
    try {
      // Use provided ticket data or fetch from Freshservice
      let ticket = request.ticketData;
      if (!ticket) {
        try {
          ticket = await this.freshserviceService.getTicket(request.ticketId);
        } catch (error) {
          this.logger.warn(`Failed to fetch ticket ${request.ticketId} from Freshservice, using minimal data`);
          ticket = {
            id: request.ticketId,
            subject: 'Unknown',
            priority: 2,
            description: ''
          };
        }
      }
      this.logger.log(`📋 Ticket data: ${ticket.subject || 'Unknown'}`)
      
      // Get category information
      const category = request.categoryId 
        ? await this.categoryRepository.findOne({ 
            where: { id: request.categoryId } 
          })
        : null;
      this.logger.log(`📁 Category: ${category?.name || 'None'} (ID: ${request.categoryId || 'None'})`);

      // Build ticket context for scoring
      const ticketContext = await this.buildTicketContext(ticket, category);

      // Get eligible agents
      this.logger.log(`🔍 Finding eligible agents...`);
      const eligibilityResult = await this.eligibilityService.getEligibleAgents({
        ticketId: request.ticketId,
        categoryId: category?.id,
        requiredSkills: category?.requiredSkills || [],
        minLevel: category?.priorityLevel,
        requiresOnsite: ticketContext.requiresOnsite,  // Use the properly determined value from context
        locationId: ticketContext.locationId,  // Use locationId from context (consistent field name)
        checkPTO: true,
        ptoAgentIds: request.ptoAgentIds || [],
        maxLoadPercentage: 0.9,
        requireSpecialization: request.requireSpecialization
      });

      this.logger.log(`✅ Found ${eligibilityResult.eligibleAgents.length} eligible agents`);
      
      if (eligibilityResult.eligibleAgents.length === 0) {
        this.logger.warn(`❌ No eligible agents found for ticket ${request.ticketId}`);
        return {
          success: false,
          mode: AssignmentMode.FAILED,
          ticketId: request.ticketId,
          message: 'No eligible agents found',
          suggestions: [],
          processingTimeMs: Date.now() - startTime,
          metadata: {
            eligibilityFilters: eligibilityResult.filters,
            excludedReasons: eligibilityResult.excludedReasons
          }
        };
      }

      // Score all eligible agents
      const scoringResults = await this.scoringService.scoreMultipleAgents(
        eligibilityResult.eligibleAgents,
        ticketContext
      );
      
      this.logger.log(`🎯 Scored ${scoringResults.length} agents`);
      if (scoringResults.length > 0) {
        this.logger.log(`📊 Top scores: ${scoringResults.slice(0, 3).map(r => `${r.agentName}: ${r.totalScore.toFixed(3)}`).join(', ')}`);
        this.logger.log(`📏 Min threshold: ${this.minScoreThreshold}`);
      }

      // Filter by minimum score threshold
      const qualifiedAgents = scoringResults.filter(
        result => result.totalScore >= this.minScoreThreshold
      );

      if (qualifiedAgents.length === 0) {
        return {
          success: false,
          mode: AssignmentMode.FAILED,
          ticketId: request.ticketId,
          message: 'No agents met the minimum score threshold',
          suggestions: [],
          processingTimeMs: Date.now() - startTime
        };
      }

      // Get top suggestions
      const topSuggestions = qualifiedAgents.slice(0, this.maxSuggestions);

      // Create decision record
      const decision = await this.createDecision(
        request.ticketId,
        ticket.subject,
        topSuggestions[0],
        topSuggestions.slice(1),
        this.autoAssignEnabled ? DecisionType.AUTO_ASSIGNED : DecisionType.SUGGESTED
      );

      // Handle auto-assignment if enabled
      if (this.autoAssignEnabled && !request.suggestOnly) {
        const assignedAgent = await this.agentRepository.findOne({
          where: { id: topSuggestions[0].agentId }
        });

        if (assignedAgent) {
          // Assign in Freshservice
          await this.freshserviceService.assignTicket(
            request.ticketId,
            assignedAgent.freshserviceId
          );

          // Update agent load
          await this.updateAgentLoad(assignedAgent.id, 1);

          // Add assignment note to ticket
          await this.freshserviceService.createTicketAssignmentNote(
            request.ticketId,
            `${assignedAgent.firstName} ${assignedAgent.lastName}`,
            topSuggestions.slice(1).map(s => ({
              name: s.agentName,
              score: s.totalScore
            })),
            this.generateAssignmentReason(topSuggestions[0])
          );

          return {
            success: true,
            mode: AssignmentMode.AUTO_ASSIGNED,
            ticketId: request.ticketId,
            assignedAgent: {
              id: assignedAgent.id,
              name: `${assignedAgent.firstName} ${assignedAgent.lastName}`,
              email: assignedAgent.email
            },
            suggestions: topSuggestions,
            confidence: this.calculateConfidence(topSuggestions),
            decisionId: decision.id,
            processingTimeMs: Date.now() - startTime
          };
        }
      }

      // Return suggestions for manual selection
      return {
        success: true,
        mode: AssignmentMode.SUGGESTED,
        ticketId: request.ticketId,
        suggestions: topSuggestions,
        confidence: this.calculateConfidence(topSuggestions),
        decisionId: decision.id,
        processingTimeMs: Date.now() - startTime,
        message: `Top ${topSuggestions.length} agent suggestions ready for review`
      };

    } catch (error) {
      this.logger.error(`Assignment failed for ticket ${request.ticketId}`, error);
      
      return {
        success: false,
        mode: AssignmentMode.FAILED,
        ticketId: request.ticketId,
        message: `Assignment failed: ${error.message}`,
        suggestions: [],
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  private async buildTicketContext(
    ticket: any,
    category: Category | null
  ): Promise<TicketContext> {
    // Extract location information from ticket if available
    const requesterLocationId = ticket.requester?.location_id;
    let locationInfo: any = {};
    
    if (requesterLocationId) {
      // Try to find the location in our database
      const location = await this.locationRepository.findOne({
        where: { freshserviceId: requesterLocationId.toString() }
      });
      
      if (location) {
        locationInfo = {
          locationId: location.id,
          timezone: location.timezone,
          requesterLocation: location.name
        };
      }
    }

    // Check if ticket requires onsite support based on category or keywords
    const requiresOnsite = (category as any)?.metadata?.requiresOnsite || 
      (ticket.description_text || ticket.description || '').toLowerCase().includes('onsite') ||
      (ticket.subject || '').toLowerCase().includes('onsite');

    return {
      ticketId: ticket.id.toString(),
      subject: ticket.subject,
      description: ticket.description_text || ticket.description,
      categoryId: category?.id,
      requiredSkills: category?.requiredSkills || [],
      requiredLevel: category?.priorityLevel,
      requiresOnsite,
      location: ticket.location_name, // Legacy field
      ...locationInfo, // Spread new location fields
      isVip: ticket.priority === 4 || ticket.urgency === 4,
      priority: this.mapPriority(ticket.priority),
      estimatedHours: category?.averageResolutionTime
    };
  }

  private mapPriority(freshservicePriority: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    switch (freshservicePriority) {
      case 1: return 'LOW';
      case 2: return 'MEDIUM';
      case 3: return 'HIGH';
      case 4: return 'URGENT';
      default: return 'MEDIUM';
    }
  }

  private async createDecision(
    ticketId: string,
    ticketSubject: string,
    topAgent: any,
    alternatives: any[],
    type: DecisionType
  ): Promise<Decision> {
    const agent = await this.agentRepository.findOne({
      where: { id: topAgent.agentId }
    });

    const decision = this.decisionRepository.create({
      ticketId,
      ticketSubject,
      agent: agent || undefined, // Convert null to undefined for TypeORM
      type,
      score: topAgent.totalScore,
      scoreBreakdown: topAgent.breakdown,
      alternatives: alternatives.map(alt => ({
        agentId: alt.agentId,
        agentName: alt.agentName,
        score: alt.totalScore,
        scoreBreakdown: alt.breakdown
      })),
      wasAccepted: type === DecisionType.AUTO_ASSIGNED
    });

    return this.decisionRepository.save(decision) as Promise<Decision>;
  }

  private calculateConfidence(scoringResults: any[]): number {
    if (scoringResults.length === 0) return 0;
    
    const topScore = scoringResults[0].totalScore;
    
    // High confidence if top score is high and well separated from others
    if (topScore >= 0.8) {
      if (scoringResults.length === 1) return 0.95;
      
      const secondScore = scoringResults[1].totalScore;
      const separation = topScore - secondScore;
      
      if (separation >= 0.2) return 0.9;
      if (separation >= 0.1) return 0.8;
      return 0.7;
    }
    
    // Medium confidence for moderate scores
    if (topScore >= 0.6) return 0.6;
    
    // Low confidence for low scores
    return 0.4;
  }

  private generateAssignmentReason(scoringResult: any): string {
    const reasons = [];
    
    if (scoringResult.breakdown.skillScore >= 0.8) {
      reasons.push('excellent skill match');
    }
    if (scoringResult.breakdown.loadScore >= 0.8) {
      reasons.push('optimal workload balance');
    }
    if (scoringResult.breakdown.levelScore >= 0.9) {
      reasons.push('appropriate expertise level');
    }
    if (scoringResult.breakdown.locationScore === 1.0) {
      reasons.push('location requirements met');
    }
    
    return reasons.length > 0 
      ? `Selected due to ${reasons.join(', ')}`
      : 'Best overall match based on scoring criteria';
  }

  private async updateAgentLoad(agentId: string, delta: number): Promise<void> {
    await this.agentRepository.increment(
      { id: agentId },
      'currentTicketCount',
      delta
    );
  }

  async provideFeedback(feedback: AssignmentFeedback): Promise<void> {
    const decision = await this.decisionRepository.findOne({
      where: { id: feedback.decisionId }
    });

    if (decision) {
      decision.feedbackScore = feedback.score;
      decision.feedbackComments = feedback.comments || null;
      
      if (feedback.overriddenBy) {
        decision.overriddenBy = feedback.overriddenBy;
        decision.overrideReason = feedback.overrideReason || null;
        decision.type = DecisionType.MANUAL_OVERRIDE;
      }

      await this.decisionRepository.save(decision);
      
      this.logger.log(`Feedback recorded for decision ${feedback.decisionId}`);
    }
  }

  async getAssignmentHistory(
    ticketId?: string,
    agentId?: string,
    limit: number = 50
  ): Promise<Decision[]> {
    const query = this.decisionRepository.createQueryBuilder('decision')
      .leftJoinAndSelect('decision.agent', 'agent')
      .orderBy('decision.createdAt', 'DESC')
      .limit(limit);

    if (ticketId) {
      query.andWhere('decision.ticketId = :ticketId', { ticketId });
    }

    if (agentId) {
      query.andWhere('agent.id = :agentId', { agentId });
    }

    return query.getMany();
  }

  async deleteOldAssignments(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await this.decisionRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();
    
    this.logger.log(`Deleted ${result.affected} assignments older than ${days} days`);
    return result.affected || 0;
  }

  async deleteAllAssignments(): Promise<number> {
    const result = await this.decisionRepository
      .createQueryBuilder()
      .delete()
      .execute();
    
    this.logger.log(`Deleted all ${result.affected} assignments`);
    return result.affected || 0;
  }

  async deleteAssignment(id: string): Promise<void> {
    const result = await this.decisionRepository.delete(id);
    
    if (result.affected === 0) {
      throw new Error(`Assignment with ID ${id} not found`);
    }
    
    this.logger.log(`Deleted assignment ${id}`);
  }

  async reloadSettings(): Promise<void> {
    await this.loadSettings();
    this.logger.log('Assignment settings reloaded');
  }

  async testAssignmentScenario(scenario: {
    skills: string[];
    level: string;
    locationId?: string;
    isVIP: boolean;
    categoryId?: string;
  }): Promise<{
    eligibleAgents: any[];
    scoredAgents: any[];
    topRecommendations: any[];
    filters: any;
    statistics: any;
  }> {
    this.logger.log(`🧪 Testing assignment scenario`);
    
    // Get the workload limit from settings
    const workloadLimit = await this.getWorkloadLimitFromSettings();
    
    // Build a mock ticket context for testing
    const ticketContext: TicketContext = {
      id: 'test-ticket',
      title: 'Test Scenario',
      requiredSkills: scenario.skills,
      requiredLevel: scenario.level as any,
      locationId: scenario.locationId,
      isVip: scenario.isVIP,
      requiresOnsite: false,  // Don't assume onsite just because location is selected
      relatedSkills: []
    };

    // Get category if provided
    const category = scenario.categoryId 
      ? await this.categoryRepository.findOne({ 
          where: { id: scenario.categoryId } 
        })
      : null;

    // Step 1: Get eligible agents using the same eligibility filters as real assignment
    // NOTE: Don't filter by minLevel for test scenarios - we want to see ALL agents with the skills
    // The scoring will handle level preferences
    const eligibilityResult = await this.eligibilityService.getEligibleAgents({
      ticketId: 'test-ticket',
      categoryId: category?.id,
      requiredSkills: scenario.skills && scenario.skills.length > 0 ? scenario.skills : undefined,
      minLevel: undefined, // Don't restrict by level - let scoring handle it
      requiresOnsite: false,  // Don't assume onsite just because location is selected
      locationId: scenario.locationId,
      checkPTO: false, // Don't check PTO for test scenarios
      ptoAgentIds: [],
      maxLoadPercentage: undefined, // Don't restrict by load for test scenarios
      requireSpecialization: false,
      isTestScenario: true // Flag this as a test scenario to bypass strict filters
    });

    this.logger.log(`Found ${eligibilityResult.eligibleAgents.length} eligible agents out of ${eligibilityResult.totalAgents} total`);

    // Step 2: Score all eligible agents
    const scoringResults = await this.scoringService.scoreMultipleAgents(
      eligibilityResult.eligibleAgents,
      ticketContext
    );

    // Step 3: For test scenarios, don't filter by minimum score - show all agents
    // This lets us see the full picture of scoring
    const qualifiedAgents = scoringResults; // Show all agents in test mode

    // Step 4: For test scenarios, return ALL agents sorted by score, not just top 3
    const topRecommendations = qualifiedAgents; // Return all instead of limiting

    // Calculate statistics
    const statistics = {
      totalAgents: eligibilityResult.totalAgents,
      eligibleAgents: eligibilityResult.eligibleAgents.length,
      scoredAgents: scoringResults.length,
      qualifiedAgents: qualifiedAgents.length,
      averageScore: scoringResults.length > 0
        ? scoringResults.reduce((sum, r) => sum + r.totalScore, 0) / scoringResults.length
        : 0,
      minScoreThreshold: this.minScoreThreshold,
      scoreDistribution: this.calculateScoreDistribution(scoringResults),
      excludedReasons: eligibilityResult.excludedReasons
    };

    // Format eligible agents with details
    const eligibleAgentsDetails = eligibilityResult.eligibleAgents.map(agent => ({
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      email: agent.email,
      level: agent.level,
      location: agent.location?.name || 'Remote',
      skills: agent.skills || [],
      currentWorkload: agent.currentTicketCount,
      weightedWorkload: Number(agent.weightedTicketCount || 0),
      isAvailable: agent.isAvailable
    }));

    // Format scored agents with details
    const scoredAgentsDetails = scoringResults.map(result => {
      const agent = eligibilityResult.eligibleAgents.find(a => a.id === result.agentId);
      return {
        agentId: result.agentId,
        agentName: result.agentName,
        email: agent?.email,
        level: agent?.level,
        location: agent?.location?.name || 'Remote',
        skills: agent?.skills || [],
        currentWorkload: agent?.currentTicketCount || 0,
        weightedWorkload: Number(agent?.weightedTicketCount || 0),
        totalScore: result.totalScore,
        breakdown: result.breakdown,
        eligibility: result.eligibility,
        meetsThreshold: result.totalScore >= this.minScoreThreshold
      };
    });

    // Format all recommendations with assignment reasoning
    const allRecommendations = topRecommendations.map((result, index) => {
      const agent = eligibilityResult.eligibleAgents.find(a => a.id === result.agentId);
      return {
        rank: index + 1,
        agentId: result.agentId,
        agentName: result.agentName,
        email: agent?.email,
        level: agent?.level,
        location: agent?.location?.name || 'Remote',
        skills: agent?.skills || [],
        categorySkills: agent?.categorySkills || [],
        autoDetectedSkills: agent?.autoDetectedSkills || [],
        currentWorkload: agent?.currentTicketCount || 0,
        maxConcurrentTickets: workloadLimit, // Use the workload limit from settings
        weightedWorkload: Number(agent?.weightedTicketCount || 0),
        workloadPercentage: agent ? ((agent.currentTicketCount / workloadLimit) * 100) : 0,
        totalScore: result.totalScore,
        breakdown: result.breakdown,
        meetsMinThreshold: result.totalScore >= this.minScoreThreshold,
        confidence: index === 0 ? this.calculateConfidence(topRecommendations.slice(0, 3)) : undefined,
        assignmentReason: this.generateAssignmentReason(result),
        wouldAutoAssign: index === 0 && this.autoAssignEnabled && result.totalScore >= this.minScoreThreshold
      };
    });

    return {
      eligibleAgents: eligibleAgentsDetails,
      scoredAgents: scoredAgentsDetails,
      topRecommendations: allRecommendations, // All agents sorted by score
      filters: eligibilityResult.filters,
      statistics: {
        ...statistics,
        minScoreThreshold: this.minScoreThreshold,
        agentsMeetingThreshold: allRecommendations.filter(a => a.meetsMinThreshold).length
      }
    };
  }

  private calculateScoreDistribution(scores: any[]): any {
    const distribution = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 }
    ];

    scores.forEach(result => {
      const score = Math.round(result.totalScore * 100);
      if (score <= 20) distribution[0].count++;
      else if (score <= 40) distribution[1].count++;
      else if (score <= 60) distribution[2].count++;
      else if (score <= 80) distribution[3].count++;
      else distribution[4].count++;
    });

    return distribution;
  }

  private async getWorkloadLimitFromSettings(): Promise<number> {
    // Get eligibility rules from settings
    const rulesSettings = await this.settingsRepository.findOne({
      where: { key: 'eligibility.rules' }
    });

    if (rulesSettings && rulesSettings.value) {
      const rules = rulesSettings.value;
      const workloadRule = rules.find((r: any) => r.id === 'workload_limit');
      if (workloadRule && workloadRule.config && workloadRule.config.maxTickets) {
        this.logger.log(`📊 Using workload limit from settings: ${workloadRule.config.maxTickets}`);
        return workloadRule.config.maxTickets;
      }
    }

    // Default fallback
    this.logger.log(`📊 Using default workload limit: 5`);
    return 5;
  }

  async debugAgentSkills(): Promise<any> {
    // Get ALL agents, not just available ones, to see the full picture
    const allAgents = await this.agentRepository.find();
    
    const agentSkillsInfo = allAgents.map(agent => {
      // Collect all skills from all sources
      const allSkills = new Set<string>();
      
      if (agent.skills) {
        agent.skills.forEach(s => allSkills.add(s));
      }
      if (agent.categorySkills) {
        agent.categorySkills.forEach(s => allSkills.add(s));
      }
      if (agent.autoDetectedSkills) {
        agent.autoDetectedSkills.forEach(s => allSkills.add(s));
      }
      if (agent.skillMetadata) {
        if (agent.skillMetadata.manual) {
          agent.skillMetadata.manual.forEach(s => allSkills.add(s));
        }
        if (agent.skillMetadata.category) {
          agent.skillMetadata.category.forEach(item => allSkills.add(item.skill));
        }
      }
      
      const hasOffboarding = Array.from(allSkills).some(s => 
        s.toLowerCase().includes('offboard')
      );
      
      return {
        name: `${agent.firstName} ${agent.lastName}`,
        email: agent.email,
        level: agent.level,
        isAvailable: agent.isAvailable,
        currentTicketCount: agent.currentTicketCount,
        maxConcurrentTickets: agent.maxConcurrentTickets,
        skills: agent.skills || [],
        categorySkills: agent.categorySkills || [],
        autoDetectedSkills: agent.autoDetectedSkills || [],
        skillMetadata: agent.skillMetadata || {},
        allSkills: Array.from(allSkills),
        hasOffboarding,
        capacityFull: agent.currentTicketCount >= agent.maxConcurrentTickets
      };
    });

    // Find agents with offboarding skills
    const withOffboarding = agentSkillsInfo.filter(a => a.hasOffboarding);
    const availableWithOffboarding = withOffboarding.filter(a => a.isAvailable);
    const withCapacityAndOffboarding = availableWithOffboarding.filter(a => !a.capacityFull);

    return {
      totalAgents: allAgents.length,
      availableAgents: agentSkillsInfo.filter(a => a.isAvailable).length,
      agentsWithOffboarding: withOffboarding.length,
      availableAgentsWithOffboarding: availableWithOffboarding.length,
      agentsWithCapacityAndOffboarding: withCapacityAndOffboarding.length,
      sampleAgentsWithOffboarding: withOffboarding.slice(0, 5),
      blockedAgentsWithOffboarding: withOffboarding
        .filter(a => !a.isAvailable || a.capacityFull)
        .map(a => ({
          name: a.name,
          email: a.email,
          isAvailable: a.isAvailable,
          currentTickets: a.currentTicketCount,
          maxTickets: a.maxConcurrentTickets,
          blockedReason: !a.isAvailable ? 'Not available' : 'At capacity'
        })),
      allAgentSkills: agentSkillsInfo
    };
  }
}