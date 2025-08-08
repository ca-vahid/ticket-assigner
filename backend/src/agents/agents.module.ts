import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsController } from './agents.controller';
import { Agent } from '../database/entities/agent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agent])],
  controllers: [AgentsController],
  exports: [TypeOrmModule]
})
export class AgentsModule {}