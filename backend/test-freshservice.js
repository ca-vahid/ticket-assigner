const axios = require('axios');
require('dotenv').config();

async function testFreshserviceConnection() {
  const apiKey = process.env.FRESHSERVICE_API_KEY;
  const domain = process.env.FRESHSERVICE_DOMAIN;
  
  if (!apiKey || !domain) {
    console.error('❌ Missing FRESHSERVICE_API_KEY or FRESHSERVICE_DOMAIN in .env');
    return;
  }

  console.log(`\n🔍 Testing Freshservice connection...`);
  console.log(`   Domain: ${domain}`);
  console.log(`   API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}\n`);

  try {
    // Test 1: Get tickets
    console.log('📋 Fetching tickets...');
    const ticketsResponse = await axios.get(
      `https://${domain}/api/v2/tickets?per_page=5`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':X').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Successfully fetched ${ticketsResponse.data.tickets.length} tickets\n`);

    // Test 2: Get agents
    console.log('👥 Fetching agents...');
    const agentsResponse = await axios.get(
      `https://${domain}/api/v2/agents?per_page=5`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':X').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Successfully fetched ${agentsResponse.data.agents.length} agents\n`);

    // Test 3: Get ticket fields (categories)
    console.log('🏷️  Fetching ticket fields...');
    const fieldsResponse = await axios.get(
      `https://${domain}/api/v2/ticket_form_fields`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':X').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Successfully fetched ${fieldsResponse.data.ticket_fields.length} ticket fields\n`);

    console.log('🎉 All Freshservice API tests passed!\n');
    console.log('Webhook Secret has been generated: ' + process.env.FRESHSERVICE_WEBHOOK_SECRET?.substring(0, 10) + '...\n');
    console.log('Next steps:');
    console.log('1. Configure webhook in Freshservice admin panel with the secret');
    console.log('2. Set webhook URL to: https://your-domain.com/api/webhooks/freshservice/ticket');
    
  } catch (error) {
    console.error('❌ Freshservice API test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data.message || error.response.statusText}`);
      
      if (error.response.status === 401) {
        console.error('\n⚠️  Authentication failed. Please check your API key.');
      } else if (error.response.status === 404) {
        console.error('\n⚠️  Domain not found. Please check your FRESHSERVICE_DOMAIN.');
      }
    } else {
      console.error(`   Error: ${error.message}`);
    }
  }
}

testFreshserviceConnection();