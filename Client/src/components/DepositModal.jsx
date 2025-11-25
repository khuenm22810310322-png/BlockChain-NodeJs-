import React, { useState } from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import api from "../services/api";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import CloseIcon from "@mui/icons-material/Close";

const DepositModal = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("paypal"); // 'paypal' | 'vietqr'
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const amountNum = parseFloat(amount);
    const isValidAmount = !isNaN(amountNum) && amountNum >= 0.01;
    const totalCostVND = isValidAmount ? (amountNum * 25000).toFixed(0) : "0";

    // Generate QR Link
    const bankId = import.meta.env.VITE_VIETQR_BANK_ID || "MB";
    const accountNo = import.meta.env.VITE_VIETQR_ACCOUNT_NO || "0000000000";
    const transferContent = `DEPOSIT ${user?._id}`;
    const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${totalCostVND}&addInfo=${transferContent}`;

    const handlePayPalCreateOrder = async (data, actions) => {
        if (!isValidAmount) {
            toast.error("Minimum deposit amount is $0.01");
            throw new Error("Amount too low");
        }
        try {
            const res = await api.post("/api/payment/create-paypal-order", {
                amount: amount
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
            const res = await api.post("/api/payment/capture-deposit-paypal-order", {
                orderID: data.orderID
            });
            if (res.data.success) {
                toast.success(res.data.message);
                onSuccess && onSuccess(res.data.newBalance);
                onClose();
            }
        } catch (err) {
            toast.error("Deposit failed.");
            console.error(err);
        }
    };

    const handleVietQRConfirm = async () => {
        if (!isValidAmount) return;
        setIsProcessing(true);
        try {
            const res = await api.post("/api/payment/confirm-deposit-vietqr", {
                amount: amount
            });
            if (res.data.success) {
                toast.success(res.data.message);
                onSuccess && onSuccess(res.data.newBalance);
                onClose();
            }
        } catch (err) {
            toast.error("Failed to confirm VietQR deposit.");
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deposit Funds</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <CloseIcon />
                    </button>
                </div>

                <div className="p-4">
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Amount (USD)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            placeholder="10.00"
                        />
                    </div>

                    {isValidAmount && (
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                            <p className="text-sm text-gray-500 dark:text-gray-400">You will pay:</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">${amountNum.toFixed(2)} USD</p>
                            <p className="text-sm text-gray-400">≈ {parseInt(totalCostVND).toLocaleString()} VND</p>
                        </div>
                    )}

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
                    </div>

                    {isValidAmount ? (
                        paymentMethod === "paypal" ? (
                            <PayPalButtons
                                style={{ layout: "vertical" }}
                                createOrder={handlePayPalCreateOrder}
                                onApprove={handlePayPalApprove}
                            />
                        ) : (
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
                                    {isProcessing ? "Processing..." : "I have paid"}
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                            Please enter a valid amount to proceed.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DepositModal;
