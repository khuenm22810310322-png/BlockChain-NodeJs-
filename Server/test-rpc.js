// Quick RPC + Chainlink feed check
// Usage: node test-rpc.js
require("dotenv").config();
const { ethers } = require("ethers");
const { getFeedAddressForPair } = require("./utils/chainlinkFeeds");

async function main() {
	const RPC = process.env.ALCHEMY_RPC_URL || process.env.CHAINLINK_RPC_URL;
	if (!RPC) {
		console.error("Missing ALCHEMY_RPC_URL or CHAINLINK_RPC_URL in .env");
		process.exit(1);
	}

	const provider = new ethers.JsonRpcProvider(RPC);
	console.log("RPC endpoint:", RPC);

	// Test basic connectivity
	const block = await provider.getBlockNumber();
	console.log("Current block number:", block);

	// Test a known feed (BTC-USD)
	const btcPair = "btc-usd";
	const feedAddr = getFeedAddressForPair(btcPair);
	if (!feedAddr) {
		console.error("Cannot find BTC/USD feed address from addresses.json");
		process.exit(1);
	}
	console.log("BTC/USD feed address:", feedAddr);

	const ABI = [
		{
			inputs: [],
			name: "decimals",
			outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
			stateMutability: "view",
			type: "function",
		},
		{
			inputs: [],
			name: "latestRoundData",
			outputs: [
				{ internalType: "uint80", name: "roundId", type: "uint80" },
				{ internalType: "int256", name: "answer", type: "int256" },
				{ internalType: "uint256", name: "startedAt", type: "uint256" },
				{ internalType: "uint256", name: "updatedAt", type: "uint256" },
				{ internalType: "uint80", name: "answeredInRound", type: "uint80" },
			],
			stateMutability: "view",
			type: "function",
		},
	];

	const agg = new ethers.Contract(feedAddr, ABI, provider);
	const [, answer, , updatedAt] = await agg.latestRoundData();
	const decimals = await agg.decimals();
	const price = Number(answer) / Math.pow(10, Number(decimals));
	console.log("BTC/USD price:", price);
	console.log("Feed updatedAt (unix):", Number(updatedAt));
	console.log("Test completed OK");
}

main().catch((e) => {
	console.error("Test failed:", e?.message || e);
	process.exit(1);
});
