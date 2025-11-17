const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
	const [deployer] = await hre.ethers.getSigners();
	console.log("Deploying with:", deployer.address);
	console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

	// Load supported coins from Server
	const coinsPath = path.join(__dirname, "..", "..", "Server", "supported-coins.json");
	const coins = JSON.parse(fs.readFileSync(coinsPath, "utf8"));

	console.log("📦 Deploying Mock Tokens for", coins.length, "coins...\n");

	const ERC20Factory = await hre.ethers.getContractFactory("ERC20Mock");
	const initialSupply = hre.ethers.parseUnits("1000000", 18); // 1M tokens per coin

	const tokenAddresses = {};
	let deployed = 0;

	for (const coin of coins) {
		try {
			const token = await ERC20Factory.deploy(
				coin.name + " Mock",
				coin.symbol,
				deployer.address,
				initialSupply
			);
			await token.waitForDeployment();
			const address = await token.getAddress();
			tokenAddresses[coin.coinGeckoId] = address;
			deployed++;
			console.log(`✅ [${deployed}/${coins.length}] ${coin.symbol.padEnd(6)} ${address}`);
		} catch (error) {
			console.error(`❌ Failed to deploy ${coin.symbol}:`, error.message);
		}
	}

	// Deploy P2P Marketplace
	console.log("\n🏪 Deploying P2P Marketplace...");
	const priceFeed = hre.process?.env?.PRICE_FEED || hre.ethers.ZeroAddress;
	const MarketplaceFactory = await hre.ethers.getContractFactory("P2PMarketplace");
	const marketplace = await MarketplaceFactory.deploy(priceFeed);
	await marketplace.waitForDeployment();
	const marketplaceAddress = await marketplace.getAddress();
	console.log("✅ P2PMarketplace deployed to:", marketplaceAddress);

	// Generate .env content
	console.log("\n" + "=".repeat(80));
	console.log("📋 DEPLOYMENT SUMMARY");
	console.log("=".repeat(80));
	console.log("Total Mock Tokens Deployed:", deployed);
	console.log("Marketplace Address:", marketplaceAddress);
	console.log("=".repeat(80));

	// Save to JSON file
	const outputPath = path.join(__dirname, "..", "deployed-tokens.json");
	const output = {
		marketplace: marketplaceAddress,
		tokens: tokenAddresses,
		deployedAt: new Date().toISOString(),
		network: "localhost",
		chainId: 31337,
		deployer: deployer.address,
	};
	fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
	console.log("\n✅ Saved addresses to:", outputPath);

	// Generate .env variables
	console.log("\n💡 Add to Server/.env:");
	console.log("=".repeat(80));
	console.log(`MARKETPLACE_ADDRESS="${marketplaceAddress}"`);
	console.log("\n# Mock Token Addresses");
	
	// Show first 10 for reference
	const entries = Object.entries(tokenAddresses).slice(0, 10);
	entries.forEach(([coinId, address]) => {
		const coin = coins.find(c => c.coinGeckoId === coinId);
		console.log(`${coinId.toUpperCase().replace(/-/g, "_")}_TOKEN="${address}" # ${coin.symbol}`);
	});
	console.log(`# ... and ${deployed - 10} more tokens (see deployed-tokens.json)`);
	console.log("=".repeat(80));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
