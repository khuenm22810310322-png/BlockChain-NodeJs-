const axios = require("axios");

// CoinGecko market_chart for BTC/USD 1 day
const COINGECKO_URL =
	"https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1";

async function getPrice24hAgo() {
	try {
		const res = await axios.get(COINGECKO_URL, {
			timeout: 20000,
			headers: { Accept: "application/json" },
		});
		// data.prices is array [ [timestamp, price], ... ]
		const prices = res.data?.prices;
		if (!Array.isArray(prices) || prices.length === 0) {
			throw new Error("No price data");
		}
		// 0 = earliest in 24h window
		const oldPrice = prices[0][1];
		return Number(oldPrice);
	} catch (err) {
		// bubble to caller
		throw err;
	}
}

module.exports = { getPrice24hAgo };
