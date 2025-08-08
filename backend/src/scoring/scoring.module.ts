import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { Settings } from '../database/entities/settings.entity';
import { Agent } from '../database/entities/agent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settings, Agent])
  ],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService]
})
export class ScoringModule {}