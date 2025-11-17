# ========================================
# DEPLOY CONTRACT AND AUTO-UPDATE .ENV
# ========================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DEPLOY & UPDATE ENVIRONMENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if node is running
Write-Host "Checking if blockchain node is running on port 8545..." -ForegroundColor Yellow
$nodeRunning = Test-NetConnection -ComputerName 127.0.0.1 -Port 8545 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $nodeRunning) {
    Write-Host "ERROR: No blockchain node running on port 8545!" -ForegroundColor Red
    Write-Host "Please start Hardhat node first:" -ForegroundColor Yellow
    Write-Host "  .\start-hardhat.ps1" -ForegroundColor White
    Write-Host "`nOr start Ganache:" -ForegroundColor Yellow
    Write-Host "  .\start-ganache.ps1`n" -ForegroundColor White
    exit 1
}

Write-Host "Node is running!" -ForegroundColor Green

# Deploy contract
Write-Host "`nDeploying P2PMarketplace contract..." -ForegroundColor Yellow
Set-Location -Path "blockchain"

$deployOutput = npx hardhat run scripts/deploy.js --network localhost 2>&1 | Out-String

if ($LASTEXITCODE -eq 0 -or $deployOutput -match "deployed to") {
    Write-Host "`nDeployment successful!" -ForegroundColor Green
    
    # Extract contract address using regex
    if ($deployOutput -match "P2PMarketplace deployed to:\s*([0-9a-fxA-FX]+)") {
        $contractAddress = $matches[1]
        Write-Host "Contract Address: $contractAddress" -ForegroundColor Cyan
        
        # Update Server/.env
        Set-Location -Path ".."
        $envPath = "Server\.env"
        
        if (Test-Path $envPath) {
            Write-Host "`nUpdating $envPath..." -ForegroundColor Yellow
            
            # Read .env file
            $envContent = Get-Content $envPath -Raw
            
            # Replace MARKETPLACE_ADDRESS line
            $envContent = $envContent -replace 'MARKETPLACE_ADDRESS="[^"]*"', "MARKETPLACE_ADDRESS=`"$contractAddress`""
            
            # Write back to file
            Set-Content -Path $envPath -Value $envContent -NoNewline
            
            Write-Host "Updated MARKETPLACE_ADDRESS to: $contractAddress" -ForegroundColor Green
            
            # Show next steps
            Write-Host "`n========================================" -ForegroundColor Cyan
            Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "`nContract deployed at:" -ForegroundColor White
            Write-Host "  $contractAddress" -ForegroundColor Yellow
            Write-Host "`nServer/.env has been updated automatically!" -ForegroundColor Green
            Write-Host "`nNext steps:" -ForegroundColor White
            Write-Host "  1. Start backend:  cd Server; node server.js" -ForegroundColor Cyan
            Write-Host "  2. Start frontend: cd Client; npm run dev" -ForegroundColor Cyan
            Write-Host "`n"
        } else {
            Write-Host "WARNING: Server/.env file not found!" -ForegroundColor Red
            Write-Host "Please manually update MARKETPLACE_ADDRESS to: $contractAddress" -ForegroundColor Yellow
        }
    } else {
        Write-Host "WARNING: Could not extract contract address from output!" -ForegroundColor Red
        Write-Host "Deployment Output:" -ForegroundColor Yellow
        Write-Host $deployOutput
    }
} else {
    Write-Host "`nDeployment failed!" -ForegroundColor Red
    Write-Host "Error Output:" -ForegroundColor Yellow
    Write-Host $deployOutput
    Set-Location -Path ".."
    exit 1
}

Set-Location -Path ".."
