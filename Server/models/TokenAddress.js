const mongoose = require("mongoose");

const TokenAddressSchema = new mongoose.Schema(
	{
		coinId: { type: String, required: true, unique: true, index: true },
		symbol: { type: String, required: true },
		addresses: {
			ethereum: { type: String },
			polygon: { type: String },
			arbitrum: { type: String },
			bsc: { type: String },
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("TokenAddress", TokenAddressSchema);
