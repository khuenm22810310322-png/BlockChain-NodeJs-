# Start Hardhat Node
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  HARDHAT NODE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Hardhat node..." -ForegroundColor Green
Write-Host "RPC: http://127.0.0.1:8545" -ForegroundColor Cyan
Write-Host "Chain ID: 31337" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

cd blockchain
npx hardhat node
