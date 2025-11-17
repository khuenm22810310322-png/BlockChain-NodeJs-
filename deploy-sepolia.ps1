# Deploy to Sepolia Testnet
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY TO SEPOLIA TESTNET" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path "blockchain\.env")) {
    Write-Host "ERROR: blockchain\.env not found!" -ForegroundColor Red
    Write-Host "Please copy blockchain\.env.example to blockchain\.env and fill in SEPOLIA_PRIVATE_KEY" -ForegroundColor Yellow
    exit 1
}

# Check if SEPOLIA_PRIVATE_KEY is set
$envContent = Get-Content "blockchain\.env" -Raw
if ($envContent -notmatch 'SEPOLIA_PRIVATE_KEY="0x[0-9a-fA-F]{64}"') {
    Write-Host "ERROR: SEPOLIA_PRIVATE_KEY not configured!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Steps to configure:" -ForegroundColor Yellow
    Write-Host "1. Open MetaMask" -ForegroundColor White
    Write-Host "2. Switch to Sepolia network" -ForegroundColor White
    Write-Host "3. Get testnet ETH from faucet: https://sepoliafaucet.com" -ForegroundColor White
    Write-Host "4. Go to Account Details > Export Private Key" -ForegroundColor White
    Write-Host "5. Copy private key to blockchain\.env file" -ForegroundColor White
    Write-Host ""
    Write-Host "SEPOLIA_PRIVATE_KEY='0x...'" -ForegroundColor Cyan
    exit 1
}

Write-Host "Deploying P2PMarketplace to Sepolia..." -ForegroundColor Green
Write-Host ""

Set-Location blockchain
npx hardhat run scripts/deploy.js --network sepolia

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
    Write-Host "   RPC_URL='https://ethereum-sepolia-rpc.publicnode.com'" -ForegroundColor Cyan
    Write-Host "3. View on Etherscan:" -ForegroundColor White
    Write-Host "   https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deployment failed! Check errors above." -ForegroundColor Red
}

Set-Location ..
