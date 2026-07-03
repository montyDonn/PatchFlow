try {
    $response = Invoke-WebRequest -Method OPTIONS `
        -Uri "http://localhost:5001/api/auth/login" `
        -TimeoutSec 5 `
        -Headers @{
            "Origin"="http://localhost:5173"
            "Access-Control-Request-Method"="POST"
            "Access-Control-Request-Headers"="content-type,authorization"
        }
    Write-Host "STATUS: $($response.StatusCode)"
    Write-Host "HEADERS:"
    $response.Headers.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }
} catch {
    $err = $_.Exception.Response
    Write-Host "STATUS: $($err.StatusCode.value__) $($err.StatusCode)"
    Write-Host "HEADERS:"
    $err.Headers | ForEach-Object { Write-Host "  $_" }
    Write-Host "ERROR: $($_.Exception.Message)"
}
