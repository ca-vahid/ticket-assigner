import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecisionsService } from './decisions.service';
import { Decision } from '../database/entities/decision.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Decision])],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}