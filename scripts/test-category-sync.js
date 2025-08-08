const axios = require('axios');
require('dotenv').config({ path: '../backend/.env' });

async function testCategorySync() {
  try {
    const apiKey = process.env.FRESHSERVICE_API_KEY;
    const domain = process.env.FRESHSERVICE_DOMAIN;
    
    console.log('Fetching ticket fields from Freshservice...');
    console.log(`Domain: ${domain}`);
    
    const response = await axios.get(
      `https://${domain}/api/v2/ticket_form_fields`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':X').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const ticketFields = response.data.ticket_fields || [];
    console.log(`Found ${ticketFields.length} ticket fields`);
    
    // Find the security field
    const securityField = ticketFields.find(field => field.name === 'security');
    
    if (securityField) {
      console.log('\n✅ Found "security" field with categories:');
      console.log(`  Field ID: ${securityField.id}`);
      console.log(`  Label: ${securityField.label}`);
      console.log(`  Type: ${securityField.field_type}`);
      console.log(`  Choices: ${securityField.choices.length} categories`);
      
      // Show first 10 categories
      console.log('\nFirst 10 categories:');
      securityField.choices.slice(0, 10).forEach(choice => {
        console.log(`  - [${choice.display_id}] ${choice.value} (ID: ${choice.id})`);
      });
    } else {
      console.log('❌ Could not find "security" field');
      
      // List all field names to debug
      console.log('\nAvailable fields:');
      ticketFields.forEach(field => {
        console.log(`  - ${field.name} (${field.label})`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCategorySync();