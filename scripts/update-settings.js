const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function updateSettings() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check current settings
    const checkResult = await client.query(`
      SELECT key, value, description 
      FROM settings 
      WHERE category = 'assignment'
    `);
    
    console.log('Current assignment settings:');
    checkResult.rows.forEach(row => {
      console.log(`  ${row.key}: ${row.value} (${row.description || 'No description'})`);
    });

    // Insert or update settings
    const settings = [
      {
        key: 'assignment.minScoreThreshold',
        value: 0.1,  // Lower threshold for testing
        description: 'Minimum score threshold for agent assignment',
        category: 'assignment'
      },
      {
        key: 'assignment.autoAssignEnabled',
        value: true,
        description: 'Enable automatic assignment',
        category: 'assignment'
      },
      {
        key: 'assignment.maxSuggestionsCount',
        value: 3,
        description: 'Maximum number of agent suggestions',
        category: 'assignment'
      }
    ];

    for (const setting of settings) {
      await client.query(`
        INSERT INTO settings (id, key, value, description, category, is_editable)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, description = $3
      `, [setting.key, setting.value, setting.description, setting.category]);
      console.log(`\nUpdated ${setting.key} to ${setting.value}`);
    }

    // Also update scoring weights for better results
    const scoringWeights = {
      key: 'scoring.weights',
      value: {
        skillMatch: 0.30,
        levelMatch: 0.25,
        workload: 0.25,
        location: 0.10,
        vipAffinity: 0.10
      },
      description: 'Scoring weights for agent assignment',
      category: 'scoring'
    };

    await client.query(`
      INSERT INTO settings (id, key, value, description, category, is_editable)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
      ON CONFLICT (key) 
      DO UPDATE SET value = $2, description = $3
    `, [scoringWeights.key, scoringWeights.value, scoringWeights.description, scoringWeights.category]);
    console.log(`\nUpdated scoring weights`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

updateSettings();