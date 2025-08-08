import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Agent } from '../database/entities/agent.entity';
import { Category } from '../database/entities/category.entity';
import { Decision } from '../database/entities/decision.entity';
import { Settings } from '../database/entities/settings.entity';

export const getDatabaseConfig = (configService: ConfigService): DataSourceOptions => ({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USER', 'postgres'),
  password: configService.get('DATABASE_PASSWORD', 'postgres'),
  database: configService.get('DATABASE_NAME', 'ticket_assigner'),
  entities: [Agent, Category, Decision, Settings],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false, // Disable auto-sync, we'll use migrations
  logging: configService.get('NODE_ENV') === 'development',
  ssl: configService.get('DATABASE_SSL') === 'true' 
    ? {
        rejectUnauthorized: false // Required for Azure PostgreSQL
      }
    : false,
});

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'ticket_assigner',
  entities: ['src/database/entities/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: true,
};

export const dataSource = new DataSource(dataSourceOptions);