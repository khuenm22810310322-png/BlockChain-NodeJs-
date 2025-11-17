const mongoose = require("mongoose");

const PriceSnapshotSchema = new mongoose.Schema(
	{
		coinId: { type: String, required: true, index: true },
		price: { type: Number, required: true },
		source: { type: String, default: "chainlink" },
		ts: { type: Date, default: Date.now, index: true },
	},
	{ versionKey: false }
);

// TTL index to keep data for a limited time (default 7 days)
const ttlDays = parseInt(process.env.PRICE_SNAPSHOT_TTL_DAYS || "7", 10);
if (ttlDays > 0) {
	PriceSnapshotSchema.index({ ts: 1 }, { expireAfterSeconds: ttlDays * 24 * 60 * 60 });
}

module.exports = mongoose.model("PriceSnapshot", PriceSnapshotSchema);
