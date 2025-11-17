// Server/chainlinkService.js - Real Chainlink first, CoinGecko fallback
require("dotenv").config();
const axios = require('axios');
const { ethers } = require('ethers');
const { mapCoinGeckoToChainlink } = require('./utils/idMapper');
const { getFeedAddressForPair } = require('./utils/chainlinkFeeds');
const { resolveFeedBySymbols } = require('./utils/feedRegistry');

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

// === HÀM MỚI: KẾT HỢP HYBRID ===
async function getMergedPriceData(coinGeckoIds) {
  console.log('🔍 getMergedPriceData called with coins:', coinGeckoIds);
  
  // Check cache first
  const cacheKey = `merged_${coinGeckoIds.sort().join(',')}`;
  const cached = await cacheManager.get(cacheKey);
  if (cached) {
    console.log('✅ Returning cached data for', coinGeckoIds.length, 'coins:', cached.map(c => c.id));
    return cached;
  }
  
  console.log('⏳ Cache miss, fetching fresh data...');

  // De-duplicate concurrent requests for the same key
  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const idsString = coinGeckoIds.join(',');
  const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsString}&order=market_cap_desc&sparkline=false`;
  
  const chainlinkIds = mapCoinGeckoToChainlink(coinGeckoIds);
  const promise = (async () => {
    try {
      // 1. Gọi song song CoinGecko (metadata) và Chainlink (giá)
      const [coingeckoResponse, chainlinkPrices] = await Promise.all([
        axiosGetWithRetry(coingeckoUrl, { 
          timeout: 30000, // 30 seconds
          headers: { 'Accept': 'application/json' }
        }, 1, 500),
        getChainlinkPrices(chainlinkIds)
      ]);

      const coingeckoData = coingeckoResponse.data;

      // 2. Trộn (Merge) dữ liệu kèm kiểm tra độ mới của Chainlink
      const mergedData = coingeckoData.map(coin => {
        const chainlinkId = mapCoinGeckoToChainlink([coin.id])[0];
        const chainlinkPriceData = chainlinkPrices.find(p => p.coin === chainlinkId);

        const chainlinkFresh = chainlinkPriceData && chainlinkPriceData.price !== null && isFreshUnixSeconds(chainlinkPriceData.updatedAt);

        let finalPrice;
        let priceSource = "CoinGecko (Fallback)";
        if (chainlinkFresh) {
          finalPrice = chainlinkPriceData.price;
          priceSource = "Chainlink (Oracle)";
        } else {
          finalPrice = coin.current_price; // fallback
          if (chainlinkPriceData && chainlinkPriceData.price !== null) {
            priceSource = "Chainlink (Stale → CoinGecko Fallback)";
          }
        }

        return {
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          image: coin.image,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          current_price: finalPrice,
          price_source: priceSource,
          dataSource: priceSource.includes('Chainlink (Oracle)') ? 'chainlink' : 'coingecko',
          chainlinkUpdatedAt: chainlinkPriceData?.updatedAt || null,
          chainlinkIsStale: chainlinkPriceData ? !chainlinkFresh : null,
        };
      });

      // Cache the result
      await cacheManager.set(cacheKey, mergedData);
      return mergedData;
    } catch (error) {
      console.error('Error in getMergedPriceData:', error.message);
      
      // If rate limited or any error, return cached data even if expired
      const expiredCache = await cacheManager.get(cacheKey);
      if (expiredCache) {
        console.log('Error occurred, returning expired cache for', coinGeckoIds.length, 'coins');
        return expiredCache;
      }
      
      // If no cache at all, throw error
      if (error.response?.status === 429) {
        throw new Error('CoinGecko API rate limit exceeded and no cached data available. Please try again later.');
      }
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
