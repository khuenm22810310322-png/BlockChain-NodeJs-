// Smart multi-layer cache (memory LRU -> optional Redis -> Mongo fallback)
// - Dynamic TTL by volatility bucket
// - LRU eviction on memory
// - Optional Redis Pub/Sub for multi-instance
// - Mongo backup for recent (<=1h) prices + 7d history retention

require("dotenv").config();
const { createClient } = require("redis");
const PriceCache = require("../models/PriceCache");
const { supported } = require("./idMapper");

// ===== In-memory LRU implementation =====
class LRUCache {
	constructor(maxEntries = 200) {
		this.max = maxEntries;
		this.map = new Map();
	}
	get(key) {
		if (!this.map.has(key)) return undefined;
		const val = this.map.get(key);
		this.map.delete(key);
		this.map.set(key, val);
		return val;
	}
	set(key, value) {
		if (this.map.has(key)) {
			this.map.delete(key);
		} else if (this.map.size >= this.max) {
			// delete oldest
			const oldest = this.map.keys().next().value;
			if (oldest !== undefined) this.map.delete(oldest);
		}
		this.map.set(key, value);
	}
	delete(key) {
		this.map.delete(key);
	}
	keys() {
		return [...this.map.keys()];
	}
	size() {
		return this.map.size;
	}
}

// ===== Helper: volatility buckets =====
const STABLE_OR_BTC = new Set([
	"bitcoin",
	"tether",
	"usd-coin",
	"dai",
	"binance-usd",
	"true-usd",
	"frax",
	"lusd",
	"pax-gold",
]);

const TOP50 = new Set(
	supported
		.slice(0, 50)
		.map((c) => c.coinGeckoId.toLowerCase())
);

function ttlMsForCoin(coinId) {
	const raw = (coinId || "").toLowerCase();
	const base = raw.includes("-") ? raw.split("-")[0] : raw;
	const match = supported.find(
		(c) =>
			c.pairId?.toLowerCase() === raw ||
			c.symbol?.toLowerCase() === base ||
			c.coinGeckoId?.toLowerCase() === raw ||
			c.coinGeckoId?.toLowerCase() === base
	);
	const cgId = (match?.coinGeckoId || base).toLowerCase();

	if (STABLE_OR_BTC.has(cgId) || base === "btc") return 5 * 60 * 1000; // 5m
	if (TOP50.has(cgId)) return 2 * 60 * 1000; // 2m
	return 60 * 1000; // 1m
}

// ===== Redis optional client =====
function buildRedis() {
	const url = process.env.REDIS_URL;
	if (!url) return null;
	try {
		const client = createClient({ url });
		client.on("error", (err) => console.error("Redis error:", err.message));
		client.connect().catch((err) => console.error("Redis connect failed:", err.message));
		return client;
	} catch (e) {
		console.error("Redis init failed:", e.message);
		return null;
	}
}

// ===== Singleton Cache Manager =====
let singleton = null;

class CacheManager {
	constructor() {
		this.memory = new LRUCache(parseInt(process.env.CACHE_MAX_ENTRIES || "300", 10));
		this.redis = buildRedis();
		this.activeCoins = new Set();
		this.stats = {
			memoryHits: 0,
			memoryMisses: 0,
			redisHits: 0,
			redisMisses: 0,
			mongoHits: 0,
			mongoMisses: 0,
			rpcCalls: 0,
			setOps: 0,
			warmed: 0,
		};

		// Cleanup old history every 6h
		setInterval(() => {
			const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			PriceCache.deleteMany({ updatedAt: { $lt: cutoff } }).catch(() => {});
		}, 6 * 60 * 60 * 1000).unref();
	}

	async refreshActive(fetchFn) {
		if (!fetchFn) return;
		const targets = [...this.activeCoins];
		if (targets.length === 0) return;
		await Promise.allSettled(targets.map((id) => fetchFn(id)));
	}

	markActive(coinIds = []) {
		coinIds.forEach((c) => this.activeCoins.add(c.toLowerCase()));
	}

	clearActive() {
		this.activeCoins.clear();
	}

	getMemory(key) {
		const ent = this.memory.get(key);
		if (!ent) {
			this.stats.memoryMisses++;
			return null;
		}
		if (ent.expiresAt < Date.now()) {
			this.memory.delete(key);
			this.stats.memoryMisses++;
			return null;
		}
		this.stats.memoryHits++;
		return ent.value;
	}

	setMemory(key, value, ttlMs) {
		this.memory.set(key, { value, expiresAt: Date.now() + ttlMs });
	}

	async getRedis(key) {
		if (!this.redis) {
			this.stats.redisMisses++;
			return null;
		}
		try {
			const raw = await this.redis.get(key);
			if (!raw) {
				this.stats.redisMisses++;
				return null;
			}
			const parsed = JSON.parse(raw);
			if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
				this.stats.redisMisses++;
				return null;
			}
			this.stats.redisHits++;
			return parsed.value;
		} catch (e) {
			this.stats.redisMisses++;
			return null;
		}
	}

	async setRedis(key, value, ttlSec = 600) {
		if (!this.redis) return;
		try {
			const payload = JSON.stringify({ value, expiresAt: Date.now() + ttlSec * 1000 });
			await this.redis.setEx(key, ttlSec, payload);
		} catch (e) {
			// ignore
		}
	}

	async getMongo(coinId) {
		try {
			const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h freshness
			const doc = await PriceCache.findOne({ coinId }).sort({ updatedAt: -1 }).lean();
			if (!doc || doc.updatedAt < cutoff) {
				this.stats.mongoMisses++;
				return null;
			}
			this.stats.mongoHits++;
			return { price: doc.price, updatedAt: Math.floor(doc.updatedAt.getTime() / 1000), source: doc.source || "chainlink" };
		} catch (e) {
			this.stats.mongoMisses++;
			return null;
		}
	}

	async setMongo(coinId, value) {
		try {
			await PriceCache.create({
				coinId,
				price: value.price,
				source: value.source || "chainlink",
				updatedAt: value.updatedAt ? new Date(value.updatedAt * 1000) : new Date(),
			});
		} catch (e) {
			// ignore
		}
	}

	async get(coinId) {
		if (!coinId) return null;
		const key = coinId.toLowerCase();

		// Layer 1: memory
		const m = this.getMemory(key);
		if (m) return m;

		// Layer 2: redis
		const r = await this.getRedis(key);
		if (r) {
			this.setMemory(key, r, ttlMsForCoin(key));
			return r;
		}

		// Layer 3: mongo recent
		const dbVal = await this.getMongo(key);
		if (dbVal) {
			this.setMemory(key, dbVal, ttlMsForCoin(key));
			await this.setRedis(key, dbVal); // rehydrate redis
			return dbVal;
		}

		return null;
	}

	async set(coinId, value) {
		if (!coinId || !value) return;
		const key = coinId.toLowerCase();
		const ttlMs = ttlMsForCoin(key);
		this.setMemory(key, value, ttlMs);
		await this.setRedis(key, value, 600); // 10m redis TTL
		await this.setMongo(key, value);
		this.stats.setOps++;
	}

	async clear(coinId) {
		const key = coinId.toLowerCase();
		this.memory.delete(key);
		if (this.redis) {
			try {
				await this.redis.del(key);
			} catch (_) {}
		}
	}

	getStats() {
		const totalHits = this.stats.memoryHits + this.stats.redisHits + this.stats.mongoHits;
		const totalMisses = this.stats.memoryMisses + this.stats.redisMisses + this.stats.mongoMisses;
		return {
			...this.stats,
			memorySize: this.memory.size(),
			activeCoins: [...this.activeCoins],
			totalHits,
			totalMisses,
			hitRatio: totalHits + totalMisses > 0 ? Number((totalHits / (totalHits + totalMisses)).toFixed(3)) : 0,
		};
	}
}

function getCacheManager() {
	if (!singleton) {
		singleton = new CacheManager();
	}
	return singleton;
}

module.exports = { getCacheManager, ttlMsForCoin };
