const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
	// Load deployed tokens
	const deployedPath = path.join(__dirname, "..", "deployed-tokens.json");
	if (!fs.existsSync(deployedPath)) {
		console.error("❌ deployed-tokens.json not found!");
		console.log("Run: npx hardhat run scripts/deploy-full.js --network localhost");
		process.exit(1);
	}

	const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
	const [deployer] = await hre.ethers.getSigners();

	// Get recipient address from command line or use default
	const recipientAddress = process.env.RECIPIENT || process.argv[2];
	
	if (!recipientAddress) {
		console.error("❌ No recipient address provided!");
		console.log("\nUsage:");
		console.log("  npx hardhat run scripts/mint-tokens.js --network localhost <address>");
		console.log("\nExample:");
		console.log("  npx hardhat run scripts/mint-tokens.js --network localhost 0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199");
		process.exit(1);
	}

	console.log("🪙 Minting tokens...");
	console.log("From:", deployer.address);
	console.log("To:  ", recipientAddress);
	console.log("Amount per token: 10,000\n");

	// ERC20 ABI for transfer
	const erc20Abi = [
		"function transfer(address to, uint256 amount) external returns (bool)",
		"function balanceOf(address owner) external view returns (uint256)",
		"function symbol() external view returns (string)",
	];

	const amount = hre.ethers.parseUnits("10000", 18); // 10k tokens each
	let successCount = 0;
	let failCount = 0;

	const tokenEntries = Object.entries(deployed.tokens);
	
	for (const [coinId, tokenAddress] of tokenEntries) {
		try {
			const tokenContract = new hre.ethers.Contract(tokenAddress, erc20Abi, deployer);
			const symbol = await tokenContract.symbol();
			
			// Transfer tokens
			const tx = await tokenContract.transfer(recipientAddress, amount);
			await tx.wait();
			
			successCount++;
			console.log(`✅ [${successCount}/${tokenEntries.length}] Sent 10,000 ${symbol.padEnd(6)} to ${recipientAddress.slice(0, 10)}...`);
		} catch (error) {
			failCount++;
			console.error(`❌ Failed to transfer ${coinId}:`, error.message);
		}
	}

	console.log("\n" + "=".repeat(60));
	console.log("📊 SUMMARY");
	console.log("=".repeat(60));
	console.log("✅ Success:", successCount);
	console.log("❌ Failed: ", failCount);
	console.log("💰 Each token: 10,000 units");
	console.log("🎯 Recipient:", recipientAddress);
	console.log("=".repeat(60));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
