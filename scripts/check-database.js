const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkDatabase() {
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

    // Check total decisions
    const countResult = await client.query('SELECT COUNT(*) as count FROM decisions');
    console.log(`Total decisions in database: ${countResult.rows[0].count}\n`);

    // Get recent decisions
    const decisionsResult = await client.query(`
      SELECT 
        d.id,
        d.ticket_id,
        d.ticket_subject,
        d.type,
        d.score,
        d.created_at,
        a.email as agent_email
      FROM decisions d
      LEFT JOIN agents a ON d.agent_id = a.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `);

    if (decisionsResult.rows.length > 0) {
      console.log('Recent decisions:');
      decisionsResult.rows.forEach(dec => {
        console.log(`  - Ticket #${dec.ticket_id}: ${dec.ticket_subject}`);
        console.log(`    Type: ${dec.type}, Score: ${(dec.score * 100).toFixed(1)}%`);
        console.log(`    Agent: ${dec.agent_email || 'N/A'}`);
        console.log(`    Created: ${dec.created_at}\n`);
      });
    } else {
      console.log('No decisions found in database');
    }

    // Check if categories have required skills
    const categoryResult = await client.query(`
      SELECT name, required_skills, "categoryId"
      FROM categories
      WHERE "categoryId" IN ('1000793934', '1000792193', '1000802316')
    `);
    
    console.log('\nCategories and their required skills:');
    categoryResult.rows.forEach(cat => {
      console.log(`  ${cat.name} (${cat.categoryId}): ${JSON.stringify(cat.required_skills)}`);
    });

    // Check agents with skills
    const agentResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN array_length(skills, 1) > 0 THEN 1 END) as with_skills
      FROM agents
      WHERE is_available = true
    `);
    
    console.log(`\nAvailable agents: ${agentResult.rows[0].total}`);
    console.log(`Agents with skills: ${agentResult.rows[0].with_skills}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();