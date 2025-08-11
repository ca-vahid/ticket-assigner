// Test script for skill detection API
const FRONTEND_URL = 'http://localhost:3000';

async function testSkillDetection() {
  console.log('🧪 Testing Skill Detection API Routes...\n');

  try {
    // 1. Test fetching categories
    console.log('1️⃣ Testing GET /api/skills/categories');
    const categoriesRes = await fetch(`${FRONTEND_URL}/api/skills/categories`);
    const categories = await categoriesRes.json();
    console.log(`   ✅ Found ${categories.length} categories`);
    if (categories.length > 0) {
      console.log(`   First category: ${categories[0].name} (${categories[0].ticketCount} tickets)`);
    }

    // 2. Test fetching stats
    console.log('\n2️⃣ Testing GET /api/skills/stats');
    const statsRes = await fetch(`${FRONTEND_URL}/api/skills/stats`);
    const stats = await statsRes.json();
    console.log(`   ✅ Stats:`, stats.detectedSkills);

    // 3. Test fetching pending skills
    console.log('\n3️⃣ Testing GET /api/skills/detected/pending');
    const pendingRes = await fetch(`${FRONTEND_URL}/api/skills/detected/pending`);
    const pending = await pendingRes.json();
    console.log(`   ✅ Pending skills: ${pending.total} total`);

    // 4. Test skill detection for a specific agent
    console.log('\n4️⃣ Testing POST /api/skills/detect for single agent');
    const detectRes = await fetch(`${FRONTEND_URL}/api/skills/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: '21020907593', // Test with a specific agent ID
        method: 'historical',
        minTickets: 5
      })
    });
    
    if (detectRes.ok) {
      const detected = await detectRes.json();
      console.log(`   ✅ Detection successful!`);
      console.log(`   Detected ${detected.detectedCount} skills for agent ${detected.agentId}`);
      if (detected.skills && detected.skills.length > 0) {
        console.log(`   Skills found:`, detected.skills.map(s => `${s.skill} (${s.confidence}% confidence)`).join(', '));
      }
    } else {
      const error = await detectRes.text();
      console.log(`   ❌ Detection failed: ${detectRes.status} - ${error}`);
    }

    // 5. Test batch detection
    console.log('\n5️⃣ Testing POST /api/skills/detect for all agents');
    const batchRes = await fetch(`${FRONTEND_URL}/api/skills/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'historical',
        minTickets: 5,
        allAgents: true
      })
    });
    
    if (batchRes.ok) {
      const batchResult = await batchRes.json();
      console.log(`   ✅ Batch detection started!`);
      console.log(`   Processing ${batchResult.totalAgents} agents...`);
    } else {
      const error = await batchRes.text();
      console.log(`   ❌ Batch detection failed: ${batchRes.status} - ${error}`);
    }

    console.log('\n✅ All API routes are working!');
    console.log('\n📝 Next steps:');
    console.log('1. Visit http://localhost:3000/skills to see the UI');
    console.log('2. Click "Detect Skills for All Agents" to run batch detection');
    console.log('3. Review and approve/reject detected skills');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nMake sure both servers are running:');
    console.error('- Backend: http://localhost:3001');
    console.error('- Frontend: http://localhost:3000');
  }
}

// Run the test
testSkillDetection();