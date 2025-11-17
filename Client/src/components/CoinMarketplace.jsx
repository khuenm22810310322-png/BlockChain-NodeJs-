import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import api from "../services/api";
import { useCurrency } from "../context/CurrencyContext";

export default function CoinMarketplace({ coin, onClose, onBuySuccess, onPortfolioUpdate }) {
	const { isConnected, connect } = useWallet();
	const { isAuthenticated } = useAuth();
	const { formatCurrency, currency } = useCurrency();
	const [listings, setListings] = useState([]);
	const [loading, setLoading] = useState(true);
	const [buyMode, setBuyMode] = useState("market"); // 'market' or 'listing'
	const [selectedListing, setSelectedListing] = useState(null);
	const [amount, setAmount] = useState("");
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		fetchListings();
		setAmount("");
		setSelectedListing(null);
		setBuyMode("market");
		
		// Set up polling for real-time updates (every 10 seconds)
		const intervalId = setInterval(() => {
			fetchListings();
		}, 10000);
		
		return () => clearInterval(intervalId);
	}, [coin.id]);

	const fetchListings = async () => {
		try {
			setLoading(true);
			// Fetch listings for this specific coin
			const response = await api.get(`/api/marketplace/listings?coinId=${coin.id}`);
			setListings(response.data.active || []);
		} catch (error) {
			console.error("Failed to fetch listings:", error);
			toast.error("Không thể tải danh sách listing");
		} finally {
			setLoading(false);
		}
	};

	const handleBuyMarket = async () => {
		if (!isAuthenticated) {
			toast.error("Vui lòng đăng nhập trước");
			return;
		}

		if (!isConnected) {
			toast.error("Vui lòng kết nối ví trước");
			return;
		}

		const numericAmount = parseFloat(amount);
		if (Number.isNaN(numericAmount) || numericAmount <= 0) {
			toast.error("Số lượng phải lớn hơn 0");
			return;
		}

		try {
			setProcessing(true);
			
			// Buy at market price (oracle)
			const response = await api.post("/api/marketplace/buy-market", {
				coinId: coin.id,
				coinName: coin.name,
				coinSymbol: coin.symbol,
				amount: numericAmount,
				pricePerUnit: marketPrice,
			});

			const totalInvestment = numericAmount * marketPrice;

			toast.success(`Đã mua ${amount} ${(coin.symbol?.toUpperCase() || coin.id.toUpperCase())} theo giá sàn!`);
			onPortfolioUpdate &&
				onPortfolioUpdate({
					coin,
					totalInvestmentUSD: totalInvestment,
					amount: numericAmount,
					pricePerUnitUSD: marketPrice,
					source: "market",
				});
			onBuySuccess && onBuySuccess();
			onClose();
			setAmount("");
		} catch (error) {
			console.error("Buy market error:", error);
			console.error("Error response:", error.response?.data);
			
			const errorMsg = error.response?.data?.error || error.message || "";
			if (errorMsg.includes("wallet address not found") || errorMsg.includes("User wallet address not found")) {
				toast.error("❌ Vui lòng kết nối ví MetaMask trước khi mua!");
			} else if (errorMsg.includes("Unauthorized") || error.response?.status === 401) {
				toast.error("❌ Vui lòng đăng nhập để mua coin!");
			} else if (errorMsg.includes("insufficient funds") || errorMsg.includes("Sender doesn't have enough funds")) {
				toast.error("❌ Ví không đủ ETH để trả phí gas! Vui lòng nạp thêm ETH vào ví.");
			} else if (errorMsg.includes("user rejected") || errorMsg.includes("User denied")) {
				toast.warning("⚠️ Bạn đã từ chối giao dịch");
			} else {
				toast.error(error.response?.data?.error || errorMsg || "Không thể mua");
			}
		} finally {
			setProcessing(false);
		}
	};

	const handleBuyListing = async (listing) => {
		if (!isAuthenticated) {
			toast.error("Vui lòng đăng nhập trước");
			return;
		}

		if (!isConnected) {
			toast.error("Vui lòng kết nối ví trước");
			return;
		}

		const numericAmount = parseFloat(amount);
		if (Number.isNaN(numericAmount) || numericAmount <= 0) {
			toast.error("Số lượng phải lớn hơn 0");
			return;
		}

		if (numericAmount > parseFloat(listing.remainingAmount)) {
			toast.error(`Chỉ còn ${listing.remainingAmount} khả dụng`);
			return;
		}

		try {
			setProcessing(true);
			
			const response = await api.post("/api/marketplace/buy", {
				listingId: listing.id,
				amount: numericAmount,
				useOracle: false,
				coinId: coin.id,
				coinName: coin.name,
				coinSymbol: coin.symbol,
			});

			const listingPrice = parseFloat(listing.pricePerUnit) || 0;
			const totalInvestment = numericAmount * listingPrice;

			toast.success(`Đã mua ${amount} ${(coin.symbol?.toUpperCase() || coin.id.toUpperCase())} từ listing!`);
			onPortfolioUpdate &&
				onPortfolioUpdate({
					coin,
					totalInvestmentUSD: totalInvestment,
					amount: numericAmount,
					pricePerUnitUSD: listingPrice,
					source: "listing",
				});
			onBuySuccess && onBuySuccess();
			fetchListings(); // Refresh listings
			setAmount("");
		} catch (error) {
			console.error("Buy listing error:", error);
			console.error("Error response:", error.response?.data);
			
			const errorMsg = error.response?.data?.error || error.message || "";
			if (errorMsg.includes("wallet address not found") || errorMsg.includes("User wallet address not found")) {
				toast.error("❌ Vui lòng kết nối ví MetaMask trước khi mua!");
			} else if (errorMsg.includes("Unauthorized") || error.response?.status === 401) {
				toast.error("❌ Vui lòng đăng nhập để mua coin!");
			} else if (errorMsg.includes("insufficient funds") || errorMsg.includes("Sender doesn't have enough funds")) {
				toast.error("❌ Ví không đủ ETH để trả phí gas! Vui lòng nạp thêm ETH vào ví.");
			} else if (errorMsg.includes("user rejected") || errorMsg.includes("User denied")) {
				toast.warning("⚠️ Bạn đã từ chối giao dịch");
			} else {
				toast.error(error.response?.data?.error || errorMsg || "Không thể mua");
			}
		} finally {
			setProcessing(false);
		}
	};

	const marketPrice = coin.current_price || 0;
	const conversionRate = currency?.[1] ?? 1;
	const displayedMarketPrice = marketPrice * conversionRate;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
				<div className="flex justify-between items-center mb-6">
					<div className="flex items-center gap-3">
						{coin.image && (
							<img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
						)}
						<div>
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
								Mua {coin.name}
							</h2>
							<p className="text-sm text-gray-600 dark:text-gray-400">
								Giá sàn: {formatCurrency(displayedMarketPrice)}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl"
					>
						×
					</button>
				</div>

				{/* Buy Mode Tabs */}
				<div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
					<button
						onClick={() => setBuyMode("market")}
						className={`px-4 py-2 font-semibold transition-all ${
							buyMode === "market"
								? "text-blue-600 border-b-2 border-blue-600"
								: "text-gray-500 dark:text-gray-400"
						}`}
					>
						Mua theo giá sàn
					</button>
					<button
						onClick={() => setBuyMode("listing")}
						className={`px-4 py-2 font-semibold transition-all ${
							buyMode === "listing"
								? "text-blue-600 border-b-2 border-blue-600"
								: "text-gray-500 dark:text-gray-400"
						}`}
					>
						Mua từ Listings ({listings.length})
					</button>
				</div>

				{/* Market Buy */}
				{buyMode === "market" && (
					<div className="space-y-4">
						<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
							<p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
								💡 Mua trực tiếp theo giá Oracle (Chainlink) - Giá thị trường chính xác nhất
							</p>
							<p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
								{formatCurrency(displayedMarketPrice)} / {coin.symbol.toUpperCase()}
							</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Số lượng muốn mua
							</label>
							<input
								type="number"
								step="any"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
							/>
							{amount && (
								<p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
									Tổng: {formatCurrency(parseFloat(amount) * marketPrice * conversionRate)}
								</p>
							)}
						</div>

						{!isConnected ? (
							<button
								onClick={connect}
								className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
							>
								Kết nối ví
							</button>
						) : (
							<button
								onClick={handleBuyMarket}
								disabled={processing || !amount}
								className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{processing ? "Đang xử lý..." : "Mua ngay"}
							</button>
						)}
					</div>
				)}

				{/* Listing Buy */}
				{buyMode === "listing" && (
					<div className="space-y-4">
						{loading ? (
							<div className="text-center py-8 text-gray-500">Đang tải...</div>
						) : listings.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-gray-500 dark:text-gray-400">
									Chưa có listing nào cho {coin.symbol.toUpperCase()}
								</p>
								<p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
									Thử mua theo giá sàn thay vào đó
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{listings.map((listing) => {
									const listingPrice = parseFloat(listing.pricePerUnit) || 0;
									const priceDiff = ((listingPrice - marketPrice) / marketPrice) * 100;
									
									return (
										<div
											key={listing.id}
											className={`border rounded-lg p-4 cursor-pointer transition-all ${
												selectedListing?.id === listing.id
													? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
													: "border-gray-200 dark:border-gray-700 hover:border-blue-300"
											}`}
											onClick={() => setSelectedListing(listing)}
										>
											<div className="flex justify-between items-start mb-2">
												<div>
													<p className="font-semibold text-gray-900 dark:text-white">
														Listing #{listing.id}
													</p>
													<p className="text-xs text-gray-500 dark:text-gray-400 break-all">
														Seller: {listing.seller.slice(0, 10)}...
													</p>
												</div>
												<div className="text-right">
													<p className="text-lg font-bold text-gray-900 dark:text-white">
														{formatCurrency(listingPrice * conversionRate)}
													</p>
													<p
														className={`text-xs font-semibold ${
															priceDiff > 0
																? "text-red-600"
																: "text-green-600"
														}`}
													>
														{priceDiff > 0 ? "+" : ""}
														{priceDiff.toFixed(2)}% vs sàn
													</p>
												</div>
											</div>
											<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
												<span>Còn lại: {listing.remainingAmount?.toString?.() ?? listing.remainingAmount}</span>
												<span>
													Tổng: {formatCurrency(listingPrice * (parseFloat(listing.remainingAmount || 0) || 0) * conversionRate)}
												</span>
											</div>
										</div>
									);
								})}

								{selectedListing && (
									<div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Số lượng muốn mua
										</label>
										<input
											type="number"
											step="any"
											value={amount}
											onChange={(e) => setAmount(e.target.value)}
											placeholder="0.00"
											max={selectedListing.remainingAmount}
											className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
										/>
										{amount && (
											<p className="text-sm text-gray-600 dark:text-gray-400">
												Tổng: {formatCurrency(parseFloat(amount) * parseFloat(selectedListing.pricePerUnit) * conversionRate)}
											</p>
										)}

										{!isConnected ? (
											<button
												onClick={connect}
												className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
											>
												Kết nối ví
											</button>
										) : (
											<button
												onClick={() => handleBuyListing(selectedListing)}
												disabled={processing || !amount}
												className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
											>
												{processing ? "Đang xử lý..." : "Mua từ listing"}
											</button>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
