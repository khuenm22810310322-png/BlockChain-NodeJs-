const express = require("express");
const cors = require("cors");
const db = require("./db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("./models/Users");
const { getMergedPriceData } = require("./chainlinkService");
const axios = require("axios");
const PORT = process.env.PORT || 3000;
const app = express();

// We'll attach socket.io later after creating the HTTP server
let io;

// Simple endpoint-level cache for Top 100 to survive rate limits
let top100Cache = { data: [], timestamp: 0 };
const TOP100_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

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
			},
		});
	})(req, res, next);
});

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
			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.json(user.portfolio);
		} catch (err) {
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

		try {
			if (
				!coin ||
				!coinData ||
				typeof coinData.totalInvestment !== "number" ||
				typeof coinData.coins !== "number"
			) {
				return res.status(400).json({ error: "Invalid input data" });
			}

			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			const portfolio = user.portfolio;
			const existingCoinData = portfolio.get(coin);

			if (existingCoinData) {
				const newCoins = existingCoinData.coins + coinData.coins;

				if (coinData.coins < 0) {
					const sellAmount = Math.abs(coinData.coins);
					const ownedCoins = existingCoinData.coins;

					if (sellAmount > ownedCoins) {
						return res.status(400).json({
							error: `Cannot sell ${sellAmount} coins. You only own ${ownedCoins} coins.`,
						});
					}
				}

				if (newCoins <= 0) {
					portfolio.delete(coin);
				} else {
					let newTotalInvestment;

					if (coinData.coins < 0) {
						const remainingRatio =
							newCoins / existingCoinData.coins;
						newTotalInvestment =
							existingCoinData.totalInvestment * remainingRatio;
					} else {
						newTotalInvestment =
							existingCoinData.totalInvestment +
							coinData.totalInvestment;
					}

					existingCoinData.totalInvestment = newTotalInvestment;
					existingCoinData.coins = newCoins;
					portfolio.set(coin, existingCoinData);
				}
			} else {
				if (coinData.totalInvestment > 0 && coinData.coins > 0) {
					portfolio.set(coin, coinData);
				} else if (coinData.coins < 0) {
					return res.status(400).json({
						error: "Cannot sell coins that are not in your portfolio",
					});
				}
			}

			user.markModified("portfolio");

			const updatedUser = await user.save();
			return res.status(200).json(updatedUser.portfolio);
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);
// Market endpoints (Hybrid: Chainlink preferred, CoinGecko fallback)
app.get("/api/market/top100", async (req, res) => {
	try {
		const topCoinsResponse = await axios.get(
			"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false",
			{ 
				timeout: 30000, // 30 seconds
				headers: { 'Accept': 'application/json' }
			}
		);
		const topCoinIds = topCoinsResponse.data.map((coin) => coin.id);

		const priceData = await getMergedPriceData(topCoinIds);
				// Save cache on success
				top100Cache = { data: Array.isArray(priceData) ? priceData : [], timestamp: Date.now() };
				// Emit update to connected websocket clients
				try {
					if (io) io.emit('top100:update', top100Cache.data);
				} catch (e) {
					console.error('Socket emit error:', e?.message || e);
				}
				return res.status(200).json(priceData);
	} catch (error) {
			console.error("Error in /api/market/top100:", error.message);
		// If rate limited or any error, return cached data (even if expired)
		if (top100Cache.data && top100Cache.data.length > 0) {
			console.log("Using cached Top100 due to upstream error/rate limit");
			return res.status(200).json(top100Cache.data);
		}
		// No cache available, return empty array to keep client stable
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
		const priceData = await getMergedPriceData(coinIds);
		return res.status(200).json(priceData);
	} catch (error) {
			console.error("Error in /api/prices:", error.message);
			// Always return an array to keep client stable
			return res.status(200).json([]);
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
