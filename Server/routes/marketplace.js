const express = require("express");
const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config();
const Transaction = require("../models/Transaction");
const passport = require("passport");
const { normalizeToCoinGeckoId } = require("../utils/idMapper");

const router = express.Router();

// Load ABI
const artifactPath = path.join(__dirname, "..", "artifacts", "P2PMarketplace.json");
const artifact = require(artifactPath);
const abi = artifact.abi;

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
const contract = MARKETPLACE_ADDRESS ? new ethers.Contract(MARKETPLACE_ADDRESS, abi, signer || provider) : null;

// Load deployed tokens
let deployedTokens = {};
try {
	const deployedPath = path.join(__dirname, "..", "..", "blockchain", "deployed-tokens.json");
	const deployed = require(deployedPath);
	deployedTokens = deployed.tokens;
} catch (error) {
	console.error("Warning: deployed-tokens.json not found");
}

// ERC20 ABI for minting tokens
const erc20Abi = [
	"function transfer(address to, uint256 amount) external returns (bool)",
	"function balanceOf(address owner) external view returns (uint256)",
	"function approve(address spender, uint256 amount) external returns (bool)",
	"function allowance(address owner, address spender) external view returns (uint256)"
];

// Helpers
function requireContract(req, res) {
	if (!contract) {
		res.status(500).json({ error: "Marketplace contract not configured" });
		return false;
	}
	return true;
}

router.get("/config", (req, res) => {
	res.json({
		address: MARKETPLACE_ADDRESS || "",
		rpc: RPC_URL,
		signerEnabled: Boolean(PRIVATE_KEY),
		abi: abi, // Include ABI for frontend
	});
});

// Get mock token addresses (load from deployed-tokens.json)
router.get("/tokens", (req, res) => {
	try {
		const deployedPath = path.join(__dirname, "..", "..", "blockchain", "deployed-tokens.json");
		const deployed = require(deployedPath);
		res.json(deployed.tokens);
	} catch (error) {
		console.error("Failed to load deployed tokens:", error.message);
		res.status(500).json({ error: "Mock tokens not deployed. Run: npx hardhat run scripts/deploy-full.js --network localhost" });
	}
});

// Buy coins from exchange (mint tokens to user wallet)
router.post("/buy-from-exchange", passport.authenticate("jwt", { session: false }), async (req, res) => {
	try {
		console.log("=== BUY FROM EXCHANGE ===");
		console.log("User ID:", req.user?._id);
		console.log("Request body:", req.body);
		
		const { coinId, coinSymbol, coinName, amount, walletAddress, priceUSD } = req.body;
		const normalizedCoinId = normalizeToCoinGeckoId(coinId);

		if (!coinId || !amount || !walletAddress) {
			return res.status(400).json({ error: "Missing coinId, amount, or walletAddress" });
		}

		if (!signer) {
			return res.status(500).json({ error: "Server wallet not configured. Set PRIVATE_KEY in .env" });
		}

		// Get token address for this coin
		const tokenAddress = deployedTokens[normalizedCoinId] || deployedTokens[coinId];
		if (!tokenAddress) {
			return res.status(404).json({ error: `Token not found for coin: ${normalizedCoinId || coinId}` });
		}

		// Convert amount to Wei (18 decimals)
		const amountWei = ethers.parseUnits(amount.toString(), 18);

		// Create token contract instance with server's signer
		const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

		// Transfer tokens from server (deployer) to user
		console.log(`Minting ${amount} ${coinId} tokens to ${walletAddress}...`);
		const tx = await tokenContract.transfer(walletAddress, amountWei);
		const receipt = await tx.wait();

		// Save transaction to database
		console.log("Saving transaction to database...");
		try {
			const transactionData = {
				txHash: receipt.hash,
				type: "buyFromExchange",
				user: req.user._id,
				walletAddress: walletAddress,
				coinId: normalizedCoinId,
				coinName: coinName || normalizedCoinId || coinId,
				coinSymbol: coinSymbol || (normalizedCoinId || coinId).toUpperCase(),
				amount: amountWei.toString(),
				pricePerUnit: priceUSD ? ethers.parseUnits(priceUSD.toString(), 18).toString() : "0",
				totalValue: priceUSD ? ethers.parseUnits((amount * priceUSD).toString(), 18).toString() : "0",
				status: "confirmed",
				blockNumber: receipt.blockNumber,
				gasUsed: receipt.gasUsed.toString(),
			};
			console.log("Transaction data to save:", transactionData);
			
			const transaction = new Transaction(transactionData);
			await transaction.save();
			console.log("✅ Transaction saved to database:", receipt.hash);
		} catch (dbError) {
			console.error("❌ Failed to save transaction to database:", dbError);
		}

		res.json({
			success: true,
			message: `Successfully bought ${amount} ${coinSymbol || coinId}`,
			txHash: receipt.hash,
			tokenAddress,
			amount: amountWei.toString(),
			blockNumber: receipt.blockNumber,
		});
	} catch (error) {
		console.error("Buy from exchange error:", error);
		res.status(500).json({ 
			error: "Failed to buy coins", 
			details: error.message 
		});
	}
});

// In-memory cache for coin metadata (coinId -> {token, symbol, name})
const coinMetadataCache = new Map();

// List active listings (simple scan). For production, replace with an indexer or events.
router.get("/listings", async (req, res) => {
	if (!requireContract(req, res)) return;
	try {
		const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
		const start = parseInt(req.query.start || "1", 10);
		const coinId = req.query.coinId; // Filter by coinId if provided
		
		const nextId = await contract.nextListingId();
		const maxId = Number(nextId) - 1;
		const ids = [];
		for (let i = start; i <= maxId && ids.length < limit; i++) {
			ids.push(i);
		}
		const listings = await Promise.all(ids.map((id) => contract.getListing(id)));
		const active = [];
		for (let idx = 0; idx < ids.length; idx++) {
			const lst = listings[idx];
			if (Number(lst.status) === 1) {
				const listingData = { 
					id: ids[idx], 
					...lst,
					coinId: coinMetadataCache.get(ids[idx])?.coinId,
					coinName: coinMetadataCache.get(ids[idx])?.coinName,
					coinSymbol: coinMetadataCache.get(ids[idx])?.coinSymbol,
				};
				
				// Filter by coinId if specified
				if (!coinId || listingData.coinId === coinId) {
					active.push(listingData);
				}
			}
		}
		res.json({ total: maxId, active });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/listings/:id", async (req, res) => {
	if (!requireContract(req, res)) return;
	try {
		const listing = await contract.getListing(req.params.id);
		res.json(listing);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

router.get("/trades/:id", async (req, res) => {
	if (!requireContract(req, res)) return;
	try {
		const trade = await contract.getTrade(req.params.id);
		res.json(trade);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Create listing through backend signer (optional)
router.post("/listings", async (req, res) => {
	if (!requireContract(req, res)) return;
	if (!signer) return res.status(400).json({ error: "Backend signer not configured" });
	const { token, paymentToken, amount, pricePerUnit, coinId, coinName, coinSymbol } = req.body || {};
	if (!token || !amount || !pricePerUnit) return res.status(400).json({ error: "Missing fields" });
	try {
		// Convert to Wei (assuming 18 decimals)
		const amountWei = ethers.parseUnits(amount.toString(), 18);
		const priceWei = ethers.parseUnits(pricePerUnit.toString(), 18);
		
		const tx = await contract.createListing(token, paymentToken || ethers.ZeroAddress, amountWei, priceWei);
		const receipt = await tx.wait();
		const listingId = extractListingId(receipt);
		
		// Store coin metadata for filtering
		if (listingId && coinId) {
			coinMetadataCache.set(parseInt(listingId), { coinId, coinName, coinSymbol });
		}
		
		res.json({ txHash: receipt.hash, listingId });
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Buy via backend signer (optional)
router.post("/buy", passport.authenticate("jwt", { session: false }), async (req, res) => {
	if (!requireContract(req, res)) return;
	if (!signer) return res.status(400).json({ error: "Backend signer not configured" });
	const { listingId, amount, useOracle, coinId, coinName, coinSymbol } = req.body || {};
	if (!listingId || !amount) return res.status(400).json({ error: "Missing fields" });
	try {
		const user = req.user;
		const walletAddress = user.walletAddress;
		
		if (!walletAddress) {
			return res.status(400).json({ error: "User wallet address not found" });
		}
		
		const listing = await contract.getListing(listingId);
		
		// Convert amount to Wei (assuming 18 decimals) or appropriate unit
		const amountWei = ethers.parseUnits(amount.toString(), 18);
		let total = listing.pricePerUnit * amountWei / ethers.parseUnits("1", 18);
		
		if (useOracle) {
			const oracleAddr = await contract.priceFeed();
			if (!oracleAddr || oracleAddr === ethers.ZeroAddress) throw new Error("Oracle not configured");
			const aggregator = new ethers.Contract(
				oracleAddr,
				["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"],
				provider
			);
			const [, answer] = await aggregator.latestRoundData();
			total = BigInt(answer) * amountWei / ethers.parseUnits("1", 18);
		}
		
		const overrides = listing.paymentToken === ethers.ZeroAddress ? { value: total } : {};
		const tx = await contract[useOracle ? "buyAtMarket" : "buy"](listingId, amountWei, overrides);
		const receipt = await tx.wait();
		
		// Save transaction to database
		const transaction = new Transaction({
			txHash: receipt.hash,
			type: "buy",
			user: user._id,
			walletAddress,
			listingId: parseInt(listingId),
			coinId: coinId || listing.tokenAddress,
			coinName: coinName || `Token ${listingId}`,
			coinSymbol: coinSymbol || "TOKEN",
			amount: amount.toString(),
			pricePerUnit: ethers.formatUnits(listing.pricePerUnit, 18),
			totalValue: ethers.formatUnits(total, 18),
			status: receipt.status === 1 ? "confirmed" : "failed",
			blockNumber: receipt.blockNumber,
			gasUsed: receipt.gasUsed?.toString(),
		});
		
		await transaction.save();
		
		res.json({ 
			txHash: receipt.hash, 
			tradeId: extractTradeId(receipt),
			transaction: {
				id: transaction._id,
				coinId,
				amount
			}
		});
	} catch (e) {
		console.error("Buy error:", e);
		res.status(500).json({ error: e.message });
	}
});

// Buy at market price (without existing listing) - simulated purchase with transaction logging
router.post("/buy-market", passport.authenticate("jwt", { session: false }), async (req, res) => {
	const { coinId, coinName, coinSymbol, amount, pricePerUnit } = req.body || {};
	if (!coinId || !amount) return res.status(400).json({ error: "Missing coinId or amount" });
	const normalizedCoinId = normalizeToCoinGeckoId(coinId);
	if (!contract) {
		console.warn("Marketplace contract not configured - running simulated buy without on-chain call");
	}
	
	try {
		const user = req.user;
		const walletAddress = user.walletAddress;
		
		if (!walletAddress) {
			return res.status(400).json({ error: "User wallet address not found" });
		}
		
		// Generate a mock transaction hash for tracking (since this is simulated)
		const mockTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`;
		
		// Calculate total value
		const totalValue = (parseFloat(amount) * parseFloat(pricePerUnit || 0)).toString();
		const amountWei = ethers.parseUnits(amount.toString(), 18);
		
		// Create transaction record
		const transaction = new Transaction({
			txHash: mockTxHash,
			type: "buyFromExchange",
			user: user._id,
			walletAddress,
			coinId: normalizedCoinId,
			coinName: coinName || normalizedCoinId || coinId,
			coinSymbol: coinSymbol || (normalizedCoinId || coinId).toUpperCase(),
			amount: amountWei.toString(),
			pricePerUnit: pricePerUnit?.toString() || "0",
			totalValue,
			status: "confirmed", // Simulated buy is instantly confirmed
		});
		
		await transaction.save();
		
		res.json({ 
			success: true,
			message: "Market buy completed",
			txHash: mockTxHash,
			transaction: {
				id: transaction._id,
				coinId,
				coinName,
				amount,
				pricePerUnit,
				totalValue
			}
		});
	} catch (e) {
		console.error("Buy market error:", e);
		res.status(500).json({ error: e.message });
	}
});

// Save transaction to database (called after frontend creates transaction)
router.post(
	"/transactions",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		try {
			const {
				txHash,
				type,
				walletAddress,
				listingId,
				coinId,
				coinName,
				coinSymbol,
				amount,
				pricePerUnit,
				totalValue,
			} = req.body || {};

			if (!txHash || !type || !walletAddress || !coinId || !amount) {
				return res.status(400).json({ error: "Missing required fields" });
			}

			// Check if transaction already exists
			const existing = await Transaction.findOne({ txHash });
			if (existing) {
				return res.json({ success: true, message: "Transaction already recorded", transaction: existing });
			}

			// Create new transaction record
			const transaction = new Transaction({
				txHash,
				type,
				user: req.user._id,
				walletAddress,
				listingId,
				coinId,
				coinName,
				coinSymbol,
				amount,
				pricePerUnit,
				totalValue,
				status: "pending",
			});

			await transaction.save();

			// Try to get transaction receipt and update
			try {
				const receipt = await provider.getTransactionReceipt(txHash);
				if (receipt) {
					transaction.status = receipt.status === 1 ? "confirmed" : "failed";
					transaction.blockNumber = receipt.blockNumber;
					transaction.gasUsed = receipt.gasUsed.toString();
					
					// Extract listingId from events if createListing
					if (type === "createListing" && !listingId) {
						const extractedId = extractListingId(receipt);
						if (extractedId) {
							transaction.listingId = parseInt(extractedId);
							// Save to cache
							coinMetadataCache.set(parseInt(extractedId), { coinId, coinName, coinSymbol });
						}
					}
					
					await transaction.save();
				}
			} catch (err) {
				console.error("Error fetching receipt:", err);
			}

			res.json({
				success: true,
				message: "Transaction recorded",
				transaction,
			});
		} catch (e) {
			console.error("Transaction save error:", e);
			res.status(500).json({ error: e.message });
		}
	}
);

// Get user's transaction history
router.get(
	"/transactions",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		try {
			const { limit = 50, skip = 0, type, coinId } = req.query;

			const query = { user: req.user._id };
			if (type) query.type = type;
			if (coinId) query.coinId = coinId;

			const transactions = await Transaction.find(query)
				.sort({ createdAt: -1 })
				.limit(parseInt(limit))
				.skip(parseInt(skip));

			const total = await Transaction.countDocuments(query);

			res.json({
				transactions,
				total,
				limit: parseInt(limit),
				skip: parseInt(skip),
			});
		} catch (e) {
			res.status(500).json({ error: e.message });
		}
	}
);

// Get transaction by hash
router.get("/transactions/:txHash", async (req, res) => {
	try {
		const transaction = await Transaction.findOne({ txHash: req.params.txHash }).populate("user", "username");

		if (!transaction) {
			return res.status(404).json({ error: "Transaction not found" });
		}

		res.json(transaction);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
});

// Utility to parse event args
function extractListingId(receipt) {
	for (const log of receipt.logs || []) {
		try {
			const parsed = contract.interface.parseLog(log);
			if (parsed && parsed.name === "ListingCreated") {
				return parsed.args?.listingId?.toString();
			}
		} catch (_e) {}
	}
	return null;
}

function extractTradeId(receipt) {
	for (const log of receipt.logs || []) {
		try {
			const parsed = contract.interface.parseLog(log);
			if (parsed && parsed.name === "TradeExecuted") {
				return parsed.args?.tradeId?.toString();
			}
		} catch (_e) {}
	}
	return null;
}

module.exports = router;
