import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FreshserviceService } from './freshservice.service';
import { FreshserviceController } from './freshservice.controller';
import { Category } from '../../database/entities/category.entity';
import { AssignmentModule } from '../../assignment/assignment.module';
import { SyncProgressService } from '../../sync/sync-progress.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Category]),
    forwardRef(() => AssignmentModule) // Use forwardRef to avoid circular dependency
  ],
  controllers: [FreshserviceController],
  providers: [FreshserviceService, SyncProgressService],
  exports: [FreshserviceService]
})
export class FreshserviceModule {}