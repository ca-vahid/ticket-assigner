const { Client } = require('pg');
require('dotenv').config();

const migrationSQL = `
-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freshservice_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    timezone VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_locations_freshservice_id ON locations(freshservice_id);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- Add location_id to agents table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agents' AND column_name = 'location_id') THEN
        ALTER TABLE agents ADD COLUMN location_id UUID REFERENCES locations(id);
        CREATE INDEX idx_agents_location ON agents(location_id);
    END IF;
END $$;

-- Add is_remote flag to agents table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agents' AND column_name = 'is_remote') THEN
        ALTER TABLE agents ADD COLUMN is_remote BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Insert some default locations (can be replaced by Freshservice sync)
INSERT INTO locations (freshservice_id, name, city, state, country, timezone, is_active, metadata)
VALUES 
    ('1', 'Vancouver Office', 'Vancouver', 'British Columbia', 'Canada', 'America/Vancouver', true, 
     '{"officeHours": {"start": "09:00", "end": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]}, "supportTypes": ["onsite", "remote"]}'),
    ('2', 'Toronto Office', 'Toronto', 'Ontario', 'Canada', 'America/Toronto', true,
     '{"officeHours": {"start": "09:00", "end": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]}, "supportTypes": ["onsite", "remote"]}'),
    ('3', 'Montreal Office', 'Montreal', 'Quebec', 'Canada', 'America/Montreal', true,
     '{"officeHours": {"start": "09:00", "end": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]}, "supportTypes": ["onsite", "remote"]}'),
    ('4', 'Calgary Office', 'Calgary', 'Alberta', 'Canada', 'America/Edmonton', true,
     '{"officeHours": {"start": "09:00", "end": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]}, "supportTypes": ["onsite", "remote"]}'),
    ('remote', 'Remote', 'Remote', 'Remote', 'Various', 'UTC', true,
     '{"isRemote": true, "supportTypes": ["remote"]}')
ON CONFLICT (freshservice_id) DO NOTHING;
`;

async function runMigration() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'ticket_assigner',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Running locations migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Locations table created successfully!');
    
    // Verify the table was created
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'locations'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nLocations table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if agent table was updated
    const agentColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'agents' AND column_name IN ('location_id', 'is_remote');
    `);
    
    console.log('\nAgent table updates:');
    agentColumns.rows.forEach(row => {
      console.log(`  - Added column: ${row.column_name}`);
    });
    
    // Count locations
    const locationCount = await client.query('SELECT COUNT(*) FROM locations');
    console.log(`\n✅ Created ${locationCount.rows[0].count} default locations`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();