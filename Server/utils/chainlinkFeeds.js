// Server/utils/chainlinkFeeds.js
// Map Chainlink pair IDs (e.g., 'btc-usd') to on-chain feed addresses via environment variables.
// This keeps addresses configurable without hardcoding network-specific values.

require("dotenv").config();

const env = process.env;

// Helper to safely read an env var, trimming whitespace
const get = (key) => (env[key] ? env[key].trim() : undefined);

// Common pairs (Ethereum mainnet feeds recommended). Set these in your .env:
// FEED_BTC_USD, FEED_ETH_USD, FEED_LINK_USD, FEED_MATIC_USD, FEED_BNB_USD, FEED_SOL_USD, FEED_AVAX_USD, ...
// Example:
// FEED_BTC_USD=0xF4030086522a5bEEa4988F8ca5B36d... (example only, verify on data.chain.link)

const feedAddressesByPair = {
  "btc-usd": get("FEED_BTC_USD"),
  "eth-usd": get("FEED_ETH_USD"),
  "link-usd": get("FEED_LINK_USD"),
  "matic-usd": get("FEED_MATIC_USD"),
  "bnb-usd": get("FEED_BNB_USD"),
  "sol-usd": get("FEED_SOL_USD"),
  "avax-usd": get("FEED_AVAX_USD"),
  "uni-usd": get("FEED_UNI_USD"),
  "aave-usd": get("FEED_AAVE_USD"),
  "comp-usd": get("FEED_COMP_USD"),
  "mkr-usd": get("FEED_MKR_USD"),
  "snx-usd": get("FEED_SNX_USD"),
  "yfi-usd": get("FEED_YFI_USD"),
  "crv-usd": get("FEED_CRV_USD"),
  "1inch-usd": get("FEED_1INCH_USD"),
  "grt-usd": get("FEED_GRT_USD"),
  "fil-usd": get("FEED_FIL_USD"),
  "ltc-usd": get("FEED_LTC_USD"),
  "bch-usd": get("FEED_BCH_USD"),
  "xlm-usd": get("FEED_XLM_USD"),
  "ada-usd": get("FEED_ADA_USD"),
  "dot-usd": get("FEED_DOT_USD"),
  "atom-usd": get("FEED_ATOM_USD"),
  "algo-usd": get("FEED_ALGO_USD"),
  "vet-usd": get("FEED_VET_USD"),
  "xtz-usd": get("FEED_XTZ_USD"),
  "xmr-usd": get("FEED_XMR_USD"),
  "zec-usd": get("FEED_ZEC_USD"),
  "dash-usd": get("FEED_DASH_USD"),
  "doge-usd": get("FEED_DOGE_USD"),
};

// Auto-register any FEED_*_USD entries from .env so you can add new coins
// without touching code. Example: FEED_ARB_USD=0x...
for (const [key, val] of Object.entries(env)) {
  if (!val) continue;
  if (key.startsWith('FEED_') && key.endsWith('_USD')) {
    const middle = key.slice(5, -4); // remove FEED_ and _USD
    if (!middle) continue;
    // Normalize like FEED_1INCH_USD -> '1inch-usd', FEED_ARB_USD -> 'arb-usd'
    const base = middle.toLowerCase().replace(/__/g, '_').replace(/_/g, '-');
    const pairId = `${base}-usd`;
    feedAddressesByPair[pairId] = get(key);
  }
}

function getFeedAddressForPair(pairId) {
  return feedAddressesByPair[pairId];
}

function listAvailableFeedPairs() {
  return Object.keys(feedAddressesByPair).filter((k) => !!feedAddressesByPair[k]);
}

module.exports = { getFeedAddressForPair, listAvailableFeedPairs };
