require('dotenv').config();
const { ethers } = require('ethers');

const RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.CHAINLINK_RPC_URL;
let provider = undefined;
if (RPC_URL) {
  provider = new ethers.JsonRpcProvider(RPC_URL);
}

// Feed Registry address must be set per-network in .env if you want registry lookup
// e.g. FEED_REGISTRY_ADDRESS=0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf
const REGISTRY_ADDRESS = process.env.FEED_REGISTRY_ADDRESS;

// Minimal ABI: getFeed(address base, address quote) -> address aggregator
const REGISTRY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'base', type: 'address' },
      { internalType: 'address', name: 'quote', type: 'address' },
    ],
    name: 'getFeed',
    outputs: [{ internalType: 'address', name: 'aggregator', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Parse CHAINLINK_TOKEN_ADDRS env like: "btc:0x..;eth:0x..;link:0x.."
function parseTokenAddrEnv() {
  const raw = process.env.CHAINLINK_TOKEN_ADDRS || '';
  const out = {};
  raw.split(/[;,]/).forEach((entry) => {
    const parts = entry.split(':').map(s => s && s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      out[parts[0].toLowerCase()] = parts[1];
    }
  });
  return out;
}

async function resolveFeedBySymbols(baseSymbol, quoteSymbol) {
  try {
    if (!REGISTRY_ADDRESS || !provider) return null;
    const tokenAddrs = parseTokenAddrEnv();
    const baseAddr = tokenAddrs[baseSymbol.toLowerCase()];
    const quoteAddr = tokenAddrs[quoteSymbol.toLowerCase()];
    if (!baseAddr || !quoteAddr) return null;

    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    const aggregator = await registry.getFeed(baseAddr, quoteAddr);
    if (!aggregator || aggregator === ethers.ZeroAddress) return null;
    return aggregator;
  } catch (err) {
    // Non-fatal - return null so callers fallback to env mapping
    console.error('FeedRegistry lookup error:', err?.message || err);
    return null;
  }
}

module.exports = { resolveFeedBySymbols };
