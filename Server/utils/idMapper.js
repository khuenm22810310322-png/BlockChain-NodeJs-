// Server/utils/idMapper.js
require('dotenv').config();

// Base mapping for common coins
let mapping = {
  'bitcoin': 'btc-usd',
  'ethereum': 'eth-usd',
  'chainlink': 'link-usd',
  'matic-network': 'matic-usd',
  'binancecoin': 'bnb-usd',
  'solana': 'sol-usd',
  'avalanche-2': 'avax-usd',
  'uniswap': 'uni-usd',
  'aave': 'aave-usd',
  'compound-governance-token': 'comp-usd',
  'maker': 'mkr-usd',
  'synthetix-network-token': 'snx-usd',
  'yearn-finance': 'yfi-usd',
  'curve-dao-token': 'crv-usd',
  '1inch': '1inch-usd',
  'the-graph': 'grt-usd',
  'filecoin': 'fil-usd',
  'litecoin': 'ltc-usd',
  'bitcoin-cash': 'bch-usd',
  'stellar': 'xlm-usd',
  'cardano': 'ada-usd',
  'polkadot': 'dot-usd',
  'cosmos': 'atom-usd',
  'algorand': 'algo-usd',
  'vechain': 'vet-usd',
  'tezos': 'xtz-usd',
  'monero': 'xmr-usd',
  'zcash': 'zec-usd',
  'dash': 'dash-usd',
  'dogecoin': 'doge-usd'
};

// Allow adding more mappings via .env, e.g.
// CHAINLINK_ID_MAP="arbitrum:arb-usd;optimism:op-usd;sui:sui-usd"
function parseExtraMappings(str) {
  const out = {};
  if (!str) return out;
  const entries = str.split(/[;,]/); // support ; or , as separators
  for (const entry of entries) {
    const [cg, pair] = entry.split(":").map(s => s && s.trim().toLowerCase());
    if (cg && pair) out[cg] = pair;
  }
  return out;
}

const extra = parseExtraMappings(process.env.CHAINLINK_ID_MAP);
mapping = { ...mapping, ...extra };

function mapCoinGeckoToChainlink(coinGeckoIds) {
  return coinGeckoIds.map(id => mapping[id]).filter(Boolean);
}

module.exports = { mapCoinGeckoToChainlink };
