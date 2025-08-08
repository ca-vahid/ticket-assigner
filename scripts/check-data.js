const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkData() {
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

    // Check agents
    const agentResult = await client.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_available = true) as active FROM agents');
    console.log('Agents:');
    console.log(`  Total: ${agentResult.rows[0].total}`);
    console.log(`  Active: ${agentResult.rows[0].active}\n`);

    // Check categories
    const categoryResult = await client.query('SELECT COUNT(*) as total FROM categories');
    console.log('Categories:');
    console.log(`  Total: ${categoryResult.rows[0].total}\n`);

    // List first 5 agents
    const agents = await client.query('SELECT first_name, last_name, is_available FROM agents LIMIT 5');
    if (agents.rows.length > 0) {
      console.log('Sample agents:');
      agents.rows.forEach(agent => {
        console.log(`  - ${agent.first_name} ${agent.last_name} (${agent.is_available ? 'Active' : 'Inactive'})`);
      });
    }

  } catch (error) {
    console.error('Error checking data:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkData();