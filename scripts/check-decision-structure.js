const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkDecisionStructure() {
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

    // Get a SUGGESTED decision to see its structure
    const result = await client.query(`
      SELECT 
        d.id,
        d.ticket_id,
        d.ticket_subject,
        d.type,
        d.score,
        d.alternatives,
        d.agent_id,
        a.first_name,
        a.last_name,
        a.email
      FROM decisions d
      LEFT JOIN agents a ON d.agent_id = a.id
      WHERE d.type = 'SUGGESTED'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const decision = result.rows[0];
      console.log('SUGGESTED Decision Structure:');
      console.log('Ticket ID:', decision.ticket_id);
      console.log('Subject:', decision.ticket_subject);
      console.log('Primary Agent:', decision.first_name, decision.last_name);
      console.log('Score:', decision.score);
      console.log('\nAlternatives field:');
      console.log(JSON.stringify(decision.alternatives, null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDecisionStructure();