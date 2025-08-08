const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function fixAgentSkills() {
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

    // First, let's see what skills are required by categories
    const categoryResult = await client.query(`
      SELECT name, required_skills 
      FROM categories 
      WHERE name IN ('Password / MFA', 'Active Directory Tasks', 'Dev Ops / Software Team / Cambio')
    `);
    
    console.log('Required skills by category:');
    categoryResult.rows.forEach(cat => {
      console.log(`  ${cat.name}: ${JSON.stringify(cat.required_skills)}`);
    });

    // Update ALL agents to have a broader set of skills
    const updates = [
      // Give everyone basic skills
      {
        query: `UPDATE agents SET skills = ARRAY['general_support', 'password_reset', 'basic_troubleshooting'] WHERE level = 'L1' AND (skills IS NULL OR array_length(skills, 1) = 0)`,
        description: 'Basic skills for L1 agents without skills'
      },
      // Add specific skills to some agents
      {
        query: `UPDATE agents SET skills = array_cat(skills, ARRAY['active_directory', 'windows', 'user_management']) WHERE email IN ('mabbaspour@bgcengineering.ca', 'mshahidullah@bgcengineering.ca', 'alavrenyuk@bgcengineering.ca')`,
        description: 'AD skills for specific agents'
      },
      {
        query: `UPDATE agents SET skills = array_cat(skills, ARRAY['software', 'installation', 'troubleshooting']) WHERE email IN ('afong@bgcengineering.ca', 'agrynik@bgcengineering.ca', 'aryan@bgcengineering.ca')`,
        description: 'Software skills for specific agents'
      },
      // Ensure all agents have at least general_support
      {
        query: `UPDATE agents SET skills = array_append(skills, 'general_support') WHERE NOT ('general_support' = ANY(skills))`,
        description: 'Ensure all agents have general_support'
      }
    ];

    for (const update of updates) {
      const result = await client.query(update.query);
      console.log(`\n${update.description}: ${result.rowCount} agents updated`);
    }

    // Show final agent skill distribution
    const finalResult = await client.query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN 'general_support' = ANY(skills) THEN 1 END) as with_general_support,
        COUNT(CASE WHEN 'active_directory' = ANY(skills) THEN 1 END) as with_ad,
        COUNT(CASE WHEN 'software' = ANY(skills) THEN 1 END) as with_software
      FROM agents
      WHERE is_available = true
    `);
    
    console.log('\nFinal skill distribution:');
    const stats = finalResult.rows[0];
    console.log(`  Total available agents: ${stats.total_agents}`);
    console.log(`  With general_support: ${stats.with_general_support}`);
    console.log(`  With active_directory: ${stats.with_ad}`);
    console.log(`  With software: ${stats.with_software}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

fixAgentSkills();