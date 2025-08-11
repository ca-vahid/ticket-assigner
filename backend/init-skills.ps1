# PowerShell Script to Initialize Skill Detection System
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SKILL DETECTION INITIALIZATION" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000/api"

# Step 1: Initialize default configurations
Write-Host "Step 1: Creating default skill detection configurations..." -ForegroundColor Yellow

$configs = @(
    @{
        method = "CATEGORY_BASED"
        enabled = $true
        settings = @{
            minimumTickets = 5
            lookbackTickets = 1000
            includeComplexity = $false
        }
    },
    @{
        method = "GROUP_MEMBERSHIP"
        enabled = $false
        settings = @{
            groupSkillMappings = @{
                "IT Support" = @("Windows", "Office 365", "Hardware")
                "Network Team" = @("Networking", "Firewall", "VPN")
                "Database Team" = @("SQL", "Database", "PostgreSQL")
            }
        }
    },
    @{
        method = "RESOLUTION_PATTERNS"
        enabled = $false
        settings = @{
            frequencyThreshold = 10
        }
    },
    @{
        method = "TEXT_ANALYSIS_LLM"
        enabled = $false
        settings = @{
            llmModel = "gpt-3.5-turbo"
            batchSize = 10
            keywordMappings = @{}
        }
    }
)

foreach ($config in $configs) {
    $json = $config | ConvertTo-Json -Depth 10
    Write-Host "  Creating config for: $($config.method)" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/skills/config" `
            -Method POST `
            -ContentType "application/json" `
            -Body $json `
            -ErrorAction Stop
        
        Write-Host "  ✓ $($config.method) configuration created" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "  ℹ $($config.method) configuration already exists" -ForegroundColor Yellow
        } else {
            Write-Host "  ✗ Failed to create $($config.method): $_" -ForegroundColor Red
        }
    }
}

# Step 2: Check current configurations
Write-Host "`nStep 2: Verifying configurations..." -ForegroundColor Yellow
try {
    $configs = Invoke-RestMethod -Uri "$baseUrl/skills/config" -Method GET
    Write-Host "  ✓ Found $($configs.Count) configurations:" -ForegroundColor Green
    foreach ($config in $configs) {
        $status = if ($config.enabled) { "ENABLED" } else { "DISABLED" }
        Write-Host "    - $($config.method): $status" -ForegroundColor White
    }
} catch {
    Write-Host "  ✗ Failed to fetch configurations: $_" -ForegroundColor Red
}

# Step 3: Test detection for a specific agent
Write-Host "`nStep 3: Testing skill detection..." -ForegroundColor Yellow
Write-Host "  Fetching agents..." -ForegroundColor Gray

try {
    $agents = Invoke-RestMethod -Uri "$baseUrl/agents" -Method GET
    if ($agents.Count -gt 0) {
        $testAgent = $agents[0]
        Write-Host "  Testing with agent: $($testAgent.firstName) $($testAgent.lastName) ($($testAgent.email))" -ForegroundColor White
        
        # Run detection for this agent
        $body = @{ agentId = $testAgent.id } | ConvertTo-Json
        $detection = Invoke-RestMethod -Uri "$baseUrl/skills/detect" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body
        
        Write-Host "  ✓ Detection completed!" -ForegroundColor Green
        Write-Host "    Skills detected: $($detection.detectedSkills.Count)" -ForegroundColor White
        
        if ($detection.detectedSkills.Count -gt 0) {
            Write-Host "    Detected skills:" -ForegroundColor White
            foreach ($skill in $detection.detectedSkills) {
                Write-Host "      - $($skill.skillName) (Confidence: $([math]::Round($skill.confidence * 100))%)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  ⚠ No agents found in database" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ Failed to test detection: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  INITIALIZATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Go to http://localhost:3000/skills in your browser" -ForegroundColor White
Write-Host "2. Click 'Run Batch Detection' to detect skills for all agents" -ForegroundColor White
Write-Host "3. Review and approve detected skills" -ForegroundColor White
Write-Host "4. Configure scheduled runs if desired" -ForegroundColor White