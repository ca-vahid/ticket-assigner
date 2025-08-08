#!/usr/bin/env node

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

console.log('🔍 Testing Azure PostgreSQL connection...\n');

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('Connection details:');
console.log(`  Host: ${process.env.DATABASE_HOST}`);
console.log(`  Port: ${process.env.DATABASE_PORT || 5432}`);
console.log(`  Database: ${process.env.DATABASE_NAME}`);
console.log(`  User: ${process.env.DATABASE_USER}`);
console.log(`  SSL: Enabled\n`);

async function testConnection() {
  try {
    console.log('📡 Connecting to Azure PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test query
    console.log('🔍 Running test query...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query successful!');
    console.log(`  Server time: ${result.rows[0].current_time}`);
    console.log(`  PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}\n`);

    // Check if database exists
    const dbCheck = await client.query(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [process.env.DATABASE_NAME]
    );
    
    if (dbCheck.rows.length > 0) {
      console.log(`✅ Database '${process.env.DATABASE_NAME}' exists`);
    } else {
      console.log(`⚠️  Database '${process.env.DATABASE_NAME}' not found`);
      console.log('   You may need to create it in Azure Portal');
    }

    await client.end();
    console.log('\n🎉 Database connection test completed successfully!');
    console.log('   You can now run: npm run dev\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('   → Check that your DATABASE_HOST is correct');
      console.error('   → Make sure the Azure PostgreSQL server is running');
    } else if (error.message.includes('password authentication failed')) {
      console.error('   → Check your DATABASE_USER and DATABASE_PASSWORD');
      console.error('   → Note: Azure uses username without @servername suffix in connection string');
    } else if (error.message.includes('no pg_hba.conf entry')) {
      console.error('   → Your IP address may not be whitelisted');
      console.error('   → Add your IP in Azure Portal → PostgreSQL → Connection security → Firewall rules');
    }
    
    process.exit(1);
  }
}

testConnection();