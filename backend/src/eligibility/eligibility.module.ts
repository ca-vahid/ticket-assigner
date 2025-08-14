import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EligibilityService } from './eligibility.service';
import { EligibilityController } from './eligibility.controller';
import { Agent } from '../database/entities/agent.entity';
import { Category } from '../database/entities/category.entity';
import { Location } from '../database/entities/location.entity';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Category, Location]),
    LocationsModule
  ],
  controllers: [EligibilityController],
  providers: [EligibilityService],
  exports: [EligibilityService]
})
export class EligibilityModule {}