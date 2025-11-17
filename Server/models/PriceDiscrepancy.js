const mongoose = require("mongoose");

const PriceDiscrepancySchema = new mongoose.Schema(
	{
		coinId: { type: String, required: true, index: true },
		chainlinkPrice: { type: Number, required: true },
		coingeckoPrice: { type: Number, required: true },
		diffPct: { type: Number, required: true },
		flagged: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

module.exports = mongoose.model("PriceDiscrepancy", PriceDiscrepancySchema);
