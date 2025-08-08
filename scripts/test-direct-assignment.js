const axios = require('axios');

async function testDirectAssignment() {
  try {
    const response = await axios.post(
      'http://localhost:3001/api/assignment/assign',
      {
        ticketId: '12345',
        categoryId: null,  // We'll test without category first
        suggestOnly: false,
        ticketData: {
          id: 12345,
          subject: 'Test ticket - Password reset',
          description: 'User needs password reset',
          priority: 2,
          status: 2
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Direct assignment test successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Direct assignment test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testDirectAssignment();