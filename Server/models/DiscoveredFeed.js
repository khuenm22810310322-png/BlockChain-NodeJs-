const mongoose = require("mongoose");

const DiscoveredFeedSchema = new mongoose.Schema(
	{
		coinId: { type: String, required: true, index: true },
		symbol: { type: String },
		chain: { type: String, required: true }, // ethereum | polygon | arbitrum | bsc
		feedAddress: { type: String, required: true },
		source: { type: String, default: "registry" }, // registry | manual | import
		active: { type: Boolean, default: true },
		lastChecked: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

DiscoveredFeedSchema.index({ coinId: 1, chain: 1 }, { unique: true });

module.exports = mongoose.model("DiscoveredFeed", DiscoveredFeedSchema);
