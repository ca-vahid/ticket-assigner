const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function createTestDecision() {
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

    // Get a random available agent
    const agentResult = await client.query(`
      SELECT id, first_name, last_name, email 
      FROM agents 
      WHERE is_available = true 
      AND array_length(skills, 1) > 0
      LIMIT 1
    `);
    
    if (agentResult.rows.length === 0) {
      console.log('No available agents with skills');
      return;
    }

    const agent = agentResult.rows[0];
    console.log(`Using agent: ${agent.first_name} ${agent.last_name} (${agent.email})\n`);

    // Create a test decision
    const ticketId = Math.floor(Math.random() * 900000) + 100000;
    const decision = {
      ticket_id: ticketId.toString(),
      ticket_subject: 'Test Password Reset Request',
      agent_id: agent.id,
      type: 'AUTO_ASSIGNED',
      score: 0.85,
      score_breakdown: {
        skillScore: 1.0,
        levelScore: 0.8,
        loadScore: 0.75,
        locationScore: 0.9,
        vipScore: 0.5
      },
      alternatives: [
        {
          agentId: agent.id,
          agentName: `${agent.first_name} ${agent.last_name}`,
          totalScore: 0.75
        }
      ],
      context_data: {
        categoryId: '1000793934',
        categoryName: 'Password / MFA',
        requiredSkills: ['general_support']
      }
    };

    const insertResult = await client.query(`
      INSERT INTO decisions (
        ticket_id,
        ticket_subject,
        agent_id,
        type,
        score,
        score_breakdown,
        alternatives,
        context_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      decision.ticket_id,
      decision.ticket_subject,
      decision.agent_id,
      decision.type,
      decision.score,
      JSON.stringify(decision.score_breakdown),
      JSON.stringify(decision.alternatives),
      JSON.stringify(decision.context_data)
    ]);

    console.log(`Created decision with ID: ${insertResult.rows[0].id}`);
    console.log(`Ticket #${decision.ticket_id} assigned to ${agent.first_name} ${agent.last_name}`);

    // Verify it was created
    const checkResult = await client.query(`
      SELECT COUNT(*) as count FROM decisions
    `);
    console.log(`\nTotal decisions in database: ${checkResult.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

createTestDecision();