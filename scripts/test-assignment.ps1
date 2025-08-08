$payload = @{
    ticketId = "12345"
    categoryId = "019ad391-865a-4f49-806a-6bdde3f6af8d"
    suggestOnly = $false
    ticketData = @{
        id = 12345
        display_id = "INC-12345"
        subject = "Test ticket - Password reset request"
        description = "User needs password reset for their account"
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
    if ($response.decisionId) {
        Write-Host "Decision ID: $($response.decisionId)"
    }
    if ($response.suggestions) {
        Write-Host "`nSuggestions:"
        $response.suggestions | ForEach-Object {
            Write-Host "  - $($_.agent.firstName) $($_.agent.lastName): Score $($_.score)"
        }
    }
} catch {
    Write-Host "Error: $_"
}