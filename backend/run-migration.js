// Node.js script to run the updated_at migration
// Run with: node run-migration.js

const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔧 Database Migration Script for Ticket Assigner');
console.log('================================================\n');

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
};

console.log('📁 Database configuration:');
console.log(`   Server: ${dbConfig.host}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   SSL: ${dbConfig.ssl ? 'Enabled' : 'Disabled'}\n`);

const client = new Client(dbConfig);

async function runMigration() {
  try {
    console.log('🚀 Connecting to Azure PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check if column exists
    console.log('🔍 Checking if updated_at column exists...');
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'detected_skills' 
      AND column_name = 'updated_at'
    `);

    if (checkResult.rows.length > 0) {
      console.log('   ℹ️  Column already exists\n');
    } else {
      console.log('   ➕ Column does not exist, adding it...\n');
    }

    // Add updated_at column
    console.log('📝 Adding updated_at column (if not exists)...');
    await client.query(`
      ALTER TABLE detected_skills 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('   ✅ Done\n');

    // Update existing rows
    console.log('📝 Setting initial values for existing rows...');
    const updateResult = await client.query(`
      UPDATE detected_skills 
      SET updated_at = COALESCE(detected_at, CURRENT_TIMESTAMP)
      WHERE updated_at IS NULL
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount} rows\n`);

    // Create trigger function
    console.log('📝 Creating trigger function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    console.log('   ✅ Done\n');

    // Drop old trigger
    console.log('📝 Dropping old trigger (if exists)...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_detected_skills_updated_at ON detected_skills
    `);
    console.log('   ✅ Done\n');

    // Create new trigger
    console.log('📝 Creating new trigger...');
    await client.query(`
      CREATE TRIGGER update_detected_skills_updated_at 
      BEFORE UPDATE ON detected_skills 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('   ✅ Done\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default 
      FROM information_schema.columns 
      WHERE table_name = 'detected_skills' 
      AND column_name IN ('detected_at', 'updated_at')
      ORDER BY ordinal_position
    `);

    console.log('\nColumns in detected_skills table:');
    verifyResult.rows.forEach(row => {
      console.log(`   • ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'NULL'}`);
    });

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('1. Restart the backend server: npm run start:dev');
    console.log('2. Test skill detection on the Agents page');
    console.log('3. Verify pending skills appear in the Skills page');
    console.log('4. Test approve/reject functionality\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check your database credentials in backend/.env');
    console.log('2. Ensure your IP is whitelisted in Azure PostgreSQL firewall rules');
    console.log('3. Verify the database name and server address');
    console.log('4. Make sure SSL is properly configured (DATABASE_SSL=true in .env)\n');
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('================================================');
    console.log('Migration script completed');
  }
}

// Run the migration
runMigration().catch(console.error);