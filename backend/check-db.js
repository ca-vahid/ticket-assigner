const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function checkDatabase() {
  try {
    await client.connect();
    
    // Check pending skills
    const pendingResult = await client.query(`
      SELECT id, skill_name, status, agent_id, updated_at 
      FROM detected_skills 
      WHERE status = 'PENDING' 
      ORDER BY updated_at DESC 
      LIMIT 10
    `);
    
    console.log('\n📋 Pending Skills:');
    console.log('Count:', pendingResult.rows.length);
    pendingResult.rows.forEach(row => {
      console.log(`  - ${row.skill_name} (ID: ${row.id.substring(0,8)}..., Status: ${row.status}, Updated: ${row.updated_at})`);
    });
    
    // Check a specific skill that was supposedly approved
    const approvedCheck = await client.query(`
      SELECT id, skill_name, status, reviewed_by, reviewed_at, is_active 
      FROM detected_skills 
      WHERE id = '2c895be0-ab8d-4c79-8f2d-bd08896dc926'
    `);
    
    console.log('\n🔍 Skill that was "approved" (ID: 2c895be0-ab8d-4c79-8f2d-bd08896dc926):');
    if (approvedCheck.rows.length > 0) {
      const skill = approvedCheck.rows[0];
      console.log(`  Name: ${skill.skill_name}`);
      console.log(`  Status: ${skill.status}`);
      console.log(`  Reviewed By: ${skill.reviewed_by}`);
      console.log(`  Reviewed At: ${skill.reviewed_at}`);
      console.log(`  Is Active: ${skill.is_active}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkDatabase();