const hre = require("hardhat");

async function main() {
	const [deployer] = await hre.ethers.getSigners();
	console.log("Deploying with:", deployer.address);

	// Deploy mock ERC20 tokens for testing
	console.log("\n📦 Deploying Mock Tokens...");
	
	const ERC20Factory = await hre.ethers.getContractFactory("ERC20Mock");
	const initialSupply = hre.ethers.parseUnits("1000000", 18); // 1M tokens
	
	// Deploy Bitcoin mock
	const btcToken = await ERC20Factory.deploy("Bitcoin Mock", "BTC", deployer.address, initialSupply);
	await btcToken.waitForDeployment();
	const btcAddress = await btcToken.getAddress();
	console.log("✅ BTC Mock deployed to:", btcAddress);
	
	// Deploy Ethereum mock
	const ethToken = await ERC20Factory.deploy("Ethereum Mock", "ETH", deployer.address, initialSupply);
	await ethToken.waitForDeployment();
	const ethAddress = await ethToken.getAddress();
	console.log("✅ ETH Mock deployed to:", ethAddress);
	
	// Deploy USDT mock
	const usdtToken = await ERC20Factory.deploy("Tether Mock", "USDT", deployer.address, initialSupply);
	await usdtToken.waitForDeployment();
	const usdtAddress = await usdtToken.getAddress();
	console.log("✅ USDT Mock deployed to:", usdtAddress);

	// Deploy P2P Marketplace
	console.log("\n🏪 Deploying P2P Marketplace...");
	const priceFeed = hre.process?.env?.PRICE_FEED || hre.ethers.ZeroAddress;
	const MarketplaceFactory = await hre.ethers.getContractFactory("P2PMarketplace");
	const marketplace = await MarketplaceFactory.deploy(priceFeed);
	await marketplace.waitForDeployment();
	const marketplaceAddress = await marketplace.getAddress();
	console.log("✅ P2PMarketplace deployed to:", marketplaceAddress);

	// Output summary
	console.log("\n" + "=".repeat(60));
	console.log("📋 DEPLOYMENT SUMMARY");
	console.log("=".repeat(60));
	console.log("Marketplace:", marketplaceAddress);
	console.log("BTC Token:  ", btcAddress);
	console.log("ETH Token:  ", ethAddress);
	console.log("USDT Token: ", usdtAddress);
	console.log("=".repeat(60));
	console.log("\n💡 Save these addresses to your .env file!");
	console.log("MARKETPLACE_ADDRESS=\"" + marketplaceAddress + "\"");
	console.log("BTC_TOKEN_ADDRESS=\"" + btcAddress + "\"");
	console.log("ETH_TOKEN_ADDRESS=\"" + ethAddress + "\"");
	console.log("USDT_TOKEN_ADDRESS=\"" + usdtAddress + "\"");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
