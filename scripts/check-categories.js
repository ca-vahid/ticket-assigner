const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkCategories() {
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

    // Get all categories
    const result = await client.query(`
      SELECT * FROM categories LIMIT 5
    `);
    
    if (result.rows.length > 0) {
      console.log('Categories table columns:');
      console.log(Object.keys(result.rows[0]).join(', '));
      console.log('\nCategory data:');
      result.rows.forEach(cat => {
        console.log(`\nID: ${cat.id}`);
        console.log(`Name: ${cat.name}`);
        console.log(`Category ID: ${cat.category_id}`);
        console.log(`Required Skills: ${JSON.stringify(cat.required_skills)}`);
      });
    } else {
      console.log('No categories found');
    }

    // Check agents with matching skills
    const skillCheckResult = await client.query(`
      SELECT 
        a.first_name,
        a.last_name,
        a.skills,
        a.is_available
      FROM agents a
      WHERE a.is_available = true
      AND array_length(a.skills, 1) > 0
      LIMIT 5
    `);

    console.log('\n\nSample agents with skills:');
    skillCheckResult.rows.forEach(agent => {
      console.log(`  ${agent.first_name} ${agent.last_name}: ${JSON.stringify(agent.skills)}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkCategories();