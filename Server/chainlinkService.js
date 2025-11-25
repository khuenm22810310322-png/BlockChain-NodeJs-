// Server/chainlinkService.js - Real Chainlink first, CoinGecko fallback
require("dotenv").config();
const axios = require('axios');
const { ethers } = require('ethers');
const { mapCoinGeckoToChainlink, supported } = require('./utils/idMapper');
const { getFeedAddressForPair } = require('./utils/chainlinkFeeds');
const { resolveFeedBySymbols } = require('./utils/feedRegistry');

// Load local metadata cache if available (to avoid CoinGecko API for images/names)
let localMeta = {};
try {
  localMeta = require('./cache/coingecko-meta.json');
} catch (_) {
  // If file missing, we'll fallback to supported list or basic formatting
}

// Simple in-memory cache
const { getFeedForCoin } = require("./services/feedDiscovery");
const { getCacheManager } = require("./utils/cacheManager");

// Get cache manager instance
const cacheManager = getCacheManager();

// De-duplicate concurrent requests for the same cache key
const inFlight = new Map();
// Max allowed age for Chainlink oracle data before we treat it as stale (seconds)
const MAX_CHAINLINK_AGE_SEC = parseInt(process.env.CHAINLINK_MAX_AGE_SECONDS || "3600", 10);

function isFreshUnixSeconds(updatedAtSec) {
	if (!updatedAtSec || isNaN(updatedAtSec)) return false;
	const ageSec = Math.floor(Date.now() / 1000) - Number(updatedAtSec);
	return ageSec >= 0 && ageSec <= MAX_CHAINLINK_AGE_SEC;
}

async function axiosGetWithRetry(url, options, retries = 1, backoffMs = 500) {
	try {
		return await axios.get(url, options);
	} catch (err) {
		const shouldRetry =
			retries > 0 &&
			(err?.response?.status === 429 ||
				(err?.response && err.response.status >= 500) ||
				err?.code === "ECONNABORTED" ||
				(err?.message || "").toLowerCase().includes("timeout"));
		if (shouldRetry) {
			await new Promise((r) => setTimeout(r, backoffMs));
			return axiosGetWithRetry(url, options, retries - 1, backoffMs * 2);
		}
		throw err;
	}
}

// Minimal AggregatorV3Interface ABI (latestRoundData + decimals)
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

// Provider from RPC URL (e.g., Ethereum mainnet or your target network)
const RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.CHAINLINK_RPC_URL;
let provider = undefined;
if (RPC_URL) {
	provider = new ethers.JsonRpcProvider(RPC_URL);
}

async function resolveFeedAddress(pairId) {
	const [base, quote] = pairId.split("-");
	// Try Feed Registry lookup first (requires CHAINLINK_TOKEN_ADDRS and FEED_REGISTRY_ADDRESS in .env)
	try {
		const resolved = await resolveFeedBySymbols(base, quote);
		if (resolved) return resolved;
	} catch (_) {}
	// Fallback to .env configured feed addresses
	const envAddr = getFeedAddressForPair(pairId);
	if (envAddr) return envAddr;
	// Try dynamic discovery via feed registry + DB cache using coinId
	const coinId = base; // base assumed coinGecko id-lowercase
	const discovered = await getFeedForCoin(coinId, base.toUpperCase());
	return discovered;
}

async function readFeedPrice(pairId) {
  try {
    if (!provider) return { price: null, error: 'No RPC configured' };
    // pairId is like 'btc-usd'
    const [base, quote] = pairId.split('-');

    // Try Feed Registry lookup first (requires CHAINLINK_TOKEN_ADDRS and FEED_REGISTRY_ADDRESS in .env)
    let address = null;
    try {
      const resolved = await resolveFeedBySymbols(base, quote);
      if (resolved) {
        address = resolved;
      }
    } catch (e) {
      // ignore and fallback to env mapping
    }

    // Fallback to .env configured feed addresses
    if (!address) {
      address = getFeedAddressForPair(pairId);
    }
    if (!address) return { price: null, error: 'No feed address for pair' };

    const aggregator = new ethers.Contract(address, AGGREGATOR_V3_ABI, provider);
    const [roundId, answer, startedAt, updatedAt, answeredInRound] = await aggregator.latestRoundData();
    const decimals = await aggregator.decimals();

    // Convert int256 answer and decimals -> JS number
    const val = Number(answer) / Math.pow(10, Number(decimals));
    if (!isFinite(val) || val <= 0) return { price: null, error: 'Invalid feed value' };
    return { price: val, updatedAt: Number(updatedAt) };
  } catch (err) {
    return { price: null, error: err.message };
  }
}

// Get Chainlink price for a Chainlink pair id like 'btc-usd'
async function getChainlinkPrice(pairId) {
  const res = await readFeedPrice(pairId);
  return {
    coin: pairId,
    price: res.price,
    error: res.error || null,
    source: 'chainlink',
    updatedAt: res.updatedAt || null,
  };
}

// Get multiple Chainlink prices for chainlink pair IDs
async function getChainlinkPrices(pairIds) {
  if (!pairIds || pairIds.length === 0) return [];
  const results = await Promise.all(pairIds.map((id) => getChainlinkPrice(id)));
  return results;
}

// Micro-cache để tránh spam RPC khi loop 1s (TTL: 10s - tương đương block time Ethereum)
const microCache = new Map(); 

// === HÀM MỚI: CHAINLINK ONLY (NO COINGECKO API) ===
async function getMergedPriceData(coinGeckoIds, bypassCache = false) {
  // console.log('🔍 getMergedPriceData (Chainlink Only) called with:', coinGeckoIds);
  
  const sortedIds = coinGeckoIds.sort().join(',');
  const cacheKey = `merged_cl_only_${sortedIds}`;

  // 1. Nếu không bypass cache (API thường), dùng cacheManager (Redis/Mongo/Memory)
  if (!bypassCache) {
    const cached = await cacheManager.get(cacheKey);
    if (cached) return cached;
  } 
  // 2. Nếu bypass cache (Socket loop), dùng Micro-cache (10s) để tiết kiệm RPC
  else {
    const micro = microCache.get(cacheKey);
    if (micro && Date.now() - micro.ts < 10000) { // 10s TTL
      return micro.data;
    }
  }
  
  // De-duplicate concurrent requests
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const promise = (async () => {
    try {
      // 1. Map IDs and fetch Chainlink prices
      const chainlinkIds = mapCoinGeckoToChainlink(coinGeckoIds);
      const chainlinkPrices = await getChainlinkPrices(chainlinkIds);

      // 2. Build response using local metadata + Chainlink price
      const mergedData = coinGeckoIds.map(id => {
        const lowerId = id.toLowerCase();
        
        // Try to find metadata in this order:
        // 1. localMeta (from cache/coingecko-meta.json)
        // 2. supported list (from supported-coins.json)
        // 3. Fallback to formatting the ID
        
        let meta = localMeta[lowerId];
        if (!meta) {
            const sup = supported.find(c => c.coinGeckoId.toLowerCase() === lowerId);
            if (sup) {
                meta = {
                    name: sup.name,
                    symbol: sup.symbol,
                    image: null // supported-coins.json usually doesn't have images
                };
            }
        }

        const name = meta?.name || id.charAt(0).toUpperCase() + id.slice(1);
        const symbol = (meta?.symbol || id).toUpperCase();
        const image = meta?.image || meta?.large || meta?.small || meta?.thumb || null;

        // Find price
        const chainlinkId = mapCoinGeckoToChainlink([id])[0];
        const chainlinkPriceData = chainlinkPrices.find(p => p.coin === chainlinkId);
        const price = chainlinkPriceData?.price || 0;

        return {
          id: id,
          symbol: symbol,
          name: name,
          image: image,
          market_cap: 0, // Not available from Chainlink
          market_cap_rank: null,
          price_change_percentage_24h: 0, // Not available
          current_price: price,
          price_source: "Chainlink (Oracle)",
          dataSource: "chainlink",
          chainlinkUpdatedAt: chainlinkPriceData?.updatedAt || null,
          chainlinkIsStale: false,
        };
      });

      // Cache the result
      await cacheManager.set(cacheKey, mergedData);
      
      // Update Micro-cache
      microCache.set(cacheKey, { data: mergedData, ts: Date.now() });
      
      return mergedData;
    } catch (error) {
      console.error('Error in getMergedPriceData (CL Only):', error.message);
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
}

// Warm up cache by pre-loading top N feeds
async function warmTopFeeds(topN = 20) {
  try {
    const { supported } = require('./utils/idMapper');
    const topPairs = supported.slice(0, topN).map(c => c.pairId).filter(Boolean);
    console.log(`Warming up cache for top ${topPairs.length} Chainlink feeds...`);
    const results = await getChainlinkPrices(topPairs);
    const successful = results.filter(r => r.price !== null).length;
    console.log(`Cache warmed: ${successful}/${topPairs.length} feeds loaded`);
    return results;
  } catch (error) {
    console.error('Error warming feeds:', error.message);
    throw error;
  }
}

// Wrapper for cache refresh - fetches single Chainlink price
async function getOrFetchChainlink(pairId) {
  try {
    const result = await getChainlinkPrice(pairId);
    return result;
  } catch (error) {
    console.error(`Error fetching Chainlink price for ${pairId}:`, error.message);
    return { coin: pairId, price: null, error: error.message };
  }
}

module.exports = { 
  getChainlinkPrice, 
  getChainlinkPrices, 
  getMergedPriceData,
  warmTopFeeds,
  getOrFetchChainlink
};
