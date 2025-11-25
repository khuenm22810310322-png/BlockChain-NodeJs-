const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
	{
		txHash: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		type: {
			type: String,
			enum: ["createListing", "buy", "cancel", "buyFromExchange", "buyFromListing", "deposit"],
			required: true,
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		walletAddress: {
			type: String,
			required: true,
			index: true,
		},
		listingId: {
			type: Number,
		},
		coinId: {
			type: String,
			required: true,
		},
		coinName: String,
		coinSymbol: String,
		amount: {
			type: String, // Wei format
			required: true,
		},
		pricePerUnit: {
			type: String, // Wei format
		},
		totalValue: String, // Wei format
		status: {
			type: String,
			enum: ["pending", "confirmed", "failed"],
			default: "pending",
		},
		blockNumber: Number,
		gasUsed: String,
		metadata: {
			type: Object,
		},
	},
	{
		timestamps: true,
	}
);

// Index for querying
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ walletAddress: 1, createdAt: -1 });
transactionSchema.index({ coinId: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
