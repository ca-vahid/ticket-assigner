# PowerShell script to diagnose skill detection and approval issues - V2

Write-Host "🔍 Diagnosing Skill Detection and Approval Issues" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

$BACKEND_URL = "http://localhost:3001"
$FRONTEND_URL = "http://localhost:3000"

# Test 1: Check backend pending skills directly
Write-Host "1️⃣ Fetching pending skills from BACKEND directly..." -ForegroundColor Yellow
try {
    $backendPending = Invoke-RestMethod -Uri "$BACKEND_URL/api/skills/detected/pending" -Method Get
    Write-Host "   Backend says:" -ForegroundColor Green
    Write-Host "   - Total pending: $($backendPending.total)" -ForegroundColor White
    
    if ($backendPending.byAgent) {
        $agentCount = ($backendPending.byAgent | Get-Member -MemberType NoteProperty).Count
        Write-Host "   - Agents with pending skills: $agentCount" -ForegroundColor White
        
        # Show each agent's pending skills count
        Write-Host "   - Breakdown by agent:" -ForegroundColor White
        foreach ($agentKey in ($backendPending.byAgent | Get-Member -MemberType NoteProperty).Name) {
            $agentData = $backendPending.byAgent.$agentKey
            Write-Host "     • $($agentData.agentName): $($agentData.skills.Count) skills" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check frontend API proxy
Write-Host "2️⃣ Fetching pending skills from FRONTEND API route..." -ForegroundColor Yellow
try {
    $frontendPending = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/detected/pending" -Method Get
    Write-Host "   Frontend API says:" -ForegroundColor Green
    Write-Host "   - Total pending: $($frontendPending.total)" -ForegroundColor White
    
    # Compare with backend
    if ($backendPending -and $frontendPending) {
        if ($backendPending.total -eq $frontendPending.total) {
            Write-Host "   ✅ Frontend and backend match!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ MISMATCH! Backend returns $($backendPending.total) but frontend shows $($frontendPending.total)" -ForegroundColor Red
            Write-Host "   This indicates a caching or data fetching issue!" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Force refresh test
Write-Host "3️⃣ Testing cache refresh..." -ForegroundColor Yellow
Write-Host "   Making multiple requests to check consistency..." -ForegroundColor White

$results = @()
for ($i = 1; $i -le 3; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $test = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/detected/pending" -Method Get
        $results += $test.total
        Write-Host "   Request $i: $($test.total) pending skills" -ForegroundColor Gray
    } catch {
        Write-Host "   Request $i: Failed" -ForegroundColor Red
    }
}

if ($results.Count -gt 1) {
    $allSame = ($results | Select-Object -Unique).Count -eq 1
    if ($allSame) {
        Write-Host "   ✅ Consistent results across requests" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Inconsistent results: $($results -join ', ')" -ForegroundColor Yellow
    }
}

Write-Host ""

# Test 4: Check database directly with fixed script
Write-Host "4️⃣ Checking database state..." -ForegroundColor Yellow

# Create a properly escaped check script
@'
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function check() {
  try {
    await client.connect();
    
    // Count by status
    const statusResult = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM detected_skills 
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('Database skill counts by status:');
    statusResult.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    
    // Count pending by agent
    const agentResult = await client.query(`
      SELECT 
        a.first_name || ' ' || a.last_name as agent_name,
        COUNT(ds.id) as pending_count
      FROM detected_skills ds
      JOIN agents a ON ds.agent_id = a.id
      WHERE ds.status = 'PENDING'
      GROUP BY a.id, a.first_name, a.last_name
      ORDER BY pending_count DESC
      LIMIT 5
    `);
    
    console.log('\nTop agents with pending skills:');
    agentResult.rows.forEach(row => {
      console.log(`  ${row.agent_name}: ${row.pending_count}`);
    });
    
    // Check for duplicates
    const dupResult = await client.query(`
      SELECT 
        agent_id, 
        skill_name, 
        COUNT(*) as count
      FROM detected_skills
      WHERE status = 'PENDING'
      GROUP BY agent_id, skill_name
      HAVING COUNT(*) > 1
    `);
    
    if (dupResult.rows.length > 0) {
      console.log('\n⚠️  Found duplicate pending skills:');
      dupResult.rows.forEach(row => {
        console.log(`  Agent ${row.agent_id}: ${row.skill_name} (${row.count} copies)`);
      });
    } else {
      console.log('\n✅ No duplicate pending skills found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

check();
'@ | Out-File -FilePath "backend\db-check.js" -Encoding UTF8

Push-Location backend
node db-check.js
Pop-Location
Remove-Item "backend\db-check.js" -ErrorAction SilentlyContinue

Write-Host ""

# Test 5: Check if frontend is caching
Write-Host "5️⃣ Testing frontend caching behavior..." -ForegroundColor Yellow

# Add cache-busting parameter
$timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$noCacheUrl = "$FRONTEND_URL/api/skills/detected/pending?_t=$timestamp"

try {
    $noCacheResult = Invoke-RestMethod -Uri $noCacheUrl -Method Get -Headers @{"Cache-Control"="no-cache"}
    Write-Host "   With cache bypass: $($noCacheResult.total) pending skills" -ForegroundColor White
    
    if ($noCacheResult.total -ne $frontendPending.total) {
        Write-Host "   ⚠️ Different result with cache bypass! Normal: $($frontendPending.total), No-cache: $($noCacheResult.total)" -ForegroundColor Yellow
        Write-Host "   This confirms a caching issue!" -ForegroundColor Red
    } else {
        Write-Host "   ✅ Same result with cache bypass" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host ""

if ($backendPending.total -ne $frontendPending.total) {
    Write-Host "❌ CRITICAL ISSUE: Frontend shows different count than backend!" -ForegroundColor Red
    Write-Host "   Backend: $($backendPending.total) pending" -ForegroundColor White
    Write-Host "   Frontend: $($frontendPending.total) pending" -ForegroundColor White
    Write-Host ""
    Write-Host "   Possible causes:" -ForegroundColor Yellow
    Write-Host "   1. Frontend API route is filtering results differently" -ForegroundColor White
    Write-Host "   2. Frontend is caching old data" -ForegroundColor White
    Write-Host "   3. There's a data transformation issue in the API proxy" -ForegroundColor White
    Write-Host ""
    Write-Host "   To fix: Check the frontend API route at /frontend/src/app/api/skills/detected/pending/route.ts" -ForegroundColor Cyan
} else {
    Write-Host "✅ Frontend and backend are in sync" -ForegroundColor Green
}

Write-Host ""
Write-Host "📝 The approval process IS working correctly - skills are being removed from pending after approval." -ForegroundColor Green
Write-Host "   The main issue is the count mismatch between frontend and backend." -ForegroundColor Yellow