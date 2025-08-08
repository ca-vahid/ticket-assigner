const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📦 Setting up database tables...\n');
    await client.connect();

    // Create tables
    const setupSQL = `
      -- Use gen_random_uuid() instead of uuid_generate_v4() (built-in for PostgreSQL 13+)
      
      -- Create categories table
      CREATE TABLE IF NOT EXISTS categories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          required_skills JSONB DEFAULT '[]',
          priority_level VARCHAR(50),
          average_resolution_time INTEGER,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create agents table
      CREATE TABLE IF NOT EXISTS agents (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          freshservice_id VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255) NOT NULL,
          skills JSONB DEFAULT '[]',
          experience_level VARCHAR(50),
          location VARCHAR(255),
          timezone VARCHAR(50),
          is_available BOOLEAN DEFAULT true,
          max_concurrent_tickets INTEGER DEFAULT 5,
          current_ticket_count INTEGER DEFAULT 0,
          average_resolution_time INTEGER,
          satisfaction_score NUMERIC(3,2),
          expertise_areas JSONB DEFAULT '[]',
          last_sync_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create settings table
      CREATE TABLE IF NOT EXISTS settings (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          value JSONB NOT NULL,
          description TEXT,
          category VARCHAR(100),
          is_editable BOOLEAN DEFAULT true,
          last_modified_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create decisions table
      CREATE TABLE IF NOT EXISTS decisions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          ticket_id VARCHAR(255) NOT NULL,
          ticket_subject VARCHAR(500) NOT NULL,
          category_id VARCHAR(255),
          agent_id UUID REFERENCES agents(id),
          type VARCHAR(50) NOT NULL CHECK (type IN ('AUTO_ASSIGNED', 'SUGGESTED', 'MANUAL_OVERRIDE', 'REASSIGNED')),
          score NUMERIC(5,2) NOT NULL,
          score_breakdown JSONB NOT NULL,
          alternatives JSONB,
          overridden_by VARCHAR(255),
          override_reason TEXT,
          feedback_score INTEGER,
          feedback_comments TEXT,
          was_accepted BOOLEAN DEFAULT false,
          context_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          resolution_time INTEGER
      );

      -- Create agent_categories join table
      CREATE TABLE IF NOT EXISTS agent_categories (
          agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
          category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
          PRIMARY KEY (agent_id, category_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_agents_freshservice_id ON agents(freshservice_id);
      CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
      CREATE INDEX IF NOT EXISTS idx_decisions_ticket_id ON decisions(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_agent_id ON decisions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at);
      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    `;

    await client.query(setupSQL);
    console.log('✅ Tables created successfully\n');

    // Insert default settings
    const defaultSettings = `
      INSERT INTO settings (key, value, description, category) VALUES
          ('scoring.weights', '{"skill_overlap": 0.3, "level_closeness": 0.25, "load_balance": 0.25, "location_fit": 0.1, "vip_affinity": 0.1}', 'Weights for scoring algorithm', 'scoring'),
          ('auto_assignment_enabled', 'false', 'Enable automatic ticket assignment', 'assignment'),
          ('max_tickets_per_agent', '10', 'Maximum concurrent tickets per agent', 'assignment'),
          ('business_hours', '{"start": "09:00", "end": "17:00", "timezone": "America/Toronto"}', 'Business hours configuration', 'general')
      ON CONFLICT (key) DO NOTHING;
    `;

    await client.query(defaultSettings);
    console.log('✅ Default settings inserted\n');

    // Verify tables
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('agents', 'categories', 'decisions', 'settings', 'agent_categories')
      ORDER BY table_name;
    `;

    const result = await client.query(verifyQuery);
    console.log('📋 Created tables:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n🎉 Database setup completed successfully!');
    console.log('   You can now run: npm run dev\n');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();