Write-Host "Testing Agents API endpoints..." -ForegroundColor Cyan

# Test GET /api/agents
Write-Host "`nTesting GET /api/agents:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/agents" -Method Get
    Write-Host "Success! Found $($response.Count) agents" -ForegroundColor Green
    if ($response.Count -gt 0) {
        Write-Host "First agent: $($response[0].firstName) $($response[0].lastName)" -ForegroundColor Gray
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

# Test sync endpoint
Write-Host "`nTesting POST /api/admin/sync/agents:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/admin/sync/agents" -Method Post
    Write-Host "Sync response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}