# Deploy P2PMarketplace Contract
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY CONTRACT" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Hardhat/Ganache is running
$nodeRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 8545 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $nodeRunning) {
    Write-Host "ERROR: Blockchain node is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the node first:" -ForegroundColor Yellow
    Write-Host "  Hardhat: .\start-hardhat.ps1" -ForegroundColor Cyan
    Write-Host "  Ganache: .\start-ganache.ps1" -ForegroundColor Cyan
    exit 1
}

Write-Host "Node is running on port 8545" -ForegroundColor Green
Write-Host ""
Write-Host "Deploying P2PMarketplace contract..." -ForegroundColor Yellow

# Deploy contract
Set-Location blockchain
npx hardhat run scripts/deploy.js --network localhost

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Copy the contract address from above" -ForegroundColor White
    Write-Host "2. Update Server\.env:" -ForegroundColor White
    Write-Host "   MARKETPLACE_ADDRESS='0x...'" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deployment failed!" -ForegroundColor Red
}

Set-Location ..
