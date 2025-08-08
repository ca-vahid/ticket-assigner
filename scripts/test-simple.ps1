$payload = @{
    ticketId = "99999"
    suggestOnly = $false
    ticketData = @{
        id = 99999
        subject = "Simple test ticket"
        description = "Testing basic assignment without category"
        priority = 2
        status = 2
    }
} | ConvertTo-Json -Depth 10

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/assignment/assign" -Method Post -Body $payload -Headers $headers
    Write-Host "Success: $($response.success)"
    Write-Host "Mode: $($response.mode)"
    Write-Host "Message: $($response.message)"
    
    if ($response.assignedAgent) {
        Write-Host "`nAssigned to:"
        Write-Host "  Name: $($response.assignedAgent.name)"
        Write-Host "  Email: $($response.assignedAgent.email)"
    }
    
    if ($response.suggestions -and $response.suggestions.Count -gt 0) {
        Write-Host "`nTop suggestions:"
        foreach ($suggestion in $response.suggestions) {
            $agent = $suggestion.agent
            Write-Host "  - $($agent.firstName) $($agent.lastName): Score $([math]::Round($suggestion.score, 2))"
        }
    }
    
    if ($response.decisionId) {
        Write-Host "`nDecision ID: $($response.decisionId)"
    }
} catch {
    Write-Host "Error: $_"
}