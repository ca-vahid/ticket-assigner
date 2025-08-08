const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkDecisions() {
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

    // Check decisions
    const decisionResult = await client.query(`
      SELECT d.*, a.first_name, a.last_name 
      FROM decisions d
      LEFT JOIN agents a ON d.agent_id = a.id
      ORDER BY d.created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${decisionResult.rowCount} recent decisions:\n`);
    
    decisionResult.rows.forEach(decision => {
      console.log(`Decision ID: ${decision.id}`);
      console.log(`  Ticket: ${decision.ticket_id} - ${decision.ticket_subject}`);
      console.log(`  Type: ${decision.type}`);
      console.log(`  Score: ${decision.score}`);
      console.log(`  Agent: ${decision.first_name} ${decision.last_name}`);
      console.log(`  Created: ${decision.created_at}`);
      console.log(`  Score Breakdown:`, decision.score_breakdown);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDecisions();