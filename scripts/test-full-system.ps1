Write-Host "`n🚀 Testing Complete Ticket Assignment System" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor DarkGray

# Test tickets with different categories
$testTickets = @(
    @{
        id = Get-Random -Minimum 100000 -Maximum 999999
        subject = "Password reset for accounting user"
        categoryId = 1000793934  # Password/MFA
    },
    @{
        id = Get-Random -Minimum 100000 -Maximum 999999
        subject = "Software installation - Adobe Creative Suite"
        categoryId = 1000792193  # Software
    },
    @{
        id = Get-Random -Minimum 100000 -Maximum 999999
        subject = "Active Directory account locked"
        categoryId = 1000802316  # Active Directory
    }
)

$headers = @{
    "Content-Type" = "application/json"
    "x-webhook-secret" = "884c8bf4252e27280e757907223b878687acffb5538e4bc2cf29849f316dd1e9"
}

foreach ($ticket in $testTickets) {
    Write-Host "`n📋 Creating ticket: $($ticket.subject)" -ForegroundColor Yellow
    
    $payload = @{
        event_type = "ticket_created"
        ticket = @{
            id = $ticket.id
            display_id = "INC-$($ticket.id)"
            subject = $ticket.subject
            description = "Test ticket for assignment system"
            priority = 2
            status = 2
            custom_fields = @{
                security = $ticket.categoryId
            }
            requester = @{
                id = 1001
                name = "Test User"
                email = "test@example.com"
            }
            created_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
            updated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/webhooks/freshservice/ticket" -Method Post -Body $payload -Headers $headers
        
        if ($response.success) {
            Write-Host "  ✅ Assignment successful!" -ForegroundColor Green
            if ($response.result -and $response.result.assignedAgent) {
                Write-Host "  👤 Assigned to: $($response.result.assignedAgent.name)" -ForegroundColor Cyan
                Write-Host "  📊 Score: $([math]::Round($response.result.confidence * 100, 1))%" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ⚠️ Assignment failed: $($response.message)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`n" + "=" * 60 -ForegroundColor DarkGray
Write-Host "✅ Test complete! Check the dashboard for results." -ForegroundColor Green
Write-Host "🌐 Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "👥 Agents: http://localhost:3000/agents" -ForegroundColor Cyan
Write-Host ""