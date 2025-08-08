const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function fixWeightNames() {
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

    // Fix the weight names to match what the code expects
    const correctWeights = {
      skillOverlap: 0.30,
      levelCloseness: 0.25,
      loadBalance: 0.25,
      locationFit: 0.10,
      vipAffinity: 0.10
    };

    await client.query(`
      UPDATE settings 
      SET value = $1
      WHERE key = 'scoring.weights'
    `, [JSON.stringify(correctWeights)]);
    
    console.log('Updated scoring.weights with correct property names:');
    console.log(JSON.stringify(correctWeights, null, 2));

    // Verify the update
    const result = await client.query(`
      SELECT value 
      FROM settings 
      WHERE key = 'scoring.weights'
    `);
    
    console.log('\nVerified weights in database:');
    console.log(JSON.stringify(result.rows[0].value, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixWeightNames();