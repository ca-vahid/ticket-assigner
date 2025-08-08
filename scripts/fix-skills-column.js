const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function fixColumn() {
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

    // Drop the old skills column
    await client.query(`
      ALTER TABLE agents 
      DROP COLUMN IF EXISTS skills
    `);
    console.log('Dropped old skills column');

    // Add new skills column as text array
    await client.query(`
      ALTER TABLE agents 
      ADD COLUMN skills text[]
    `);
    console.log('Added new skills column as text array');

    console.log('✅ Database updated successfully');
  } catch (error) {
    console.error('Error updating database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixColumn();