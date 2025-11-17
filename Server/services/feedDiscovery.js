// Feed discovery via Chainlink Feed Registry with DB cache and multi-chain support
require("dotenv").config();
const { ethers } = require("ethers");
const TokenAddress = require("../models/TokenAddress");
const DiscoveredFeed = require("../models/DiscoveredFeed");
const { getFeedAddressForPair } = require("../utils/chainlinkFeeds");

// Default Chainlink Feed Registry addresses
const REGISTRY = {
	ethereum: process.env.FEED_REGISTRY_ETHEREUM || process.env.FEED_REGISTRY_ADDRESS || "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf",
	polygon: process.env.FEED_REGISTRY_POLYGON || "0xCf7E21E2cFBe0BAf7f947B7d5Fb25f38d08f50Cb",
	arbitrum: process.env.FEED_REGISTRY_ARBITRUM || "0x0000000000000000000000000000000000000000",
	bsc: process.env.FEED_REGISTRY_BSC || "0x0000000000000000000000000000000000000000",
};

// USD quote address per chain (Chainlink constant is 0x...0348)
const USD_QUOTE = process.env.CHAINLINK_QUOTE_USD || "0x0000000000000000000000000000000000000348";

// RPC endpoints per chain
const RPC = {
	ethereum: process.env.ALCHEMY_RPC_URL || process.env.CHAINLINK_RPC_URL,
	polygon: process.env.POLYGON_RPC_URL,
	arbitrum: process.env.ARBITRUM_RPC_URL,
	bsc: process.env.BSC_RPC_URL,
};

const providers = {};
function getProvider(chain) {
	if (providers[chain]) return providers[chain];
	const url = RPC[chain];
	if (!url) return null;
	try {
		providers[chain] = new ethers.JsonRpcProvider(url);
		return providers[chain];
	} catch {
		return null;
	}
}

const REGISTRY_ABI = [
	{
		inputs: [
			{ internalType: "address", name: "base", type: "address" },
			{ internalType: "address", name: "quote", type: "address" },
		],
		name: "getFeed",
		outputs: [{ internalType: "address", name: "aggregator", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
];

const CHAINS_PRIORITY = ["ethereum", "polygon", "arbitrum", "bsc"];

async function getTokenAddress(coinId, chain) {
	const doc = await TokenAddress.findOne({ coinId }).lean();
	if (!doc) return null;
	return doc.addresses?.[chain] || null;
}

async function upsertTokenAddresses({ coinId, symbol, addresses }) {
	if (!coinId || !addresses) return;
	await TokenAddress.updateOne(
		{ coinId },
		{
			coinId,
			symbol,
			addresses,
		},
		{ upsert: true }
	);
}

async function cacheFeed({ coinId, symbol, chain, feedAddress, source }) {
	if (!feedAddress) return null;
	const doc = await DiscoveredFeed.findOneAndUpdate(
		{ coinId, chain },
		{
			coinId,
			symbol,
			chain,
			feedAddress,
			source: source || "registry",
			lastChecked: new Date(),
			active: true,
		},
		{ new: true, upsert: true }
	);
	return doc;
}

async function lookupRegistry(chain, baseAddr) {
	const provider = getProvider(chain);
	const registryAddr = REGISTRY[chain];
	if (!provider || !registryAddr || registryAddr === ethers.ZeroAddress) return null;
	const registry = new ethers.Contract(registryAddr, REGISTRY_ABI, provider);
	try {
		const agg = await registry.getFeed(baseAddr, USD_QUOTE);
		if (agg && agg !== ethers.ZeroAddress) return agg;
		return null;
	} catch {
		return null;
	}
}

// Main discovery function
async function discoverFeed({ coinId, symbol, addresses }) {
	// 1. Manual mapping fallback (env FEED_*_USD)
	const manual = getFeedAddressForPair(`${symbol?.toLowerCase() || coinId}-usd`);
	if (manual) {
		await cacheFeed({ coinId, symbol, chain: "ethereum", feedAddress: manual, source: "manual" });
		return manual;
	}

	// 2. Try prioritized chains
	for (const chain of CHAINS_PRIORITY) {
		const baseAddr =
			addresses?.[chain] ||
			(await getTokenAddress(coinId, chain));
		if (!baseAddr) continue;
		const feed = await lookupRegistry(chain, baseAddr);
		if (feed) {
			await cacheFeed({ coinId, symbol, chain, feedAddress: feed, source: "registry" });
			return feed;
		}
	}

	return null;
}

// Get feed address with DB cache first
async function getFeedForCoin(coinId, symbol) {
	// DB cache
	const existing = await DiscoveredFeed.findOne({ coinId, active: true }).sort({ updatedAt: -1 }).lean();
	if (existing) return existing.feedAddress;

	return discoverFeed({ coinId, symbol });
}

module.exports = {
	discoverFeed,
	getFeedForCoin,
	upsertTokenAddresses,
	cacheFeed,
	CHAINS_PRIORITY,
};
