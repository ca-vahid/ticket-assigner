import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { Location } from '../database/entities/location.entity';
import { Agent } from '../database/entities/agent.entity';
import { LocationSyncService } from '../integrations/freshservice/location-sync.service';
import { FreshserviceModule } from '../integrations/freshservice/freshservice.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, Agent]),
    FreshserviceModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService, LocationSyncService],
  exports: [LocationsService],
})
export class LocationsModule {}