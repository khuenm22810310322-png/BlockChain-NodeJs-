// Server/utils/idMapper.js
// Auto-maps CoinGecko IDs to Chainlink pair IDs using supported-coins.json plus optional env overrides.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const addressesFile = require('./addresses.json');

function loadSupportedCoins() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../supported-coins.json'), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// Allow extra mappings via env, e.g. CHAINLINK_ID_MAP="arbitrum:arb-usd;sui:sui-usd"
function parseExtraMappings(str) {
  const out = {};
  if (!str) return out;
  const entries = str.split(/[;,]/);
  for (const entry of entries) {
    const [cg, pair] = entry.split(':').map((s) => s && s.trim().toLowerCase());
    if (cg && pair) out[cg] = pair;
  }
  return out;
}

const supported = loadSupportedCoins();
const supportedIds = supported.map((c) => c.coinGeckoId.toLowerCase());
const mappingFromFile = Object.fromEntries(
  supported.map((c) => [
    c.coinGeckoId.toLowerCase(),
    (c.pairId || `${c.symbol}-usd`).toLowerCase(),
  ])
);

// Auto-build mapping from addresses.json (assetName -> pairId)
function normalizePair(pair) {
  if (!pair || typeof pair !== 'string') return null;
  const parts = pair.split('/');
  if (parts.length !== 2) return null;
  const base = parts[0].trim().toLowerCase();
  const quote = parts[1].trim().toLowerCase();
  if (quote !== 'usd') return null;
  const normBase = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normBase) return null;
  return `${normBase}-usd`;
}

function buildMappingFromAddresses() {
  const out = {};
  try {
    const eth = addressesFile?.ethereum?.networks?.find(
      (n) => n?.name && n.name.toLowerCase().includes('mainnet')
    );
    if (eth?.proxies?.length) {
      for (const p of eth.proxies) {
        const pairId = normalizePair(p.pair);
        if (!pairId) continue;
        const asset = (p.assetName || '').trim().toLowerCase();
        const slug = asset.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (slug) out[slug] = pairId;
      }
    }
  } catch (_) {}
  return out;
}

const mappingFromAddresses = buildMappingFromAddresses();

const extra = parseExtraMappings(process.env.CHAINLINK_ID_MAP);
const mapping = { ...mappingFromAddresses, ...mappingFromFile, ...extra };
const allowedCoinIds = new Set(Object.keys(mapping));

// Build reverse map: chainlink base/pair -> CoinGecko id
const reverseMapping = Object.entries(mapping).reduce((acc, [cgId, pairId]) => {
  if (!pairId) return acc;
  const pair = pairId.toLowerCase();
  const base = pair.replace('-usd', '');
  acc[pair] = cgId;
  acc[base] = cgId;
  return acc;
}, {});

function mapCoinGeckoToChainlink(coinGeckoIds) {
  if (!coinGeckoIds) return [];
  return coinGeckoIds
    .map((id) => mapping[id.toLowerCase()])
    .filter(Boolean);
}

// Normalize any incoming coin id (Chainlink base/pair or CoinGecko id) to CoinGecko id
function normalizeToCoinGeckoId(coinId) {
  if (!coinId) return coinId;
  const lower = coinId.toString().trim().toLowerCase();
  const slug = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const candidates = [
    lower,
    slug,
    lower.endsWith('-usd') ? lower : `${slug}-usd`,
  ].filter(Boolean);

  for (const cand of candidates) {
    if (mapping[cand]) return cand; // Already a CoinGecko id
    if (reverseMapping[cand]) return reverseMapping[cand]; // Chainlink base/pair -> CoinGecko id
  }

  // Final attempt: strip -usd and retry
  for (const cand of candidates) {
    const base = cand.endsWith('-usd') ? cand.replace('-usd', '') : cand;
    if (reverseMapping[base]) return reverseMapping[base];
    if (mapping[base]) return base;
  }

  return slug || lower;
}

function isAllowedCoinId(id) {
  if (!id) return false;
  const lower = id.toString().trim().toLowerCase();
  const base = lower.endsWith('-usd') ? lower.replace('-usd', '') : lower;
  return allowedCoinIds.has(lower) || allowedCoinIds.has(base);
}

module.exports = { mapCoinGeckoToChainlink, mapping, reverseMapping, normalizeToCoinGeckoId, supported, isAllowedCoinId };
