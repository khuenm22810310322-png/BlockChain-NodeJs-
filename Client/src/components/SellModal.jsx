import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { toast } from "react-toastify";
import api from "../services/api";

export default function SellModal({ coin, portfolio, onClose, onSuccess }) {
	const { isConnected, connect, account } = useWallet();
	const [amount, setAmount] = useState("");
	const [pricePerUnit, setPricePerUnit] = useState("");
	const [loading, setLoading] = useState(false);

	const maxAmount = portfolio[coin.id]?.coins || 0;
	const currentPrice = coin.current_price || 0;

	const handleSubmit = async (e) => {
		e.preventDefault();
		
		if (!isConnected) {
			toast.error("Vui lòng kết nối ví trước");
			return;
		}

		if (parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount) {
			toast.error(`Số lượng phải từ 0 đến ${maxAmount}`);
			return;
		}

		if (parseFloat(pricePerUnit) <= 0) {
			toast.error("Giá phải lớn hơn 0");
			return;
		}

		try {
			setLoading(true);
			
			// Get contract config and token addresses from backend
			const [configRes, tokensRes] = await Promise.all([
				api.get("/api/marketplace/config"),
				api.get("/api/marketplace/tokens")
			]);
			
			const { address: marketplaceAddress, abi } = configRes.data;
			const mockTokens = tokensRes.data;
			
			if (!marketplaceAddress) {
				throw new Error("Marketplace contract not configured");
			}

			if (!window.ethereum) {
				throw new Error("MetaMask not installed");
			}

			// Dynamic import ethers
			const { ethers } = await import("ethers");
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			
			// Get token address based on coin ID (map to mock tokens)
			const tokenAddress = mockTokens[coin.id] || mockTokens.bitcoin; // Default to BTC if not found
			
			if (!tokenAddress) {
				throw new Error(`Token address not found for ${coin.id}`);
			}
			
			// Create contract instances
			const marketplaceContract = new ethers.Contract(marketplaceAddress, abi, signer);
			
			// ERC20 ABI for approve
			const erc20Abi = [
				"function approve(address spender, uint256 amount) external returns (bool)",
				"function allowance(address owner, address spender) external view returns (uint256)"
			];
			const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
			
			const paymentToken = ethers.ZeroAddress; // Native ETH
			
			// Convert to Wei (18 decimals)
			const amountWei = ethers.parseUnits(amount.toString(), 18);
			const priceWei = ethers.parseUnits(pricePerUnit.toString(), 18);
			
			// Step 1: Check and approve token spending
			toast.info("🔐 Kiểm tra allowance...");
			const currentAllowance = await tokenContract.allowance(account, marketplaceAddress);
			
			if (currentAllowance < amountWei) {
				toast.info("⏳ Đang approve token... Vui lòng xác nhận trên MetaMask");
				const approveTx = await tokenContract.approve(marketplaceAddress, amountWei);
				await approveTx.wait();
				toast.success("✅ Approved!");
			}
			
			// Step 2: Create listing
			toast.info("⏳ Đang tạo listing... Vui lòng xác nhận trên MetaMask");
			const tx = await marketplaceContract.createListing(tokenAddress, paymentToken, amountWei, priceWei);
			
			toast.info("⏳ Đang chờ xác nhận trên blockchain...");
			const receipt = await tx.wait();
			
			// Save transaction to database
			try {
				await api.post("/api/marketplace/transactions", {
					txHash: receipt.hash,
					type: "createListing",
					walletAddress: account,
					coinId: coin.id,
					coinName: coin.name,
					coinSymbol: coin.symbol,
					amount: amountWei.toString(),
					pricePerUnit: priceWei.toString(),
					totalValue: (amountWei * priceWei / ethers.parseUnits("1", 18)).toString(),
				});
				
				// Deduct coin from portfolio
				await api.post("/api/portfolio/remove", {
					coinId: coin.id,
					coinSymbol: coin.symbol,
					amount: parseFloat(amount),
				});
			} catch (dbError) {
				console.warn("Failed to save transaction:", dbError);
				toast.warning("⚠️ Giao dịch thành công nhưng chưa lưu vào database");
			}

			toast.success(`✅ Đã đăng bán ${amount} ${coin.symbol.toUpperCase()}!`);
			onSuccess && onSuccess();
			onClose();
		} catch (error) {
			console.error("Sell error:", error);
			
			// Handle specific blockchain errors
			const errorMsg = error.message || "";
			if (errorMsg.includes("insufficient funds")) {
				toast.error("❌ Ví không đủ ETH để trả phí gas! Vui lòng nạp thêm ETH.");
			} else if (errorMsg.includes("user rejected") || errorMsg.includes("User denied")) {
				toast.warning("⚠️ Bạn đã từ chối giao dịch");
			} else if (errorMsg.includes("MetaMask not installed")) {
				toast.error("❌ Vui lòng cài đặt MetaMask extension");
			} else {
				toast.error(error.message || "Không thể đăng bán");
			}
		} finally {
			setLoading(false);
		}
	};

	const suggestedPrice = (currentPrice * 1.05).toFixed(6); // 5% markup

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						Đăng bán {coin.symbol.toUpperCase()}
					</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
					>
						×
					</button>
				</div>

				<div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
					<div className="flex items-center gap-3 mb-2">
						{coin.image && (
							<img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
						)}
						<div>
							<p className="font-semibold text-gray-900 dark:text-white">{coin.name}</p>
							<p className="text-sm text-gray-600 dark:text-gray-400">
								Sở hữu: {maxAmount.toFixed(6)} {coin.symbol.toUpperCase()}
							</p>
						</div>
					</div>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Giá hiện tại: ${currentPrice.toFixed(6)}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Số lượng muốn bán
						</label>
						<div className="relative">
							<input
								type="number"
								step="any"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
								required
							/>
							<button
								type="button"
								onClick={() => setAmount(maxAmount.toString())}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded"
							>
								MAX
							</button>
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Giá bán mỗi đơn vị (USD)
						</label>
						<div className="relative">
							<input
								type="number"
								step="any"
								value={pricePerUnit}
								onChange={(e) => setPricePerUnit(e.target.value)}
								placeholder={suggestedPrice}
								className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
								required
							/>
							<button
								type="button"
								onClick={() => setPricePerUnit(suggestedPrice)}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 px-2 py-1 rounded"
								title="Giá đề xuất +5%"
							>
								+5%
							</button>
						</div>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
							Đề xuất: ${suggestedPrice} (+5% so với giá sàn)
						</p>
					</div>

					{amount && pricePerUnit && (
						<div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<p className="text-sm text-gray-600 dark:text-gray-400">
								Tổng giá trị:
							</p>
							<p className="text-xl font-bold text-gray-900 dark:text-white">
								${(parseFloat(amount) * parseFloat(pricePerUnit)).toFixed(2)}
							</p>
						</div>
					)}

					<div className="flex gap-3 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
						>
							Hủy
						</button>
						{!isConnected ? (
							<button
								type="button"
								onClick={connect}
								className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
							>
								Kết nối ví
							</button>
						) : (
							<button
								type="submit"
								disabled={loading}
								className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{loading ? "Đang xử lý..." : "Đăng bán"}
							</button>
						)}
					</div>
				</form>
			</div>
		</div>
	);
}
