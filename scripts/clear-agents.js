const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function clearAgents() {
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
    console.log('Connected to database');

    // Clear agents table
    const result = await client.query('DELETE FROM agents');
    console.log(`Deleted ${result.rowCount} agents`);

    console.log('✅ Agents cleared successfully');
  } catch (error) {
    console.error('Error clearing agents:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

clearAgents();