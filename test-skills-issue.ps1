# PowerShell script to diagnose skill approval and display issues

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
        
        # Show first agent's skills
        $firstAgent = ($backendPending.byAgent | Get-Member -MemberType NoteProperty)[0].Name
        if ($firstAgent) {
            $agentData = $backendPending.byAgent.$firstAgent
            Write-Host "   - Example: $($agentData.agentName) has $($agentData.skills.Count) pending skills" -ForegroundColor Gray
            if ($agentData.skills.Count -gt 0) {
                $firstSkill = $agentData.skills[0]
                Write-Host "     First skill: $($firstSkill.skillName) (ID: $($firstSkill.id.Substring(0,8))..., Status: $($firstSkill.status))" -ForegroundColor Gray
            }
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
            Write-Host "   ⚠️ Mismatch! Backend: $($backendPending.total), Frontend: $($frontendPending.total)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Test approval process
Write-Host "3️⃣ Testing approval process..." -ForegroundColor Yellow

# First, get a pending skill to test with
$testSkillId = $null
$testSkillName = $null

if ($backendPending.byAgent) {
    $firstAgent = ($backendPending.byAgent | Get-Member -MemberType NoteProperty)[0].Name
    if ($firstAgent) {
        $agentData = $backendPending.byAgent.$firstAgent
        if ($agentData.skills.Count -gt 0) {
            $testSkillId = $agentData.skills[0].id
            $testSkillName = $agentData.skills[0].skillName
            Write-Host "   Found test skill: $testSkillName (ID: $($testSkillId.Substring(0,8))...)" -ForegroundColor White
        }
    }
}

if ($testSkillId) {
    Write-Host "   Would you like to test approving this skill? (y/n): " -ForegroundColor Yellow -NoNewline
    $answer = Read-Host
    
    if ($answer -eq 'y') {
        Write-Host "   Sending approval request..." -ForegroundColor White
        
        $approveBody = @{
            skillIds = @($testSkillId)
            approvedBy = "TestScript"
        } | ConvertTo-Json
        
        try {
            # Try backend directly
            $approveResult = Invoke-RestMethod -Uri "$BACKEND_URL/api/skills/detected/approve" -Method Post -Body $approveBody -ContentType "application/json"
            Write-Host "   ✅ Approval response: Approved=$($approveResult.approved), Requested=$($approveResult.requested)" -ForegroundColor Green
            
            if ($approveResult.errors) {
                Write-Host "   ⚠️ Errors: $($approveResult.errors -join ', ')" -ForegroundColor Yellow
            }
            
            # Wait a moment
            Start-Sleep -Seconds 2
            
            # Check if it's still pending
            Write-Host "   Checking if skill is still pending..." -ForegroundColor White
            $checkPending = Invoke-RestMethod -Uri "$BACKEND_URL/api/skills/detected/pending" -Method Get
            
            $stillPending = $false
            foreach ($agentKey in ($checkPending.byAgent | Get-Member -MemberType NoteProperty).Name) {
                $agentSkills = $checkPending.byAgent.$agentKey.skills
                foreach ($skill in $agentSkills) {
                    if ($skill.id -eq $testSkillId) {
                        $stillPending = $true
                        break
                    }
                }
            }
            
            if ($stillPending) {
                Write-Host "   ❌ Skill is STILL showing as pending!" -ForegroundColor Red
                Write-Host "   This means the approval updated the database but the query is still returning it." -ForegroundColor Yellow
            } else {
                Write-Host "   ✅ Skill is no longer in pending list!" -ForegroundColor Green
            }
            
        } catch {
            Write-Host "   ❌ Approval failed: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   No pending skills found to test with" -ForegroundColor Yellow
}

Write-Host ""

# Test 4: Check database directly
Write-Host "4️⃣ Checking database state..." -ForegroundColor Yellow
Write-Host "   Running Node.js database check..." -ForegroundColor White

# Create a simple check script
$dbCheckScript = @"
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
  await client.connect();
  
  const result = await client.query(\`
    SELECT status, COUNT(*) as count 
    FROM detected_skills 
    GROUP BY status
  \`);
  
  console.log('Database skill counts by status:');
  result.rows.forEach(row => {
    console.log(\`  \${row.status}: \${row.count}\`);
  });
  
  await client.end();
}

check().catch(console.error);
"@

$dbCheckScript | Out-File -FilePath "backend\quick-check.js" -Encoding UTF8
Set-Location backend
node quick-check.js
Set-Location ..
Remove-Item "backend\quick-check.js"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Diagnosis complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Common issues found:" -ForegroundColor Yellow
Write-Host "1. Skills are approved in DB but still show as pending - CHECK YOUR FRONTEND CACHE" -ForegroundColor White
Write-Host "2. Frontend might not be refreshing after approval" -ForegroundColor White
Write-Host "3. Backend query might be using wrong status filter" -ForegroundColor White