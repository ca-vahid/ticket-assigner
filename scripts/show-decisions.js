const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function showDecisions() {
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
    console.log('📊 Assignment Decision History\n');
    console.log('='.repeat(80));

    const result = await client.query(`
      SELECT 
        d.id,
        d.ticket_id,
        d.ticket_subject,
        d.type,
        d.score,
        d.score_breakdown,
        d.alternatives,
        d.created_at,
        a.first_name,
        a.last_name,
        a.email
      FROM decisions d
      LEFT JOIN agents a ON d.agent_id = a.id
      ORDER BY d.created_at DESC
      LIMIT 10
    `);
    
    result.rows.forEach((decision, index) => {
      console.log(`\n${index + 1}. Ticket #${decision.ticket_id}: ${decision.ticket_subject}`);
      console.log('   ' + '-'.repeat(76));
      console.log(`   Decision Type: ${decision.type}`);
      console.log(`   Assigned To: ${decision.first_name} ${decision.last_name} (${decision.email})`);
      console.log(`   Total Score: ${(decision.score * 100).toFixed(1)}%`);
      console.log(`   Created: ${new Date(decision.created_at).toLocaleString()}`);
      
      if (decision.score_breakdown) {
        console.log('   Score Breakdown:');
        Object.entries(decision.score_breakdown).forEach(([key, value]) => {
          console.log(`     - ${key}: ${(value * 100).toFixed(0)}%`);
        });
      }
      
      if (decision.alternatives && decision.alternatives.length > 0) {
        console.log('   Alternative Agents:');
        decision.alternatives.forEach((alt, i) => {
          console.log(`     ${i + 1}. ${alt.agentName}: ${(alt.totalScore * 100).toFixed(1)}%`);
        });
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total decisions shown: ${result.rowCount}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

showDecisions();