const axios = require('axios');

async function testWithCategory() {
  const payload = {
    ticketId: '12345',
    categoryId: '019ad391-865a-4f49-806a-6bdde3f6af8d',  // Password / MFA category
    suggestOnly: false,
    ticketData: {
      id: 12345,
      display_id: 'INC-12345',
      subject: 'Test ticket - Password reset request',
      description: 'User needs password reset for their account',
      priority: 2,
      status: 2
    }
  };
  
  console.log('Testing assignment with Password/MFA category...\n');
  
  try {
    const response = await axios.post(
      'http://10.255.255.254:3001/api/assignment/assign',
      payload,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Assignment response:');
    console.log('Success:', response.data.success);
    console.log('Mode:', response.data.mode);
    console.log('Message:', response.data.message);
    
    if (response.data.assignedAgent) {
      console.log('\n👤 Assigned to:');
      console.log('  Name:', response.data.assignedAgent.name);
      console.log('  Email:', response.data.assignedAgent.email);
    }
    
    if (response.data.suggestions && response.data.suggestions.length > 0) {
      console.log('\n💡 Top suggestions:');
      response.data.suggestions.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.agent.name} (Score: ${s.score.toFixed(2)})`);
      });
    }
    
    if (response.data.decisionId) {
      console.log('\n📝 Decision ID:', response.data.decisionId);
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

testWithCategory();