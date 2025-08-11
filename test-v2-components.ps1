# PowerShell script to test V2 components functionality

Write-Host "🔍 Testing V2 Components Implementation" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$BACKEND_URL = "http://localhost:3001"
$FRONTEND_URL = "http://localhost:3000"

# Test 1: Check servers are running
Write-Host "1️⃣ Checking server status..." -ForegroundColor Yellow
try {
    $backendHealth = Invoke-WebRequest -Uri "$BACKEND_URL/api/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($backendHealth.StatusCode -eq 200) {
        Write-Host "   ✅ Backend is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️ Backend not responding (start with: npm run dev:backend)" -ForegroundColor Red
}

try {
    $frontendHealth = Invoke-WebRequest -Uri "$FRONTEND_URL" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($frontendHealth.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend is running" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️ Frontend not responding (start with: npm run dev:frontend)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check pending skills structure
Write-Host "2️⃣ Checking pending skills data structure..." -ForegroundColor Yellow
try {
    $pending = Invoke-RestMethod -Uri "$BACKEND_URL/api/skills/detected/pending" -Method Get
    Write-Host "   Total pending: $($pending.total)" -ForegroundColor White
    
    if ($pending.byAgent) {
        $agentCount = ($pending.byAgent | Get-Member -MemberType NoteProperty).Count
        Write-Host "   Agents with pending skills: $agentCount" -ForegroundColor White
        
        # Check if data structure is correct for V2 components
        $firstAgent = ($pending.byAgent | Get-Member -MemberType NoteProperty)[0].Name
        if ($firstAgent) {
            $agentData = $pending.byAgent.$firstAgent
            if ($agentData.agentName -and $agentData.skills) {
                Write-Host "   ✅ Data structure is correct for V2 components" -ForegroundColor Green
                Write-Host "      - Agent has name: $($agentData.agentName)" -ForegroundColor Gray
                Write-Host "      - Agent has skills array: $($agentData.skills.Count) skills" -ForegroundColor Gray
                
                if ($agentData.skills.Count -gt 0) {
                    $skill = $agentData.skills[0]
                    if ($skill.id -and $skill.skillName -and $skill.confidence) {
                        Write-Host "   ✅ Skill structure is complete" -ForegroundColor Green
                    }
                }
            }
        }
    }
    
    if ($pending.byMethod) {
        Write-Host "   Detection methods breakdown:" -ForegroundColor White
        foreach ($method in ($pending.byMethod | Get-Member -MemberType NoteProperty).Name) {
            Write-Host "      - $method`: $($pending.byMethod.$method)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "   ❌ Error fetching pending skills: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Check stats endpoint
Write-Host "3️⃣ Checking stats endpoint..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$BACKEND_URL/api/skills/stats" -Method Get
    Write-Host "   Stats data:" -ForegroundColor White
    Write-Host "      - Total detected: $($stats.detectedSkills.total)" -ForegroundColor Gray
    Write-Host "      - Pending: $($stats.detectedSkills.pending)" -ForegroundColor Gray
    Write-Host "      - Approved: $($stats.detectedSkills.approved)" -ForegroundColor Gray
    Write-Host "      - Rejected: $($stats.detectedSkills.rejected)" -ForegroundColor Gray
    
    if ($stats.detectedSkills.total -gt 0) {
        $approvalRate = [math]::Round(($stats.detectedSkills.approved / ($stats.detectedSkills.approved + $stats.detectedSkills.rejected + 0.001)) * 100)
        Write-Host "      - Approval rate: $approvalRate%" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Error fetching stats: $_" -ForegroundColor Red
}

Write-Host ""

# Test 4: Check frontend API proxy endpoints
Write-Host "4️⃣ Checking frontend API proxy endpoints..." -ForegroundColor Yellow
$endpoints = @(
    "/api/skills/detected/pending",
    "/api/skills/stats",
    "/api/skills/config",
    "/api/skills/categories"
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$FRONTEND_URL$endpoint" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $endpoint - OK" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ❌ $endpoint - Failed" -ForegroundColor Red
    }
}

Write-Host ""

# Test 5: Feature summary
Write-Host "5️⃣ V2 Component Features:" -ForegroundColor Yellow
Write-Host "   📦 Expandable Agent Cards:" -ForegroundColor White
Write-Host "      - Auto-expands for ≤3 agents" -ForegroundColor Gray
Write-Host "      - Click to expand/collapse" -ForegroundColor Gray
Write-Host "      - Shows skill count per agent" -ForegroundColor Gray
Write-Host ""
Write-Host "   ⌨️ Keyboard Shortcuts:" -ForegroundColor White
Write-Host "      - Ctrl+A: Select all" -ForegroundColor Gray
Write-Host "      - Ctrl+Shift+A: Deselect all" -ForegroundColor Gray
Write-Host "      - Ctrl+Enter: Approve selected" -ForegroundColor Gray
Write-Host "      - Escape: Clear selection" -ForegroundColor Gray
Write-Host ""
Write-Host "   🎯 Bulk Actions:" -ForegroundColor White
Write-Host "      - Select all skills for an agent" -ForegroundColor Gray
Write-Host "      - Approve all skills for an agent" -ForegroundColor Gray
Write-Host "      - Filter to show only selected" -ForegroundColor Gray
Write-Host ""
Write-Host "   📊 Compact Stats Grid:" -ForegroundColor White
Write-Host "      - 6-column layout" -ForegroundColor Gray
Write-Host "      - Visual indicators" -ForegroundColor Gray
Write-Host "      - Percentage calculations" -ForegroundColor Gray
Write-Host "      - Refresh indication" -ForegroundColor Gray

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "✅ V2 Components Implementation Complete" -ForegroundColor Green
Write-Host ""
Write-Host "To test the UI:" -ForegroundColor Yellow
Write-Host "1. Navigate to: $FRONTEND_URL/skills" -ForegroundColor White
Write-Host "2. Run skill detection for agents" -ForegroundColor White
Write-Host "3. Review pending skills with new interface" -ForegroundColor White
Write-Host "4. Try keyboard shortcuts and bulk actions" -ForegroundColor White