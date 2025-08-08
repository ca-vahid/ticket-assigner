const axios = require('axios');

async function testAssignment() {
  console.log('Testing assignment with debug info...\n');
  
  const payload = {
    ticketId: '12345',
    categoryId: null,
    suggestOnly: false,
    ticketData: {
      id: 12345,
      subject: 'Test ticket - Password reset',
      description: 'User needs password reset',
      priority: 2,
      status: 2
    }
  };
  
  console.log('Request payload:', JSON.stringify(payload, null, 2));
  console.log('\n---\n');
  
  try {
    const response = await axios.post(
      'http://localhost:3001/api/assignment/assign',
      payload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Assignment response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (!response.data.success) {
      console.log('\n⚠️  Assignment failed with message:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Request failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAssignment();