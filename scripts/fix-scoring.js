const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function fixScoring() {
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

    // Set VERY low threshold for testing - basically accept any agent
    await client.query(`
      UPDATE settings 
      SET value = to_jsonb(0.01)
      WHERE key = 'assignment.minScoreThreshold'
    `);
    console.log('Set minimum score threshold to 0.01 (1%)');

    // Also ensure auto-assign is truly enabled
    await client.query(`
      UPDATE settings 
      SET value = to_jsonb(true)
      WHERE key = 'assignment.autoAssignEnabled'
    `);
    console.log('Ensured auto-assign is enabled');

    // Check what settings exist
    const result = await client.query(`
      SELECT key, value 
      FROM settings 
      WHERE category IN ('assignment', 'scoring')
      ORDER BY key
    `);
    
    console.log('\nCurrent settings:');
    result.rows.forEach(row => {
      console.log(`  ${row.key}: ${JSON.stringify(row.value)}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixScoring();