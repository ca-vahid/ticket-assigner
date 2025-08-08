const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkAgents() {
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

    // Check total agents
    const totalResult = await client.query('SELECT COUNT(*) as count FROM agents');
    console.log(`Total agents: ${totalResult.rows[0].count}`);

    // Check active agents
    const activeResult = await client.query('SELECT COUNT(*) as count FROM agents WHERE is_available = true');
    console.log(`Active agents: ${activeResult.rows[0].count}`);

    // Show some sample agents with their skills
    const sampleResult = await client.query(`
      SELECT first_name, last_name, email, skills, level, is_available, current_ticket_count 
      FROM agents 
      WHERE is_available = true 
      LIMIT 5
    `);
    
    console.log('\nSample active agents:');
    sampleResult.rows.forEach(agent => {
      console.log(`\n${agent.first_name} ${agent.last_name}`);
      console.log(`  Email: ${agent.email}`);
      console.log(`  Level: ${agent.level}`);
      console.log(`  Skills: ${agent.skills ? agent.skills.join(', ') : 'None'}`);
      console.log(`  Current tickets: ${agent.current_ticket_count}`);
    });

    // Check agents with 'general_support' skill (required for Password/MFA category)
    const skillResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM agents 
      WHERE is_available = true 
        AND 'general_support' = ANY(skills)
    `);
    console.log(`\nAgents with 'general_support' skill: ${skillResult.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkAgents();