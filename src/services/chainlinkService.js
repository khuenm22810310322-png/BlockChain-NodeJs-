require("dotenv").config();
const { ethers } = require("ethers");

// Configure from .env
const RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.CHAINLINK_RPC_URL;
const FEED_ADDRESS = process.env.FEED_BTC_USD || "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c"; // BTC/USD mainnet

const AGGREGATOR_V3_ABI = [
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

async function getCurrentPrice() {
	if (!RPC_URL || !FEED_ADDRESS) {
		throw new Error("Missing RPC_URL or FEED_ADDRESS");
	}
	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const agg = new ethers.Contract(FEED_ADDRESS, AGGREGATOR_V3_ABI, provider);
	const [, answer] = await agg.latestRoundData();
	const decimals = await agg.decimals();
	return Number(answer) / Math.pow(10, Number(decimals));
}

module.exports = { getCurrentPrice };
