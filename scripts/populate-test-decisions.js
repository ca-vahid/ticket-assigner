const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function populateTestDecisions() {
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

    // Get all available agents
    const agentResult = await client.query(`
      SELECT id, first_name, last_name, email 
      FROM agents 
      WHERE is_available = true 
      AND array_length(skills, 1) > 0
      LIMIT 10
    `);
    
    const agents = agentResult.rows;
    console.log(`Found ${agents.length} available agents\n`);

    // Test tickets with different scenarios
    const testScenarios = [
      {
        subject: 'Password reset for finance user',
        type: 'AUTO_ASSIGNED',
        score: 0.92,
        categoryName: 'Password / MFA'
      },
      {
        subject: 'Install Microsoft Teams',
        type: 'AUTO_ASSIGNED',
        score: 0.88,
        categoryName: 'Software Installation'
      },
      {
        subject: 'VPN connection issues',
        type: 'SUGGESTED',
        score: 0.65,
        categoryName: 'Network'
      },
      {
        subject: 'New user account creation',
        type: 'AUTO_ASSIGNED',
        score: 0.95,
        categoryName: 'Active Directory Tasks'
      },
      {
        subject: 'Email not syncing on mobile',
        type: 'SUGGESTED',
        score: 0.58,
        categoryName: 'Email'
      },
      {
        subject: 'Printer not working',
        type: 'AUTO_ASSIGNED',
        score: 0.75,
        categoryName: 'Hardware'
      },
      {
        subject: 'SharePoint permissions issue',
        type: 'MANUAL_OVERRIDE',
        score: 0.70,
        categoryName: 'SharePoint'
      },
      {
        subject: 'Computer running slow',
        type: 'AUTO_ASSIGNED',
        score: 0.80,
        categoryName: 'Hardware'
      }
    ];

    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      const agent = agents[i % agents.length];
      const ticketId = Math.floor(Math.random() * 900000) + 100000;
      
      // Create alternatives (other agents that could handle this)
      const alternatives = agents
        .filter(a => a.id !== agent.id)
        .slice(0, 3)
        .map((altAgent, idx) => ({
          agentId: altAgent.id,
          agentName: `${altAgent.first_name} ${altAgent.last_name}`,
          totalScore: scenario.score - (0.1 * (idx + 1))
        }));

      const decision = {
        ticket_id: ticketId.toString(),
        ticket_subject: scenario.subject,
        agent_id: agent.id,
        type: scenario.type,
        score: scenario.score,
        score_breakdown: {
          skillScore: 0.8 + Math.random() * 0.2,
          levelScore: 0.7 + Math.random() * 0.3,
          loadScore: 0.6 + Math.random() * 0.4,
          locationScore: 0.8 + Math.random() * 0.2,
          vipScore: Math.random()
        },
        alternatives: alternatives,
        context_data: {
          categoryName: scenario.categoryName,
          requiredSkills: ['general_support']
        }
      };

      await client.query(`
        INSERT INTO decisions (
          ticket_id,
          ticket_subject,
          agent_id,
          type,
          score,
          score_breakdown,
          alternatives,
          context_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        decision.ticket_id,
        decision.ticket_subject,
        decision.agent_id,
        decision.type,
        decision.score,
        JSON.stringify(decision.score_breakdown),
        JSON.stringify(decision.alternatives),
        JSON.stringify(decision.context_data),
        new Date(Date.now() - Math.random() * 86400000) // Random time in last 24 hours
      ]);

      console.log(`✓ Created ${scenario.type}: Ticket #${ticketId} - ${scenario.subject}`);
      console.log(`  Assigned to: ${agent.first_name} ${agent.last_name}`);
    }

    // Verify total count
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

populateTestDecisions();