try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/assignment/settings/reload" -Method Put
    Write-Host "Settings reloaded successfully"
} catch {
    Write-Host "Error reloading settings: $_"
}