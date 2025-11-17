# Start Ganache with persistence
Write-Host "Starting Ganache with persistence..." -ForegroundColor Green
Write-Host "Database: .\ganache-db" -ForegroundColor Cyan
Write-Host "RPC: http://127.0.0.1:8545" -ForegroundColor Cyan
Write-Host "Chain ID: 1337" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop Ganache" -ForegroundColor Yellow
Write-Host ""

ganache --port 8545 --deterministic --accounts 20 --defaultBalanceEther 10000 --chain.chainId 1337 --database.dbPath .\ganache-db --miner.blockGasLimit 30000000
