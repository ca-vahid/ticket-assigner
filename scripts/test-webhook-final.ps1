$payload = @{
    event_type = "ticket_created"
    ticket = @{
        id = 123456
        display_id = "INC-123456"
        subject = "Password reset for user account"
        description = "User forgot password and needs reset"
        priority = 2
        status = 2
        custom_fields = @{
            security = 1000793934  # Password/MFA category
        }
        requester = @{
            id = 1001
            name = "John Doe"
            email = "john.doe@example.com"
        }
        created_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        updated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    }
} | ConvertTo-Json -Depth 10

$headers = @{
    "Content-Type" = "application/json"
    "x-webhook-secret" = "884c8bf4252e27280e757907223b878687acffb5538e4bc2cf29849f316dd1e9"
}

Write-Host "Testing Freshservice webhook with real-like data..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/webhooks/freshservice/ticket" -Method Post -Body $payload -Headers $headers
    
    if ($response.success) {
        Write-Host "✅ Webhook processed successfully!" -ForegroundColor Green
        Write-Host ""
        
        if ($response.result) {
            Write-Host "Assignment Result:" -ForegroundColor Yellow
            Write-Host "  Success: $($response.result.success)"
            Write-Host "  Mode: $($response.result.mode)"
            
            if ($response.result.assignedAgent) {
                Write-Host ""
                Write-Host "Assigned to:" -ForegroundColor Green
                Write-Host "  Name: $($response.result.assignedAgent.name)"
                Write-Host "  Email: $($response.result.assignedAgent.email)"
            }
            
            if ($response.result.decisionId) {
                Write-Host ""
                Write-Host "Decision ID: $($response.result.decisionId)" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "❌ Webhook processing failed: $($response.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}