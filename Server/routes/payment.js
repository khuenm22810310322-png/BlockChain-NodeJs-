const express = require("express");
const router = express.Router();
const paypal = require("@paypal/checkout-server-sdk");
const { ethers } = require("ethers");
const path = require("path");
const Transaction = require("../models/Transaction");
const PaymentRecord = require("../models/PaymentRecord");
const User = require("../models/Users");
const passport = require("passport");
const { normalizeToCoinGeckoId } = require("../utils/idMapper");

// Load .env
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// PayPal Setup
const Environment = process.env.NODE_ENV === "production"
    ? paypal.core.LiveEnvironment
    : paypal.core.SandboxEnvironment;

const clientId = process.env.PAYPAL_CLIENT_ID || "sb";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "sb";

const paypalClient = new paypal.core.PayPalHttpClient(
    new Environment(clientId, clientSecret)
);

// Blockchain Setup
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

// ERC20 ABI
const erc20Abi = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function decimals() view returns (uint8)",
    "function faucet(uint256 amount) external",
    "function balanceOf(address owner) external view returns (uint256)"
];

const artifact = require("../artifacts/P2PMarketplace.json");
const marketplaceAbi = artifact.abi;

// Helper to load tokens
const loadDeployedTokens = () => {
    try {
        const deployedPath = path.join(__dirname, "..", "..", "blockchain", "deployed-tokens.json");
        delete require.cache[require.resolve(deployedPath)];
        const data = require(deployedPath);
        return { 
            tokens: data.tokens || {}, 
            marketplaceAddress: data.marketplace 
        };
    } catch (error) {
        return { tokens: {}, marketplaceAddress: null };
    }
};

async function transferTokens(userId, walletAddress, coinId, amount, paymentMethod, paymentId, listingId = null, amountUSD = 0) {
    if (!signer) throw new Error("Server wallet not configured");
    
    const { tokens, marketplaceAddress } = loadDeployedTokens();
    const normalizedCoinId = normalizeToCoinGeckoId(coinId);
    const tokenAddress = tokens[normalizedCoinId] || tokens[coinId];
    
    if (!tokenAddress) throw new Error(`Token not found for ${coinId}`);

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
    const amountWei = ethers.parseUnits(amount.toString(), 18); // Assuming 18 decimals

    // If buying from a listing, execute the buy on the blockchain first
    if (listingId) {
        if (!marketplaceAddress) throw new Error("Marketplace address not found");
        console.log(`Executing Buy for Listing #${listingId} on behalf of user...`);
        
        const marketplace = new ethers.Contract(marketplaceAddress, marketplaceAbi, signer);
        
        // Fetch listing to get price
        const listing = await marketplace.listings(listingId);
        console.log(`DEBUG: Listing #${listingId} fetched. Seller: ${listing.seller}, Price: ${listing.pricePerUnit}`);
        
        // Check remaining amount
        if (listing.remainingAmount < amountWei) {
             throw new Error(`Insufficient remaining amount in listing. Available: ${ethers.formatUnits(listing.remainingAmount, 18)}, Requested: ${amount}`);
        }

        // listing struct: seller, token, paymentToken, remainingAmount, pricePerUnit, status, createdAt
        // We need pricePerUnit. 
        // Note: In Solidity struct, fields are indexed 0..N. 
        // But ethers returns an array-like object with named properties if ABI is correct.
        
        const pricePerUnit = listing.pricePerUnit;
        const totalCost = (pricePerUnit * amountWei) / 1000000000000000000n; // / 1e18
        
        // Execute fillListingForFiat (Admin fills listing, no on-chain payment to seller)
        // This allows us to credit the Seller's Fiat Balance in the DB instead.
        const txBuy = await marketplace.fillListingForFiat(listingId, amountWei, walletAddress);
        const receipt = await txBuy.wait();
        console.log(`fillListingForFiat successful: ${txBuy.hash}. Tokens sent directly to ${walletAddress}.`);
        
        // Credit Seller's Fiat Balance
        // We need to find the user associated with the seller's wallet address
        const sellerAddress = listing.seller;
        console.log(`DEBUG: Looking for seller with wallet: ${sellerAddress}`);
        
        // Try to find seller by wallet address
        let sellerUser = await User.findOne({ walletAddress: { $regex: new RegExp(`^${sellerAddress}$`, "i") } });
        
        // Fallback: If buyer is the seller (buying own listing) and wallet not linked in DB
        if (!sellerUser && walletAddress.toLowerCase() === sellerAddress.toLowerCase()) {
             console.log("DEBUG: Buyer is Seller (Self-Buy detected), using buyer's user ID.");
             sellerUser = await User.findById(userId);
        }

        if (sellerUser) {
            console.log(`DEBUG: Found seller user: ${sellerUser.username}, Current Balance: ${sellerUser.fiatBalance}`);
            // Credit the USD amount paid by the buyer to the seller's Fiat Balance
            const creditAmount = parseFloat(amountUSD);
            console.log(`DEBUG: Crediting amount: ${creditAmount}`);
            if (creditAmount > 0) {
                // Reload user to ensure fresh balance (especially if buyer == seller)
                const freshSeller = await User.findById(sellerUser._id);
                freshSeller.fiatBalance = (freshSeller.fiatBalance || 0) + creditAmount;
                await freshSeller.save();
                console.log(`Credited $${creditAmount} to Seller ${freshSeller.username} (Wallet: ${sellerAddress}). New Balance: ${freshSeller.fiatBalance}`);
            }
        } else {
            console.log(`DEBUG: Seller user not found for wallet ${sellerAddress}`);
        }
        
        // Save Transaction
        const transaction = new Transaction({
            txHash: receipt.hash,
            type: "buyFromListing",
            user: userId,
            walletAddress: walletAddress,
            coinId: normalizedCoinId,
            coinName: coinId,
            coinSymbol: coinId.toUpperCase(),
            amount: amountWei.toString(),
            status: "confirmed",
            metadata: {
                paymentMethod,
                paymentId,
                listingId
            }
        });
        await transaction.save();
        return receipt.hash;
    }

    // Check server balance and top up if needed (only for Exchange mode)
    try {
        const serverAddress = await signer.getAddress();
        const balance = await tokenContract.balanceOf(serverAddress);
        if (balance < amountWei) {
            console.log(`Server balance low (${ethers.formatUnits(balance, 18)}), minting via faucet...`);
            const txMint = await tokenContract.faucet(amountWei * 100n); // Top up 100x
            await txMint.wait();
            console.log("Server wallet topped up.");
        }
    } catch (err) {
        console.warn("Could not check/topup server balance, attempting transfer anyway:", err.message);
    }

    console.log(`Transferring ${amount} ${coinId} to ${walletAddress} via ${paymentMethod}...`);
    const tx = await tokenContract.transfer(walletAddress, amountWei);
    const receipt = await tx.wait();
    console.log(`Transfer successful: ${receipt.hash}`);

    // Save Transaction
    const transaction = new Transaction({
        txHash: receipt.hash,
        type: "buyFromExchange",
        user: userId,
        walletAddress: walletAddress,
        coinId: normalizedCoinId,
        coinName: coinId,
        coinSymbol: coinId.toUpperCase(),
        amount: amountWei.toString(),
        status: "confirmed",
        metadata: {
            paymentMethod,
            paymentId,
            listingId
        }
    });
    await transaction.save();
    return receipt.hash;
}

// 1. Create PayPal Order
router.post("/create-paypal-order", passport.authenticate("jwt", { session: false }), async (req, res) => {
    if (clientId === "sb" || clientSecret === "sb" || clientId === "YOUR_PAYPAL_CLIENT_ID") {
        console.error("❌ PayPal Credentials missing in Server/.env");
        return res.status(500).json({ error: "Server PayPal credentials not configured." });
    }

    const { amount } = req.body; // Amount in USD
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: "CAPTURE",
        purchase_units: [{
            amount: {
                currency_code: "USD",
                value: amount.toString()
            }
        }]
    });

    try {
        const order = await paypalClient.execute(request);
        res.json({ id: order.result.id });
    } catch (e) {
        console.error("PayPal Create Order Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Capture PayPal Order & Transfer Tokens
router.post("/capture-paypal-order", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { orderID, coinId, walletAddress, amountToken, listingId } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
        const capture = await paypalClient.execute(request);
        if (capture.result.status === "COMPLETED") {
             // Calculate USD amount from capture details
             const amountUSD = capture.result.purchase_units[0].payments.captures[0].amount.value;
             
             const txHash = await transferTokens(req.user._id, walletAddress, coinId, amountToken, "paypal", capture.result.id, listingId, amountUSD);
             res.json({ success: true, message: "Payment successful and tokens transferred", txHash });
        } else {
            res.status(400).json({ error: "Payment not completed" });
        }
    } catch (e) {
        console.error("PayPal Capture Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. VietQR Payment Confirmation (Simulated)
router.post("/confirm-vietqr-payment", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { coinId, walletAddress, amountToken, listingId } = req.body;
    
    // In a real app, we would verify the payment via Casso webhook or checking DB for a matching transaction code.
    // For this demo, we simulate success.
    
    try {
        // Simulate USD amount (assuming 1 Token = $1 for simplicity if not provided, but ideally we should pass it)
        // For now, we don't have the exact USD amount here unless passed from frontend.
        // Let's assume the frontend passes 'amountUSD' or we calculate it.
        // But wait, the frontend calculates totalCost.
        // Let's update the frontend to pass 'totalCost' (USD) to this endpoint.
        const amountUSD = req.body.amountUSD || "0";

        const txHash = await transferTokens(req.user._id, walletAddress, coinId, amountToken, "vietqr", "simulated-" + Date.now(), listingId, amountUSD);
        res.json({ success: true, message: "VietQR Payment confirmed (Simulated)", txHash });
    } catch (e) {
        console.error("VietQR Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Casso Webhook (Real-time Bank Sync)
// URL: http://your-domain.com/api/payment/webhook/casso
// Header: secure-token: YOUR_CASSO_SECURE_TOKEN
router.post("/webhook/casso", async (req, res) => {
    try {
        const { error, data } = req.body;
        if (error !== 0) return res.status(400).json({ error: "Casso reported error" });

        console.log("🔔 Webhook received:", data.length, "transactions");

        for (const tx of data) {
            // 1. Check if processed
            const exists = await PaymentRecord.findOne({ transactionId: tx.tid });
            if (exists) continue;

            // 2. Parse Content: "CT <USER_ID> <COIN_ID>"
            // Example: "CT 65f8a... bitcoin"
            const content = tx.description.toUpperCase();
            const regex = /CT\s+([A-Z0-9]+)\s+([A-Z0-9\-\.]+)/i;
            const match = content.match(regex);

            if (match) {
                const userId = match[1];
                const coinId = match[2].toLowerCase();
                const amountVND = tx.amount;
                
                // Estimate Token Amount (Simplified: 1 USD = 25000 VND)
                // In production, fetch real price here
                const amountUSD = amountVND / 25000;
                
                // We need to fetch the coin price to calculate token amount
                // For now, we assume the user sent the exact amount calculated on client
                // Or we can just store the record and let the user "Claim" it.
                
                // Saving record first
                const record = new PaymentRecord({
                    transactionId: tx.tid,
                    amount: amountVND,
                    content: tx.description,
                    bankAccount: tx.bankSubAccId,
                    userId: userId,
                    coinId: coinId
                });
                await record.save();

                // Auto-transfer if we can determine the amount
                // This requires fetching the current price of coinId
                // For safety, we might just mark it as "Received" and let the user confirm on UI
                // But to be "Magic", let's try to transfer.
                
                // NOTE: In a real app, you should calculate the exact token amount based on the VND received
                // and the current live price.
                console.log(`💰 Payment received for User ${userId}, Coin ${coinId}, Amount ${amountVND} VND`);
            }
        }

        res.json({ error: 0, message: "Webhook received" });
    } catch (e) {
        console.error("Webhook Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 5. Deposit to Internal Balance (Mock)
router.post("/deposit", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { amount } = req.body; // Amount in USD
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    try {
        const user = await User.findById(req.user._id);
        user.fiatBalance = (user.fiatBalance || 0) + parseFloat(amount);
        await user.save();
        res.json({ success: true, newBalance: user.fiatBalance, message: `Deposited $${amount} successfully.` });
    } catch (e) {
        console.error("Deposit Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 6. Buy with Internal Balance
router.post("/buy-with-balance", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { listingId, amountToken, coinId, walletAddress, totalCost } = req.body;
    
    try {
        const user = await User.findById(req.user._id);
        const cost = parseFloat(totalCost);
        
        if ((user.fiatBalance || 0) < cost) {
            return res.status(400).json({ error: "Insufficient balance. Please deposit more funds." });
        }

        // Deduct balance from Buyer
        user.fiatBalance -= cost;
        await user.save();

        // Execute Transfer (This will credit the Seller)
        // We pass 'balance' as paymentMethod
        const txHash = await transferTokens(req.user._id, walletAddress, coinId, amountToken, "balance", "internal-" + Date.now(), listingId, cost);
        
        res.json({ success: true, message: "Purchase successful using Balance", txHash, newBalance: user.fiatBalance });
    } catch (e) {
        console.error("Buy with Balance Error:", e);
        // Refund if transfer failed
        try {
            const user = await User.findById(req.user._id);
            user.fiatBalance += parseFloat(totalCost);
            await user.save();
        } catch (refundError) {
            console.error("Refund Error:", refundError);
        }
        
        res.status(500).json({ error: "Transaction failed, balance refunded. " + e.message });
    }
});

// 7. Capture PayPal Deposit
router.post("/capture-deposit-paypal-order", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { orderID } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
        const capture = await paypalClient.execute(request);
        if (capture.result.status === "COMPLETED") {
             const amountUSD = parseFloat(capture.result.purchase_units[0].payments.captures[0].amount.value);
             
             const user = await User.findById(req.user._id);
             user.fiatBalance = (user.fiatBalance || 0) + amountUSD;
             await user.save();

             // Save Transaction Record
             const transaction = new Transaction({
                txHash: "PAYPAL-" + capture.result.id,
                type: "deposit",
                user: req.user._id,
                walletAddress: user.walletAddress || "internal",
                coinId: "USD",
                coinName: "US Dollar",
                coinSymbol: "USD",
                amount: amountUSD.toString(),
                status: "confirmed",
                metadata: {
                    paymentMethod: "paypal",
                    paymentId: capture.result.id
                }
            });
            await transaction.save();

             res.json({ success: true, message: `Deposited $${amountUSD} successfully.`, newBalance: user.fiatBalance });
        } else {
            res.status(400).json({ error: "Payment not completed" });
        }
    } catch (e) {
        console.error("PayPal Capture Deposit Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 8. Confirm VietQR Deposit (Simulated)
router.post("/confirm-deposit-vietqr", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const { amount } = req.body; // Amount in USD
    
    try {
        const amountUSD = parseFloat(amount);
        if (isNaN(amountUSD) || amountUSD <= 0) return res.status(400).json({ error: "Invalid amount" });

        const user = await User.findById(req.user._id);
        user.fiatBalance = (user.fiatBalance || 0) + amountUSD;
        await user.save();

        // Save Transaction Record
        const transaction = new Transaction({
            txHash: "VIETQR-" + Date.now(),
            type: "deposit",
            user: req.user._id,
            walletAddress: user.walletAddress || "internal",
            coinId: "USD",
            coinName: "US Dollar",
            coinSymbol: "USD",
            amount: amountUSD.toString(),
            status: "confirmed",
            metadata: {
                paymentMethod: "vietqr",
                paymentId: "simulated-" + Date.now()
            }
        });
        await transaction.save();

        res.json({ success: true, message: `Deposited $${amountUSD} via VietQR successfully.`, newBalance: user.fiatBalance });
    } catch (e) {
        console.error("VietQR Deposit Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
