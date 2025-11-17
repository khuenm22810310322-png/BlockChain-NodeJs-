const mongoose = require("mongoose");

const PriceCacheSchema = new mongoose.Schema(
	{
		coinId: { type: String, required: true, index: true },
		price: { type: Number, required: true },
		source: { type: String, default: "chainlink" },
		updatedAt: { type: Date, required: true },
	},
	{ timestamps: true }
);

// Keep only recent history (7 days) via TTL index on createdAt
// Note: MongoDB TTL index uses seconds; index is created if not present.
PriceCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model("PriceCache", PriceCacheSchema);
