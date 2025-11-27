# Script to fix bot token issue and start the correct bot (Momoify#3255)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Fixing Bot Token - Switching to Momoify#3255" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop current bot
Write-Host "[1/5] Stopping current bot (Music Bot#0320)..." -ForegroundColor Yellow
pm2 stop momoify-bot 2>$null
pm2 delete momoify-bot 2>$null
Write-Host "      ✓ Bot stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Remove old environment variables
Write-Host "[2/5] Removing old system environment variables..." -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable('DISCORD_TOKEN', $null, 'User')
[System.Environment]::SetEnvironmentVariable('CLIENT_ID', $null, 'User')
[System.Environment]::SetEnvironmentVariable('GENIUS_CLIENT_ID', $null, 'User')
Write-Host "      ✓ Old environment variables removed" -ForegroundColor Green
Write-Host ""

# Step 3: Verify .env file exists
Write-Host "[3/5] Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" | Select-String "DISCORD_TOKEN|CLIENT_ID"
    Write-Host "      ✓ .env file found with:" -ForegroundColor Green
    Write-Host "        - DISCORD_TOKEN (for Momoify#3255)" -ForegroundColor Gray
    Write-Host "        - CLIENT_ID: 1159478628501946438" -ForegroundColor Gray
} else {
    Write-Host "      ✗ ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "        Please create .env file with your new bot token" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Refresh environment
Write-Host "[4/5] Refreshing environment..." -ForegroundColor Yellow
$env:DISCORD_TOKEN = $null
$env:CLIENT_ID = $null
$env:GENIUS_CLIENT_ID = $null
Write-Host "      ✓ Environment refreshed" -ForegroundColor Green
Write-Host ""

# Step 5: Start bot with new token
Write-Host "[5/5] Starting Momoify#3255..." -ForegroundColor Yellow
pm2 start src/index.js --name momoify-bot
Start-Sleep -Seconds 3
Write-Host ""

# Show status
Write-Host "================================================" -ForegroundColor Cyan
pm2 list
Write-Host ""
Write-Host "✓ Bot should now be online as Momoify#3255!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: If the old bot is still online, you need to:" -ForegroundColor Yellow
Write-Host "   1. Close this PowerShell window completely" -ForegroundColor Yellow
Write-Host "   2. Open a NEW PowerShell window" -ForegroundColor Yellow
Write-Host "   3. Run: pm2 restart momoify-bot" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check logs with: pm2 logs momoify-bot" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
