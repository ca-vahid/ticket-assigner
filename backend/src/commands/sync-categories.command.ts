import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SyncService } from '../sync/sync.service';

async function syncCategories() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const syncService = app.get(SyncService);

  console.log('🔄 Starting category sync...\n');

  try {
    const result = await syncService.syncCategories();
    console.log(`✅ Sync completed: ${result.synced} categories synced\n`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

syncCategories();