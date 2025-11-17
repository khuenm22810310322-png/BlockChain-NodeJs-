const express = require("express");
const cors = require("cors");
const db = require("./db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("./models/Users");
const marketplaceRouter = require("./routes/marketplace");
const {
	getMergedPriceData,
	warmTopFeeds,
	getOrFetchChainlink,
	getChainlinkPrices,
} = require("./chainlinkService");
const { listAvailableFeedPairs } = require("./utils/chainlinkFeeds");
const { normalizeToCoinGeckoId, mapping, reverseMapping, isAllowedCoinId } = require("./utils/idMapper");
const PriceSnapshot = require("./models/PriceSnapshot");
let metaCache = {};
try {
	metaCache = require("./cache/coingecko-meta.json");
} catch (_) {
	metaCache = {};
}
const { getCacheManager } = require("./utils/cacheManager");
const PriceDiscrepancy = require("./models/PriceDiscrepancy");
const TokenAddress = require("./models/TokenAddress");
const DiscoveredFeed = require("./models/DiscoveredFeed");
const { discoverFeed, upsertTokenAddresses } = require("./services/feedDiscovery");
const axios = require("axios");
const PORT = process.env.PORT || 3000;
const app = express();

// We'll attach socket.io later after creating the HTTP server
let io;
const cacheManager = getCacheManager();

// Helpers to keep portfolio keys consistent (always CoinGecko ids)
function toPortfolioMap(rawPortfolio) {
	if (!rawPortfolio) return new Map();
	if (rawPortfolio instanceof Map) return new Map(rawPortfolio);
	if (typeof rawPortfolio === "object") return new Map(Object.entries(rawPortfolio));
	return new Map();
}

function sanitizeHolding(data = {}) {
	const totalInvestment = Number(data.totalInvestment);
	const coins = Number(data.coins);
	return {
		totalInvestment: Number.isFinite(totalInvestment) ? totalInvestment : 0,
		coins: Number.isFinite(coins) ? coins : 0,
	};
}

// Simple endpoint-level cache for Top 100 to survive rate limits
let top100Cache = { data: [], timestamp: 0 };
const TOP100_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let inFlightTop100 = null;
const SNAPSHOT_INTERVAL_MS = parseInt(process.env.PRICE_SNAPSHOT_INTERVAL_MS || "300000", 10); // default 5m

// CORS: allow production client and local dev (Vite)
const allowedOrigins = [
	process.env.CLIENT || "https://cryptotrack-ultimez.vercel.app",
	"http://localhost:5173",
];
app.use(
	cors({
		origin: function (origin, callback) {
			// allow requests with no origin (like curl, Postman)
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	})
);

app.use(express.json());
const passport = require("./auth");
app.use(passport.initialize());
app.use("/api/marketplace", marketplaceRouter);

app.get("/", (req, res) => {
	return res.send("API is running");
});

// Test endpoint
app.get("/test", (req, res) => {
	return res.json({ message: "Test endpoint working", timestamp: new Date() });
});

app.post("/register", async (req, res) => {
	const { username, password } = req.body;
	try {
		const user = await User.findOne({ username });
		if (user) {
			return res.status(400).json({ Error: "User Already Exists" });
		}

		const newUser = new User({ username, password });
		await newUser.save();
		return res.status(200).json({ message: "User Registered Successfully" });
	} catch (err) {
		return res.status(500).json(err);
	}
});

app.post("/login", (req, res, next) => {
	passport.authenticate("local", { session: false }, (err, user, info) => {
		if (err) {
			return res.status(500).json({ error: "Authentication error" });
		}
		if (!user) {
			return res.status(400).json({ error: "Invalid credentials" });
		}

		const payload = { id: user._id, username: user.username };
		const token = jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: "24h",
		});

		res.status(200).json({
			message: "Login successful",
			token: token,
			user: {
				id: user._id,
				username: user.username,
				walletAddress: user.walletAddress || null,
			},
		});
	})(req, res, next);
});

// Update user wallet address
app.put(
	"/user/wallet",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		try {
			const { walletAddress } = req.body;
			if (!walletAddress) {
				return res.status(400).json({ error: "Wallet address is required" });
			}

			const user = await User.findById(req.user._id);
			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			user.walletAddress = walletAddress.toLowerCase();
			await user.save();

			res.status(200).json({
				message: "Wallet address updated successfully",
				walletAddress: user.walletAddress,
			});
		} catch (err) {
			console.error("Error updating wallet address:", err);
			res.status(500).json({ error: "Failed to update wallet address" });
		}
	}
);

app.get(
	"/watchlist",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		try {
			const userId = req.user._id;
			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.json({ watchlist: user.watchlist });
		} catch (err) {
			return res.status(500).json(err);
		}
	}
);

app.get(
	"/portfolio",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
	try {
		const userId = req.user._id;
		console.log("📥 GET Portfolio Request - User ID:", userId);
		const user = await User.findById(userId);
		if (!user) {
			console.log("❌ User not found");
			return res.status(404).json({ Error: "User not Found" });
		}

		const portfolioMap = toPortfolioMap(user.portfolio);
		const normalized = new Map();
		let changed = false;

		for (const [rawId, rawData] of portfolioMap.entries()) {
			const coinId = normalizeToCoinGeckoId(rawId);
			if (!isAllowedCoinId(coinId)) {
				changed = true;
				continue; // drop unsupported FX/unknown entries
			}
			const incoming = sanitizeHolding(rawData);
			const existing = sanitizeHolding(normalized.get(coinId));

			normalized.set(coinId, {
				totalInvestment: existing.totalInvestment + incoming.totalInvestment,
				coins: existing.coins + incoming.coins,
			});

			if (coinId !== rawId || incoming.totalInvestment !== rawData?.totalInvestment || incoming.coins !== rawData?.coins) {
				changed = true;
			}
		}

		if (changed) {
			user.portfolio = normalized;
			await user.save();
		}

		const portfolioObj = Object.fromEntries(normalized);
		console.log("✅ Portfolio retrieved:", portfolioObj);
		return res.json(portfolioObj);
	} catch (err) {
		console.error("❌ Error getting portfolio:", err);
		return res.status(500).json(err);
	}
}
);

app.put(
	"/watchlist/add",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		const userId = req.user._id;
		const coin = req.body.coin;
		try {
			const user = await User.findByIdAndUpdate(
				userId,
				{ $addToSet: { watchlist: coin } },
				{ new: true }
			);

			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.status(200).json({ watchlist: user.watchlist });
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);

app.put(
	"/watchlist/remove",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		const userId = req.user._id;
		const coin = req.body.coin;
		try {
			const user = await User.findByIdAndUpdate(
				userId,
				{ $pull: { watchlist: coin } },
				{ new: true }
			);

			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.status(200).json({ watchlist: user.watchlist });
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);

app.put(
	"/portfolio/update",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		const userId = req.user._id;
		const { coin, coinData } = req.body;

		console.log("📊 Portfolio Update Request:");
		console.log("  User ID:", userId);
		console.log("  Coin:", coin);
		console.log("  Coin Data:", coinData);

		try {
			if (
				!coin ||
				!coinData ||
				!Number.isFinite(Number(coinData.totalInvestment)) ||
				!Number.isFinite(Number(coinData.coins))
			) {
				console.log("❌ Invalid input data");
				return res.status(400).json({ error: "Invalid input data" });
			}

			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			const portfolio = toPortfolioMap(user.portfolio);
			const normalizedCoin = normalizeToCoinGeckoId(coin);
			if (!isAllowedCoinId(normalizedCoin)) {
				return res.status(400).json({ error: `Unsupported coin id: ${coin}` });
			}
			const incoming = sanitizeHolding(coinData);

			const hasExisting = portfolio.has(normalizedCoin) || portfolio.has(coin);
			const existingCoinData = hasExisting
				? sanitizeHolding(portfolio.get(normalizedCoin) || portfolio.get(coin))
				: null;

			if (existingCoinData) {
				const newCoins = existingCoinData.coins + incoming.coins;

				if (incoming.coins < 0) {
					const sellAmount = Math.abs(incoming.coins);
					const ownedCoins = existingCoinData.coins;

					if (sellAmount > ownedCoins) {
						return res.status(400).json({
							error: `Cannot sell ${sellAmount} coins. You only own ${ownedCoins} coins.`,
						});
					}
				}

				if (newCoins <= 0) {
					portfolio.delete(normalizedCoin);
				} else {
					const newTotalInvestment =
						incoming.coins < 0
							? existingCoinData.totalInvestment * (newCoins / existingCoinData.coins)
							: existingCoinData.totalInvestment + incoming.totalInvestment;

					portfolio.set(normalizedCoin, {
						totalInvestment: newTotalInvestment,
						coins: newCoins,
					});
				}
			} else {
				if (incoming.coins > 0) {
					portfolio.set(normalizedCoin, incoming);
				} else if (incoming.coins < 0) {
					return res.status(400).json({
						error: "Cannot sell coins that are not in your portfolio",
					});
				}
			}

			user.portfolio = portfolio;
			user.markModified("portfolio");

			const updatedUser = await user.save();
			console.log("✅ Portfolio saved successfully");
			
			// Convert Map to plain object for JSON response
			const portfolioObj = updatedUser.portfolio instanceof Map 
				? Object.fromEntries(updatedUser.portfolio) 
				: updatedUser.portfolio;
			console.log("  Updated Portfolio:", portfolioObj);
			return res.status(200).json(portfolioObj);
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);
// Market endpoints (Hybrid: Chainlink preferred, CoinGecko fallback)
app.get("/api/market/top100", async (req, res) => {
	// serve cached if fresh to avoid rate limits
	if (top100Cache.data.length && Date.now() - top100Cache.timestamp < TOP100_CACHE_TTL) {
		return res.status(200).json(top100Cache.data);
	}

	// dedupe concurrent fetches
	if (inFlightTop100) {
		try {
			const data = await inFlightTop100;
			return res.status(200).json(data);
		} catch (e) {
			if (top100Cache.data.length) return res.status(200).json(top100Cache.data);
			return res.status(200).json([]);
		}
	}

	const fetchPromise = (async () => {
		try {
			// Use available feed pairs (Chainlink only), no CoinGecko metadata
			const pairs = listAvailableFeedPairs();
			const priceData = await getChainlinkPrices(pairs);
			const normalized = priceData
				.filter((p) => p.price !== null)
				.map((p) => {
					const base = p.coin.replace("-usd", "");
					const cgId = normalizeToCoinGeckoId(base);
					// Skip if we cannot map to a CoinGecko id (filters out FX pairs like AUD/USD)
					if (!cgId) return null;
					// If mapping couldn't resolve to a known CoinGecko id, drop it to avoid bad portfolio entries
					const isMapped =
						mapping[cgId] ||
						reverseMapping[cgId] ||
						reverseMapping[base] ||
						mapping[base];
					if (!isMapped) return null;

					return {
						id: cgId,
						symbol: (cgId || base).toUpperCase(),
						name: (cgId || base).toUpperCase(),
						image: null,
						market_cap: null,
						market_cap_rank: null,
						price_change_percentage_24h: null,
						current_price: p.price,
						price_source: "Chainlink (Oracle)",
						dataSource: "chainlink",
						chainlinkUpdatedAt: p.updatedAt || null,
						chainlinkIsStale: false,
					};
				});
			top100Cache = { data: normalized, timestamp: Date.now() };
			try {
				if (io) io.emit('top100:update', top100Cache.data);
			} catch (e) {
				console.error('Socket emit error:', e?.message || e);
			}
			return top100Cache.data;
		} finally {
			inFlightTop100 = null;
		}
	})();

	inFlightTop100 = fetchPromise;

	try {
		const data = await fetchPromise;
		return res.status(200).json(data);
	} catch (error) {
		console.error("Error in /api/market/top100:", error.message);
		if (top100Cache.data && top100Cache.data.length > 0) {
			console.log("Using cached Top100 due to upstream error/rate limit");
			return res.status(200).json(top100Cache.data);
		}
		return res.status(200).json([]);
	}
});

// Watchlist/Portfolio price fetch by CoinGecko IDs
app.post("/api/prices", async (req, res) => {
	try {
		const { coinIds } = req.body;
		if (!coinIds || !Array.isArray(coinIds) || coinIds.length === 0) {
			return res
				.status(400)
				.json({ error: "Yêu cầu phải có một mảng 'coinIds'." });
		}
		const normalizedIds = [...new Set(
			coinIds
				.map((id) => normalizeToCoinGeckoId(id))
				.filter((id) => id && isAllowedCoinId(id))
		)];
		if (normalizedIds.length === 0) {
			return res
				.status(400)
				.json({ error: "Danh sách coinIds không hợp lệ." });
		}

		const priceData = await getMergedPriceData(normalizedIds);

		// Ensure every requested id has an entry so the client can render all portfolio rows
		const foundIds = new Set(priceData.map((c) => c.id?.toLowerCase()).filter(Boolean));
		const missing = normalizedIds.filter((id) => !foundIds.has(id.toLowerCase()));
		const placeholderCoins = missing.map((id) => ({
			id,
			symbol: (id || "").toUpperCase(),
			name: (id || "").toUpperCase(),
			current_price: 0,
			market_cap: null,
			market_cap_rank: null,
			price_change_percentage_24h: null,
			price_source: "Unavailable",
			dataSource: "unknown",
			chainlinkUpdatedAt: null,
			chainlinkIsStale: true,
		}));

		return res.status(200).json([...priceData, ...placeholderCoins]);
	} catch (error) {
			console.error("Error in /api/prices:", error.message);
			// Always return an array to keep client stable
			return res.status(200).json([]);
	}
});

// Comparison helpers
async function fetchComparison(ids) {
	const idsString = ids.join(",");
	const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsString}&order=market_cap_desc&sparkline=false`;
	const { mapCoinGeckoToChainlink } = require("./utils/idMapper");
	const chainlinkIds = mapCoinGeckoToChainlink(ids);
	const [cgRes, clPrices] = await Promise.all([
		axios.get(coingeckoUrl, {
			timeout: 20000,
			headers: { Accept: "application/json" },
		}),
		require("./chainlinkService").getChainlinkPrices(chainlinkIds),
	]);

	const clById = Object.fromEntries(clPrices.map((p) => [p.coin, p]));

	const comparisons = cgRes.data.map((coin) => {
		const chainlinkId = mapCoinGeckoToChainlink([coin.id])[0];
		const cl = chainlinkId ? clById[chainlinkId] : null;
		const chainlinkPrice = cl?.price ?? null;
		const coingeckoPrice = coin.current_price ?? null;
		let diffPct = null;
		if (chainlinkPrice && coingeckoPrice) {
			diffPct = ((chainlinkPrice - coingeckoPrice) / coingeckoPrice) * 100;
		}
		const flagged = diffPct !== null && Math.abs(diffPct) > 1;
		return {
			id: coin.id,
			symbol: coin.symbol,
			name: coin.name,
			image: coin.image,
			chainlinkPrice,
			coingeckoPrice,
			diffPct,
			flagged,
			chainlinkUpdatedAt: cl?.updatedAt || null,
			coingeckoUpdatedAt: coin.last_updated ? new Date(coin.last_updated).getTime() / 1000 : null,
		};
	});

	// Log discrepancies > 2%
	const toLog = comparisons.filter((c) => c.diffPct !== null && Math.abs(c.diffPct) > 2);
	if (toLog.length) {
		await PriceDiscrepancy.insertMany(
			toLog.map((c) => ({
				coinId: c.id,
				chainlinkPrice: c.chainlinkPrice,
				coingeckoPrice: c.coingeckoPrice,
				diffPct: c.diffPct,
				flagged: true,
			})),
			{ ordered: false }
		).catch(() => {});
	}

	return comparisons;
}

// Comparison price endpoint
app.get("/api/compare/prices", async (req, res) => {
	try {
		const idsParam = req.query.ids;
		if (!idsParam) return res.status(400).json({ error: "ids query required, comma separated" });
		const ids = idsParam
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean);
		const data = await fetchComparison(ids);
		return res.json({ data });
	} catch (e) {
		console.error("compare/prices error:", e?.message || e);
		return res.status(500).json({ error: "Failed to compare prices" });
	}
});

// Stats endpoint
app.get("/api/compare/stats", async (req, res) => {
	try {
		const idsParam = req.query.ids;
		const ids = idsParam ? idsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
		const baseIds =
			ids.length > 0
				? ids
				: require("./utils/idMapper").supported.slice(0, 50).map((c) => c.coinGeckoId);

		const data = await fetchComparison(baseIds);
		const diffs = data.filter((d) => d.diffPct !== null).map((d) => d.diffPct);
		const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
		const sorted = [...data].filter((d) => d.diffPct !== null).sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct));
		const coverage = data.filter((d) => d.chainlinkPrice !== null).length / data.length;

		return res.json({
			averageDiffPct: Number(avgDiff.toFixed(3)),
			largestDifferences: sorted.slice(0, 5),
			chainlinkCoveragePct: Number((coverage * 100).toFixed(1)),
			sampleSize: data.length,
		});
	} catch (e) {
		console.error("compare/stats error:", e?.message || e);
		return res.status(500).json({ error: "Failed to compute stats" });
	}
});

// ===== Admin Feed management =====
app.get("/admin/feeds", async (req, res) => {
	try {
		const feeds = await DiscoveredFeed.find({}).lean();
		return res.json({ data: feeds });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

app.post("/admin/feeds", async (req, res) => {
	try {
		const { coinId, symbol, chain, feedAddress, source } = req.body;
		if (!coinId || !chain || !feedAddress) return res.status(400).json({ error: "coinId, chain, feedAddress required" });
		const doc = await DiscoveredFeed.findOneAndUpdate(
			{ coinId, chain },
			{ coinId, symbol, chain, feedAddress, source: source || "manual", active: true, lastChecked: new Date() },
			{ upsert: true, new: true }
		);
		return res.json(doc);
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

app.delete("/admin/feeds/:id", async (req, res) => {
	try {
		const { id } = req.params;
		await DiscoveredFeed.deleteOne({ _id: id });
		return res.json({ deleted: id });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

app.post("/admin/feeds/test", async (req, res) => {
	try {
		const { coinId, symbol, addresses } = req.body;
		const address = await discoverFeed({ coinId, symbol, addresses: addresses || {} });
		return res.json({ address });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

// Cache monitoring endpoints
app.get("/api/cache/stats", (req, res) => {
	return res.json(cacheManager.getStats());
});

app.post("/api/cache/clear/:coinId", async (req, res) => {
	try {
		const { coinId } = req.params;
		if (!coinId) return res.status(400).json({ error: "coinId required" });
		await cacheManager.clear(coinId);
		return res.json({ cleared: coinId });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

app.get("/api/cache/dashboard", (req, res) => {
	const stats = cacheManager.getStats();
	const memoryKeys = cacheManager.memory ? cacheManager.memory.keys() : [];
	return res.json({
		...stats,
		memoryKeys,
	});
});

// Chart data from snapshots (default last 24h)
app.get("/api/price/chart/:coin", async (req, res) => {
	try {
		const coinParam = req.params.coin.toLowerCase();
		const hours = parseInt(req.query.hours || "24", 10);
		const since = new Date(Date.now() - hours * 60 * 60 * 1000);

		// Allow passing pairId directly (btc-usd) or coinId
		let coinId = coinParam;
		if (coinParam.indexOf("-") !== -1 && coinParam.endsWith("-usd")) {
			coinId = coinParam.replace("-usd", "");
		}

		const snapshots = await PriceSnapshot.find({
			coinId,
			ts: { $gte: since },
		})
			.sort({ ts: 1 })
			.select({ _id: 0, price: 1, ts: 1 })
			.lean();

		return res.json({ coinId, hours, points: snapshots });
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

// 24h price change using snapshots (use oldest snapshot within last 24h, fallback to latest if none)
app.get("/api/price/24h/:coinId", async (req, res) => {
	try {
		const coinId = req.params.coinId.toLowerCase();
		const now = Date.now();
		const cutoff = new Date(now - 24 * 60 * 60 * 1000);

		const latest = await PriceSnapshot.findOne({ coinId }).sort({ ts: -1 }).lean();
		if (!latest) {
			return res.status(404).json({ error: "No snapshot data" });
		}
		// Oldest snapshot within 24h; if none (e.g., brand new coin), fall back to latest
		const old =
			(await PriceSnapshot.findOne({ coinId, ts: { $gte: cutoff } }).sort({ ts: 1 }).lean()) || latest;
		const percent =
			!old.price
				? 0
				: ((latest.price - old.price) / old.price) * 100;
		return res.json({
			currentPrice: latest.price,
			oldPrice: old.price,
			percentChange24h: Number(percent.toFixed(4)),
			updatedAt: latest.ts,
			oldAt: old.ts,
			source: "chainlink",
		});
	} catch (e) {
		return res.status(500).json({ error: e.message });
	}
});

// Create HTTP server and attach socket.io
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

io = new Server(server, {
	cors: {
		origin: allowedOrigins,
		methods: ['GET', 'POST']
	}
});

io.on('connection', (socket) => {
	console.log('Socket connected:', socket.id);
	// Optionally emit current cached top100 on connect
	if (top100Cache && top100Cache.data && top100Cache.data.length > 0) {
		socket.emit('top100:update', top100Cache.data);
	}
});

server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	console.log(`API endpoint: http://localhost:${PORT}/api/market/top100`);
});

// Cache warming: pre-load top 20 Chainlink feeds on startup
warmTopFeeds(20).catch((e) => console.error("Warmup error:", e?.message || e));

// Smart refresh: periodically refresh only active coins (those recently requested)
setInterval(() => {
	cacheManager
		.refreshActive(getOrFetchChainlink)
		.catch((e) => console.error("Refresh active error:", e?.message || e));
}, 60 * 1000).unref();

// Snapshot job: store Chainlink prices periodically for 24h calculations
async function snapshotChainlinkPrices() {
	try {
		const pairs = listAvailableFeedPairs().slice(0, 200);
		const prices = await getChainlinkPrices(pairs);
		const docs = prices
			.filter((p) => p.price !== null)
			.map((p) => ({
				coinId: p.coin.replace("-usd", ""),
				price: p.price,
				source: "chainlink",
				ts: new Date(),
			}));
		if (docs.length > 0) {
			await PriceSnapshot.insertMany(docs, { ordered: false });
		}
	} catch (e) {
		console.error("Snapshot error:", e?.message || e);
	}
}

if (SNAPSHOT_INTERVAL_MS > 0) {
	setInterval(snapshotChainlinkPrices, SNAPSHOT_INTERVAL_MS).unref();
}

// Start daily feed discovery refresh if Redis is available for the queue
try {
	const { scheduleDaily } = require("./jobs/feedRefresh");
	scheduleDaily();
} catch (e) {
	console.error("Feed refresh scheduler error:", e?.message || e);
}
