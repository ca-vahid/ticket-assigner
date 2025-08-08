const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function updateAgentSkills() {
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

    // Give all L1 agents general_support skill
    const updateL1 = await client.query(`
      UPDATE agents 
      SET skills = ARRAY['general_support', 'password_reset', 'basic_troubleshooting']
      WHERE level = 'L1'
      RETURNING first_name, last_name
    `);
    console.log(`Updated ${updateL1.rowCount} L1 agents with basic skills`);

    // Give some agents specialized skills
    const specializedUpdates = [
      {
        email: 'mabbaspour@bgcengineering.ca',
        skills: ['general_support', 'password_reset', 'active_directory', 'windows']
      },
      {
        email: 'mshahidullah@bgcengineering.ca',
        skills: ['general_support', 'software', 'installation', 'troubleshooting']
      },
      {
        email: 'alavrenyuk@bgcengineering.ca',
        skills: ['general_support', 'network', 'vpn', 'connectivity']
      }
    ];

    for (const update of specializedUpdates) {
      const result = await client.query(
        `UPDATE agents 
         SET skills = $1
         WHERE email = $2
         RETURNING first_name, last_name`,
        [update.skills, update.email]
      );
      if (result.rowCount > 0) {
        console.log(`Updated ${result.rows[0].first_name} ${result.rows[0].last_name} with specialized skills`);
      }
    }

    // Verify the update
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM agents 
      WHERE 'general_support' = ANY(skills)
    `);
    console.log(`\nTotal agents with 'general_support' skill: ${verifyResult.rows[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

updateAgentSkills();