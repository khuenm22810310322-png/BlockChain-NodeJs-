const express = require("express");
const router = express.Router();
const { getCurrentPrice } = require("../services/chainlinkService");
const { getPrice24hAgo } = require("../services/priceHistoryService");

router.get("/change-24h", async (req, res) => {
	try {
		const [current, old] = await Promise.all([getCurrentPrice(), (async () => {
			try {
				return await getPrice24hAgo();
			} catch (e) {
				if (e?.response?.status === 429) {
					throw new Error("COINGECKO_LIMIT");
				}
				throw e;
			}
		})()]);

		if (!old || Number.isNaN(old)) {
			return res.status(500).json({ error: "Invalid old price data" });
		}
		const percentChange24h = ((current - old) / old) * 100;
		return res.json({
			currentPrice: current,
			oldPrice: old,
			percentChange24h: Number(percentChange24h.toFixed(4)),
		});
	} catch (err) {
		if (err.message === "COINGECKO_LIMIT") {
			return res.status(429).json({ error: "CoinGecko API limit exceeded" });
		}
		// If chainlink fails or other errors
		return res.status(500).json({ error: "Chainlink price feed unavailable" });
	}
});

module.exports = router;
