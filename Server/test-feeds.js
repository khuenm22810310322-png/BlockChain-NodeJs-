/**
 * Validate all configured Chainlink USD feeds:
 * - Resolves addresses from env FEED_*_USD (via chainlinkFeeds util)
 * - Falls back to Feed Registry (if FEED_REGISTRY_ADDRESS + token addresses are set)
 * - Checks latestRoundData, decimals, positive answer
 * - Enforces freshness: updatedAt <= CHAINLINK_MAX_AGE_SECONDS (default 86400)
 *
 * Run: node test-feeds.js
 */
require('dotenv').config();
const { ethers } = require('ethers');
const { mapCoinGeckoToChainlink, supported } = require('./utils/idMapper');
const { getFeedAddressForPair } = require('./utils/chainlinkFeeds');
const { resolveFeedBySymbols } = require('./utils/feedRegistry');

const RPC_URL = process.env.ALCHEMY_RPC_URL || process.env.CHAINLINK_RPC_URL;
if (!RPC_URL) {
  console.error('Missing ALCHEMY_RPC_URL or CHAINLINK_RPC_URL');
  process.exit(1);
}
const provider = new ethers.JsonRpcProvider(RPC_URL);
const maxAgeSec = parseInt(process.env.CHAINLINK_MAX_AGE_SECONDS || '86400', 10);

const ABI = [
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { type: 'uint80' }, { type: 'int256' }, { type: 'uint256' },
      { type: 'uint256' }, { type: 'uint80' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

async function resolveAddress(pairId) {
  const envAddr = getFeedAddressForPair(pairId);
  if (envAddr) return envAddr;
  const [base, quote] = pairId.split('-');
  const addr = await resolveFeedBySymbols(base, quote);
  return addr && addr !== ethers.ZeroAddress ? addr : null;
}

async function checkFeed(pairId) {
  const addr = await resolveAddress(pairId);
  if (!addr) return { pairId, ok: false, reason: 'no-address' };

  try {
    const agg = new ethers.Contract(addr, ABI, provider);
    const [, answer, , updatedAt] = await agg.latestRoundData();
    const decimals = await agg.decimals();
    const price = Number(answer) / Math.pow(10, Number(decimals));
    const ageSec = Math.floor(Date.now() / 1000) - Number(updatedAt);
    const fresh = ageSec >= 0 && ageSec <= maxAgeSec;
    const valid = isFinite(price) && price > 0;

    return { pairId, ok: fresh && valid, addr, price, ageSec, fresh, valid };
  } catch (e) {
    return { pairId, ok: false, addr, reason: e.message };
  }
}

(async () => {
  const pairIds = Array.from(new Set(mapCoinGeckoToChainlink(supported.map((c) => c.coinGeckoId))));
  const results = await Promise.all(pairIds.map(checkFeed));

  const ok = results.filter((r) => r.ok);
  const stale = results.filter((r) => !r.ok && r.fresh === false);
  const invalid = results.filter((r) => !r.ok && r.reason && r.reason !== 'no-address');
  const missing = results.filter((r) => r.reason === 'no-address');

  console.log(`Checked ${results.length} feeds`);
  console.log(`  OK:            ${ok.length}`);
  console.log(`  Stale:         ${stale.length}`);
  console.log(`  Invalid/error: ${invalid.length}`);
  console.log(`  Missing addr:  ${missing.length}`);

  if (missing.length) {
    console.log('\nMissing addresses (add to .env as FEED_SYMBOL_USD=0x...):');
    missing.forEach((m) => console.log(`  ${m.pairId.toUpperCase().replace('-', '_')}`));
  }

  if (invalid.length || stale.length) {
    console.log('\nFailures/stale details:');
    [...invalid, ...stale].forEach((r) => {
      console.log(`  ${r.pairId}: addr=${r.addr || 'n/a'} reason=${r.reason || 'stale/invalid'} age=${r.ageSec || 'n/a'}s`);
    });
    process.exitCode = 1;
  }
})();
