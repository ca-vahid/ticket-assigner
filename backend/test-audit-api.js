const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function testAuditAPI() {
  console.log('Testing Audit API endpoints...\n');

  try {
    // Test 1: Create an audit log
    console.log('1. Testing POST /api/audit/log');
    const createResponse = await axios.post(`${API_URL}/api/audit/log`, {
      action: 'Test audit log entry',
      type: 'create',
      user: 'test@example.com',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    console.log('✅ Audit log created:', createResponse.data);
    console.log('');

    // Test 2: Fetch audit logs
    console.log('2. Testing GET /api/audit');
    const getResponse = await axios.get(`${API_URL}/api/audit`, {
      params: { limit: 10 }
    });
    console.log('✅ Audit logs fetched:');
    console.log('Total logs:', getResponse.data.total);
    console.log('First log:', getResponse.data.logs[0]);
    console.log('');

    console.log('🎉 All audit API tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      if (error.response.status === 404) {
        console.error('\n⚠️  The audit endpoints are not available.');
        console.error('Please ensure:');
        console.error('1. The backend has been restarted after adding the AuditModule');
        console.error('2. The AuditModule is properly imported in app.module.ts');
        console.error('3. There are no TypeScript compilation errors');
        console.error('\nTry running: npm run build && npm run start:dev');
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Cannot connect to backend at', API_URL);
      console.error('Make sure the backend is running on port 3001');
    }
  }
}

testAuditAPI();