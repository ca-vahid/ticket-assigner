const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkTestCategories() {
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

    // Check if the test category IDs exist
    const testIds = ['1000793934', '1000792193', '1000802316'];
    const result = await client.query(`
      SELECT id, name, freshservice_id, required_skills 
      FROM categories 
      WHERE freshservice_id = ANY($1)
    `, [testIds]);
    
    if (result.rows.length > 0) {
      console.log('Categories matching test IDs:');
      result.rows.forEach(cat => {
        console.log(`  ${cat.name} (${cat.freshservice_id}): ${JSON.stringify(cat.required_skills)}`);
      });
    } else {
      console.log('No categories found with test IDs: ' + testIds.join(', '));
      
      // Show what categories we do have
      const allCats = await client.query(`
        SELECT name, freshservice_id, required_skills 
        FROM categories 
        WHERE freshservice_id IS NOT NULL
        LIMIT 10
      `);
      
      console.log('\nAvailable categories with freshservice_id:');
      allCats.rows.forEach(cat => {
        console.log(`  ${cat.name} (${cat.freshservice_id}): ${JSON.stringify(cat.required_skills)}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTestCategories();