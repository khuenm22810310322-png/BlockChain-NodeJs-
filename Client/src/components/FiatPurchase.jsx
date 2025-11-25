import React, { useState } from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import api from "../services/api";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { getExplorerUrl } from "../utils/explorer";

const FiatPurchase = ({ coin, marketPrice, onSuccess, onClose, walletAddress, listing }) => {
    const { user, fetchProfile } = useAuth();
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("paypal"); // 'paypal' | 'vietqr'
    const [manualPrice, setManualPrice] = useState(""); // For dev/testing when price is 0
    const [successData, setSuccessData] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Determine price source
    const listingPrice = listing 
        ? Number((listing.pricePerUnitNumber ?? listing.pricePerUnitHuman ?? parseFloat(listing.pricePerUnit)) || 0)
        : 0;
    
    const effectivePrice = listing 
        ? listingPrice 
        : (marketPrice > 0 ? marketPrice : (parseFloat(manualPrice) || 0));

    const rawCost = amount ? parseFloat(amount) * effectivePrice : 0;
    const safeRawCost = isNaN(rawCost) ? 0 : rawCost;
    // PayPal requires at least 0.01 USD. If calculated cost is lower but non-zero, we might need to handle it.
    // However, for simplicity, we'll just format it. If it rounds to 0.00, we must block it.
    const totalCost = safeRawCost.toFixed(2);
    const totalCostVND = amount ? (safeRawCost * 25000).toFixed(0) : "0"; // Approx rate 1 USD = 25000 VND
    
    const listingRemaining = listing 
        ? Number((listing.remainingNumber ?? parseFloat(listing.remainingAmount || 0)) || 0)
        : Infinity;

    const isAmountExceeds = listing && parseFloat(amount) > listingRemaining;
    const isValidAmount = parseFloat(totalCost) >= 0.01 && !isAmountExceeds;

    // Helper to request signature
    const requestSignature = async () => {
        if (!walletAddress) {
            toast.error("Vui lòng kết nối ví MetaMask để nhận Token!");
            throw new Error("Wallet not connected");
        }

        try {
            const { ethers } = await import("ethers");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const signerAddress = await signer.getAddress();

            if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                toast.error(`❌ Ví MetaMask không khớp! Vui lòng chuyển sang ví ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
                throw new Error("Wallet mismatch");
            }

            const message = `Xác nhận mua ${amount} ${coin.symbol} từ ${listing ? `Listing #${listing.id}` : "Sàn"}\nTổng tiền: $${totalCost}\nVí nhận Token: ${walletAddress}`;
            await signer.signMessage(message);
            return true;
        } catch (err) {
            console.error("Signature error:", err);
            toast.warning("Bạn đã hủy xác nhận trên MetaMask");
            throw err;
        }
    };

    const handlePayPalCreateOrder = async (data, actions) => {
        if (!isValidAmount) {
            if (isAmountExceeds) {
                toast.error(`Amount exceeds available quantity (${listingRemaining})`);
                throw new Error("Amount exceeds available");
            }
            toast.error("Minimum purchase amount is $0.01");
            throw new Error("Amount too low");
        }

        // Request signature BEFORE creating order
        await requestSignature();

        try {
            const res = await api.post("/api/payment/create-paypal-order", {
                amount: totalCost
            });
            return res.data.id;
        } catch (err) {
            toast.error("Failed to create PayPal order");
            console.error(err);
            throw err;
        }
    };

    const handlePayPalApprove = async (data, actions) => {
        try {
            const res = await api.post("/api/payment/capture-paypal-order", {
                orderID: data.orderID,
                coinId: coin.id,
                walletAddress: walletAddress,
                amountToken: amount,
                listingId: listing?.id
            });
            if (res.data.success) {
                setSuccessData(res.data);
                onSuccess && onSuccess({ ...res.data, amount: parseFloat(amount) });
            }
        } catch (err) {
            toast.error("Payment failed or token transfer failed.");
            console.error(err);
        }
    };

    const handleBalancePayment = async () => {
        if (!isValidAmount) {
             if (isAmountExceeds) {
                toast.error(`Amount exceeds available quantity (${listingRemaining})`);
                return;
            }
            toast.error("Minimum purchase amount is $0.01");
            return;
        }
        
        setIsProcessing(true);
        try {
            const res = await api.post("/api/payment/buy-with-balance", {
                coinId: coin.id,
                walletAddress: walletAddress,
                amountToken: amount,
                listingId: listing?.id,
                totalCost: totalCost
            });
            if (res.data.success) {
                setSuccessData(res.data);
                fetchProfile(); // Update balance
                onSuccess && onSuccess({ ...res.data, amount: parseFloat(amount) });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Payment failed.");
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVietQRConfirm = async () => {
        setIsProcessing(true);
        try {
            // Request signature BEFORE confirming payment
            await requestSignature();

            const res = await api.post("/api/payment/confirm-vietqr-payment", {
                coinId: coin.id,
                walletAddress: walletAddress,
                amountToken: amount,
                listingId: listing?.id,
                amountUSD: totalCost // Pass the USD amount for crediting seller
            });
            if (res.data.success) {
                setSuccessData(res.data);
                onSuccess && onSuccess({ ...res.data, amount: parseFloat(amount) });
            }
        } catch (err) {
            if (err.message !== "Wallet mismatch" && err.message !== "Wallet not connected") {
                 toast.error("Failed to confirm VietQR payment.");
            }
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Generate QR Link: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<INFO>
    const bankId = import.meta.env.VITE_VIETQR_BANK_ID || "MB";
    const accountNo = import.meta.env.VITE_VIETQR_ACCOUNT_NO || "0000000000";
    // Content format: CT <USER_ID> <COIN_ID>
    const transferContent = `CT ${user?._id} ${coin.id} ${listing ? 'L'+listing.id : ''}`;
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${totalCostVND}&addInfo=${transferContent}`;

    if (successData) {
        const explorerUrl = getExplorerUrl(successData.txHash);
        return (
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">Thanh toán thành công!</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Bạn đã mua thành công {amount} {coin.symbol}.
                </p>
                
                {successData.txHash && (
                    <div className="mb-6 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Transaction Hash</p>
                        <p className="text-xs font-mono break-all text-blue-600 dark:text-blue-400 select-all">
                            {successData.txHash}
                        </p>
                        {explorerUrl ? (
                            <a 
                                href={explorerUrl}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline mt-2 inline-block"
                            >
                                Xem trên Explorer ↗
                            </a>
                        ) : (
                            <p className="text-xs text-gray-400 mt-2 italic">
                                (Local Network - No Explorer)
                            </p>
                        )}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
                >
                    Đóng
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
                Buy {coin.symbol} {listing ? `(Listing #${listing.id})` : "from Exchange"}
            </h3>
            
            {(!listing && (marketPrice <= 0 || isNaN(marketPrice))) && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-2">
                        ⚠️ Price unavailable. Enter a simulated price for testing:
                    </p>
                    <input
                        type="number"
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                        className="w-full p-2 border rounded bg-white border-yellow-300 text-gray-900"
                        placeholder="e.g. 1.5"
                    />
                </div>
            )}

            <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Amount ({coin.symbol})</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.0"
                />
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost:</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">${totalCost} USD</p>
                <p className="text-sm text-gray-400">≈ {parseInt(totalCostVND).toLocaleString()} VND</p>
            </div>

            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setPaymentMethod("paypal")}
                    className={`flex-1 p-2 rounded border transition-colors ${
                        paymentMethod === "paypal" 
                        ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-200" 
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                >
                    PayPal
                </button>
                <button
                    onClick={() => setPaymentMethod("vietqr")}
                    className={`flex-1 p-2 rounded border transition-colors ${
                        paymentMethod === "vietqr" 
                        ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-200" 
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                >
                    VietQR
                </button>
                <button
                    onClick={() => setPaymentMethod("balance")}
                    className={`flex-1 p-2 rounded border transition-colors ${
                        paymentMethod === "balance" 
                        ? "bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-200" 
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                >
                    Balance
                </button>
            </div>

            {amount > 0 && (
                <div className="mt-4">
                    {isAmountExceeds && (
                        <div className="p-3 mb-3 bg-red-100 text-red-700 rounded text-sm">
                            ⚠️ Amount exceeds available quantity ({listingRemaining} {coin.symbol}).
                        </div>
                    )}
                    {!isValidAmount && !isAmountExceeds && (
                        <div className="p-3 mb-3 bg-red-100 text-red-700 rounded text-sm">
                            ⚠️ Minimum purchase amount is $0.01. Please increase the quantity.
                        </div>
                    )}

                    {isValidAmount && (
                        paymentMethod === "paypal" ? (
                            <PayPalButtons
                                style={{ layout: "vertical" }}
                                createOrder={handlePayPalCreateOrder}
                                onApprove={handlePayPalApprove}
                                onCancel={() => toast.info("Bạn đã hủy thanh toán PayPal")}
                                onError={(err) => {
                                    console.error("PayPal Error:", err);
                                    toast.error("Đã xảy ra lỗi với PayPal");
                                }}
                            />
                        ) : paymentMethod === "vietqr" ? (
                            <div className="text-center">
                                <div className="bg-white p-2 inline-block rounded mb-4">
                                    <img src={qrUrl} alt="VietQR" className="max-w-[200px]" />
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Scan with your banking app to pay</p>
                                <button
                                    onClick={handleVietQRConfirm}
                                    disabled={isProcessing}
                                    className={`w-full py-2 rounded transition-colors font-medium text-white ${
                                        isProcessing 
                                        ? "bg-gray-400 cursor-not-allowed" 
                                        : "bg-green-600 hover:bg-green-700"
                                    }`}
                                >
                                    {isProcessing ? "Server đang chuyển Token on-chain..." : "Tôi đã thanh toán"}
                                </button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                    Current Balance: <strong>${user?.fiatBalance?.toFixed(2) || "0.00"}</strong>
                                </p>
                                <button
                                    onClick={handleBalancePayment}
                                    disabled={isProcessing}
                                    className={`w-full py-2 rounded transition-colors font-medium text-white ${
                                        isProcessing 
                                        ? "bg-gray-400 cursor-not-allowed" 
                                        : "bg-blue-600 hover:bg-blue-700"
                                    }`}
                                >
                                    {isProcessing ? "Processing..." : `Pay $${totalCost} with Balance`}
                                </button>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default FiatPurchase;
