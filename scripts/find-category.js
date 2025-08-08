const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function findCategory() {
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

    // Find categories with "password" in the name
    const result = await client.query(`
      SELECT freshservice_id, name, display_id, required_skills 
      FROM categories 
      WHERE LOWER(name) LIKE '%password%' 
         OR LOWER(name) LIKE '%active%'
         OR LOWER(name) LIKE '%software%'
      ORDER BY name
    `);
    
    console.log('Sample categories for testing:');
    result.rows.forEach(cat => {
      console.log(`\n  ${cat.name}`);
      console.log(`    Freshservice ID: ${cat.freshservice_id}`);
      console.log(`    Display ID: ${cat.display_id}`);
      console.log(`    Skills: ${JSON.stringify(cat.required_skills)}`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

findCategory();