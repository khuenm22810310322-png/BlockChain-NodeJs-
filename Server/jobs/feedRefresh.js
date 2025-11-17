const Bull = require("bull");
const { discoverFeed } = require("../services/feedDiscovery");
const { supported } = require("../utils/idMapper");

const redisUrl = process.env.REDIS_URL;
let refreshQueue = null;

if (redisUrl) {
	refreshQueue = new Bull("feed-refresh", {
		redis: redisUrl,
		settings: {
			maxStalledCount: 0,
		},
		defaultJobOptions: {
			removeOnComplete: true,
			removeOnFail: true,
		},
	});

	refreshQueue.process(async () => {
		const topCoins = supported.slice(0, 50);
		for (const coin of topCoins) {
			await discoverFeed({ coinId: coin.coinGeckoId, symbol: coin.symbol, addresses: coin.addresses || {} });
		}
		return { refreshed: topCoins.length };
	});
} else {
	console.warn("feed-refresh queue disabled: REDIS_URL not set");
}

function scheduleDaily() {
	if (!refreshQueue) return;
	refreshQueue.add({}, { repeat: { cron: "0 0 * * *" } }).catch(() => {});
}

module.exports = { refreshQueue, scheduleDaily };
