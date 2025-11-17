// Build a metadata cache from CoinGecko for coins we have Chainlink feeds for
// Usage: node scripts/buildCoingeckoMeta.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { listAvailableFeedPairs } = require("../utils/chainlinkFeeds");
const { supported } = require("../utils/idMapper");

const OUTPUT = path.join(__dirname, "../cache/coingecko-meta.json");

function unique(arr) {
	return [...new Set(arr)];
}

async function fetchMeta(ids) {
	const out = {};
	const chunkSize = 50; // stay under URL length limits
	for (let i = 0; i < ids.length; i += chunkSize) {
		const chunk = ids.slice(i, i + chunkSize);
		const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${chunk.join(",")}&order=market_cap_desc&sparkline=false`;
		try {
			const res = await axios.get(url, {
				timeout: 30000,
				headers: { Accept: "application/json" },
			});
			if (Array.isArray(res.data)) {
				res.data.forEach((c) => {
					out[c.id] = {
						id: c.id,
						symbol: c.symbol,
						name: c.name,
						image: c.image,
						market_cap: c.market_cap,
						market_cap_rank: c.market_cap_rank,
						price_change_percentage_24h: c.price_change_percentage_24h,
						current_price: c.current_price,
					};
				});
			}
		} catch (e) {
			console.error("fetch chunk error:", e?.response?.status || e?.message || e);
		}
	}
	return out;
}

async function main() {
	// Candidate IDs: from supported list (preferred) + assetName from feeds
	const idsSupported = supported.map((c) => c.coinGeckoId.toLowerCase());

	const pairs = listAvailableFeedPairs();
	const idsFromFeeds = pairs.map((p) => p.replace("-usd", ""));

	const candidates = unique(idsSupported.concat(idsFromFeeds));
	console.log("Fetching metadata for", candidates.length, "IDs");

	const meta = await fetchMeta(candidates);
	fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
	fs.writeFileSync(OUTPUT, JSON.stringify(meta, null, 2), "utf8");
	console.log("Saved meta to", OUTPUT, "count:", Object.keys(meta).length);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
