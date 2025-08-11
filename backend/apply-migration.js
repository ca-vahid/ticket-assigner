const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ticket_assigner',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add-skill-detection.sql'),
      'utf8'
    );

    console.log('Applying migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration applied successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
  } finally {
    await client.end();
  }
}

applyMigration();