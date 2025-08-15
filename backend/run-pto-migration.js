const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  // Create connection
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'ticket_assigner',
    ssl: process.env.DATABASE_HOST?.includes('azure') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Note: Azure PostgreSQL has built-in UUID support with gen_random_uuid()
    console.log('Using built-in UUID generation');

    // Create enum types for leave
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE leave_type_enum AS ENUM (
          'WFH',
          'Site Visit',
          'Training & Conferences',
          'Training & Conferences (Hourly)',
          'Sick Day',
          'Sick Day (Hourly)',
          'Vacation',
          'Personal Time Off (PTO)',
          'Personal Time Off (PTO) (Hourly)'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('Leave type enum created or already exists');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE leave_status_enum AS ENUM (
          'pending',
          'approved',
          'rejected',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('Leave status enum created or already exists');

    // Create agent_leaves table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_leaves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vacation_tracker_id VARCHAR,
        agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
        leave_type leave_type_enum NOT NULL,
        status leave_status_enum DEFAULT 'approved',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        is_all_day BOOLEAN DEFAULT false,
        duration FLOAT,
        reason VARCHAR,
        notes TEXT,
        is_available_for_work BOOLEAN DEFAULT false,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('agent_leaves table created');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS IDX_agent_leaves_dates 
      ON agent_leaves(agent_id, start_date, end_date)
    `);
    console.log('Created index on agent_leaves dates');

    await client.query(`
      CREATE INDEX IF NOT EXISTS IDX_agent_leaves_type_status 
      ON agent_leaves(leave_type, status)
    `);
    console.log('Created index on leave_type and status');

    // Add columns to agents table if they don't exist
    const columnsToAdd = [
      { name: 'is_pto', type: 'BOOLEAN DEFAULT false' },
      { name: 'current_leave_type', type: 'VARCHAR' },
      { name: 'pto_start_date', type: 'TIMESTAMP' },
      { name: 'pto_end_date', type: 'TIMESTAMP' },
      { name: 'last_vacation_tracker_sync', type: 'TIMESTAMP' }
    ];

    for (const column of columnsToAdd) {
      try {
        await client.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`Added column ${column.name} to agents table`);
      } catch (error) {
        if (error.code === '42701') { // Column already exists
          console.log(`Column ${column.name} already exists`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error);