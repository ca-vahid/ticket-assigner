import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SyncService } from '../sync/sync.service';

async function runSync() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const syncService = app.get(SyncService);
    
    console.log('🔄 Starting Freshservice sync...\n');
    
    // Run the sync
    await syncService.syncAll();
    
    console.log('\n✅ Sync completed successfully!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSync();