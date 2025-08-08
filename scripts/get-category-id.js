const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function getCategoryId() {
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
    
    const result = await client.query(`
      SELECT id, name, freshservice_id 
      FROM categories 
      WHERE freshservice_id = '1000793934'
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      console.log('Category found:');
      console.log('  ID:', result.rows[0].id);
      console.log('  Name:', result.rows[0].name);
      console.log('  Freshservice ID:', result.rows[0].freshservice_id);
    } else {
      console.log('Category not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

getCategoryId();