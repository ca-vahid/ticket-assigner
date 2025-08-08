const axios = require('axios');

async function testWebhook() {
  // Simulate a Freshservice ticket created webhook
  const payload = {
    event_type: 'ticket_created',
    ticket: {
      id: 12345,
      display_id: 'INC-12345',
      subject: 'Test ticket - Password reset request',
      description: 'User needs password reset for their account',
      priority: 2,
      status: 2,
      custom_fields: {
        // This is the category ID for "Password / MFA" from our sync
        security: 1000793934 // You can change this to test different categories
      },
      requester: {
        id: 1001,
        name: 'John Doe',
        email: 'john.doe@example.com'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };

  try {
    const response = await axios.post(
      'http://localhost:3001/api/webhooks/freshservice/ticket',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.FRESHSERVICE_WEBHOOK_SECRET || '884c8bf4252e27280e757907223b878687acffb5538e4bc2cf29849f316dd1e9'
        }
      }
    );

    console.log('✅ Webhook test successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Webhook test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Get the webhook secret from environment
require('dotenv').config({ path: '../backend/.env' });

testWebhook();