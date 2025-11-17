// Server/utils/chainlinkFeeds.js
// Đọc địa chỉ Chainlink Price Feed hoàn toàn từ addresses.json

const addressesFile = require("./addresses.json");

const feedAddressesByPair = {};

// Normalize "BTC / USD" -> "btc-usd"
function normalizePair(pair) {
  if (!pair || typeof pair !== "string") return null;
  const parts = pair.split("/");
  if (parts.length !== 2) return null;
  const base = parts[0].trim().toLowerCase();
  const quote = parts[1].trim().toLowerCase();
  if (quote !== "usd") return null;
  const normBase = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!normBase) return null;
  return `${normBase}-usd`;
}

// Load all Ethereum Mainnet feeds from addresses.json
try {
  const eth = addressesFile?.ethereum?.networks?.find(
    (n) => n?.name && n.name.toLowerCase().includes("mainnet")
  );
  if (eth?.proxies?.length) {
    for (const p of eth.proxies) {
      const pairId = normalizePair(p.pair);
      if (pairId && p.proxy) {
        feedAddressesByPair[pairId] = p.proxy;
      }
    }
  }
} catch (e) {
  // ignore parse errors
}

function getFeedAddressForPair(pairId) {
  return feedAddressesByPair[pairId];
}

function listAvailableFeedPairs() {
  return Object.keys(feedAddressesByPair).filter((k) => !!feedAddressesByPair[k]);
}

module.exports = { getFeedAddressForPair, listAvailableFeedPairs };
