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

    // Add freshservice_id column
    await client.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS freshservice_id VARCHAR UNIQUE
    `);
    console.log('Added freshservice_id column');

    // Add display_id column
    await client.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS display_id INTEGER
    `);
    console.log('Added display_id column');

    console.log('✅ Database updated successfully');
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addColumns();