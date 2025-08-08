import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decision, DecisionType } from '../database/entities/decision.entity';

@Injectable()
export class DecisionsService {
  constructor(
    @InjectRepository(Decision)
    private readonly decisionRepository: Repository<Decision>,
  ) {}

  async create(data: {
    ticketId: string;
    ticketSubject: string;
    agentId: string;
    type: DecisionType;
    score: number;
    scoreBreakdown?: any;
    alternatives?: any[];
    contextData?: any;
  }): Promise<Decision> {
    const decision = this.decisionRepository.create({
      ticketId: data.ticketId,
      ticketSubject: data.ticketSubject,
      agent: { id: data.agentId } as any,
      type: data.type as DecisionType,
      score: data.score,
      scoreBreakdown: data.scoreBreakdown || {},
      alternatives: data.alternatives || [],
      contextData: data.contextData || {},
    });
    
    return this.decisionRepository.save(decision);
  }

  async findAll(limit?: number): Promise<Decision[]> {
    const query = this.decisionRepository
      .createQueryBuilder('decision')
      .leftJoinAndSelect('decision.agent', 'agent')
      .orderBy('decision.createdAt', 'DESC');
    
    if (limit) {
      query.limit(limit);
    }
    
    return query.getMany();
  }

  async findByTicketId(ticketId: string): Promise<Decision[]> {
    return this.decisionRepository.find({
      where: { ticketId },
      relations: ['agent'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateFeedback(
    id: string,
    feedback: { wasAccepted?: boolean; feedbackScore?: number },
  ): Promise<Decision | null> {
    await this.decisionRepository.update(id, feedback);
    return this.decisionRepository.findOne({ 
      where: { id },
      relations: ['agent'] 
    });
  }
}