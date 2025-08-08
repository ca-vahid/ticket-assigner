// Simple test to check if changes are picked up
const axios = require('axios');

async function test() {
  const payload = {
    ticketId: '99999',  // Different ID to distinguish
    ticketData: {
      id: 99999,
      subject: 'Console log test',
      priority: 1
    }
  };
  
  try {
    const response = await axios.post(
      'http://localhost:3001/api/assignment/assign',
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      }
    );
    console.log('Response:', response.data.message);
  } catch (error) {
    if (error.response) {
      console.log('Error:', error.response.data.message);
    } else {
      console.log('Request failed:', error.message);
    }
  }
}

test();