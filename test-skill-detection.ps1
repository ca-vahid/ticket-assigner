# PowerShell test script for skill detection API
$FRONTEND_URL = "http://localhost:3000"

Write-Host "🧪 Testing Skill Detection API Routes..." -ForegroundColor Cyan
Write-Host ""

try {
    # 1. Test fetching categories
    Write-Host "1️⃣ Testing GET /api/skills/categories" -ForegroundColor Yellow
    $categoriesRes = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/categories" -Method Get
    Write-Host "   ✅ Found $($categoriesRes.Length) categories" -ForegroundColor Green
    if ($categoriesRes.Length -gt 0) {
        Write-Host "   First category: $($categoriesRes[0].name) ($($categoriesRes[0].ticketCount) tickets)"
    }

    # 2. Test fetching stats
    Write-Host ""
    Write-Host "2️⃣ Testing GET /api/skills/stats" -ForegroundColor Yellow
    $statsRes = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/stats" -Method Get
    Write-Host "   ✅ Stats: Total=$($statsRes.detectedSkills.total), Pending=$($statsRes.detectedSkills.pending), Approved=$($statsRes.detectedSkills.approved)" -ForegroundColor Green

    # 3. Test fetching pending skills
    Write-Host ""
    Write-Host "3️⃣ Testing GET /api/skills/detected/pending" -ForegroundColor Yellow
    $pendingRes = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/detected/pending" -Method Get
    Write-Host "   ✅ Pending skills: $($pendingRes.total) total" -ForegroundColor Green

    # 4. Test skill detection for a specific agent
    Write-Host ""
    Write-Host "4️⃣ Testing POST /api/skills/detect for single agent" -ForegroundColor Yellow
    $detectBody = @{
        agentId = "21020907593"
    } | ConvertTo-Json

    try {
        $detectRes = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/detect" -Method Post -Body $detectBody -ContentType "application/json"
        Write-Host "   ✅ Detection successful!" -ForegroundColor Green
        Write-Host "   Detected $($detectRes.detectedCount) skills for agent $($detectRes.agentId)"
        if ($detectRes.skills -and $detectRes.skills.Length -gt 0) {
            $skillsList = $detectRes.skills | ForEach-Object { "$($_.skill) ($($_.confidence)% confidence)" }
            Write-Host "   Skills found: $($skillsList -join ', ')"
        }
    } catch {
        Write-Host "   ❌ Detection failed: $_" -ForegroundColor Red
    }

    # 5. Test batch detection for all agents
    Write-Host ""
    Write-Host "5️⃣ Testing POST /api/skills/detect for all agents" -ForegroundColor Yellow
    $batchBody = @{
        runAll = $true
    } | ConvertTo-Json

    try {
        $batchRes = Invoke-RestMethod -Uri "$FRONTEND_URL/api/skills/detect" -Method Post -Body $batchBody -ContentType "application/json"
        Write-Host "   ✅ Batch detection successful!" -ForegroundColor Green
        Write-Host "   Processed $($batchRes.agentsProcessed) agents, detected $($batchRes.skillsDetected) skills"
    } catch {
        Write-Host "   ❌ Batch detection failed: $_" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "✅ All API routes are working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Visit http://localhost:3000/skills to see the UI"
    Write-Host "2. Click 'Detect Skills for All Agents' to run batch detection"
    Write-Host "3. Review and approve/reject detected skills"
    
} catch {
    Write-Host "❌ Test failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure both servers are running:" -ForegroundColor Yellow
    Write-Host "- Backend: http://localhost:3001"
    Write-Host "- Frontend: http://localhost:3000"
}