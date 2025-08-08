const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function addColumns() {
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

    // Add level column
    await client.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'L1'
    `);
    console.log('Added level column');

    // Add total_assignments column
    await client.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS total_assignments INTEGER DEFAULT 0
    `);
    console.log('Added total_assignments column');

    console.log('✅ Database updated successfully');
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addColumns();