import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import api from "../services/api";
import { useCurrency } from "../context/CurrencyContext";
import { getExplorerUrl } from "../utils/explorer";
import FiatPurchase from "./FiatPurchase";

export default function CoinMarketplace({ coin, onClose, onBuySuccess, onPortfolioUpdate }) {
	const { isConnected, connect, account } = useWallet();
	const { isAuthenticated, user, fetchProfile } = useAuth();
	const { formatCurrency, currency } = useCurrency();
	const [listings, setListings] = useState([]);
	const [loading, setLoading] = useState(true);
	const [buyMode, setBuyMode] = useState("market"); // market, listing
	const [showFiat, setShowFiat] = useState(false);
	const [selectedListing, setSelectedListing] = useState(null);
	const [amount, setAmount] = useState("");
	const [processing, setProcessing] = useState(false);
    const [lastTxHash, setLastTxHash] = useState(null);

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
			console.log("Fetched listings raw:", response.data);
			const active = response.data.active || [];
			// Normalize BigInt-like fields (wei -> token units)
			const normalized = active.map((lst) => {
				// Ensure pricePerUnitNumber is a valid number
				let pricePerUnitNumber = 0;
				if (lst.pricePerUnitHuman !== undefined && lst.pricePerUnitHuman !== null) {
					pricePerUnitNumber = Number(lst.pricePerUnitHuman);
				} else if (lst.pricePerUnit) {
					// Fallback to manual conversion if human field missing
					pricePerUnitNumber = Number(lst.pricePerUnit) / 1e18;
				}
				
				const remainingNumber =
					lst.remainingHuman ??
					((lst.remainingAmount ? Number(lst.remainingAmount) : 0) / 1e18);
				return {
					...lst,
					pricePerUnitNumber,
					remainingNumber,
				};
			});
			setListings(normalized);
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

		const numericAmount = parseFloat(amount);
		if (Number.isNaN(numericAmount) || numericAmount <= 0) {
			toast.error("Số lượng phải lớn hơn 0");
			return;
		}

		try {
			setProcessing(true);

			// Require wallet connection
			if (!isConnected) {
				await connect();
			}

			if (!account) {
				toast.error("Vui lòng kết nối ví trước");
				setProcessing(false);
				return;
			}

			// Get contract config and token addresses
			const [configRes, tokensRes] = await Promise.all([
				api.get("/api/marketplace/config"),
				api.get("/api/marketplace/tokens"),
			]);

			const { abi: marketplaceAbi } = configRes.data;
			const mockTokens = tokensRes.data || {};

			const tokenAddress = mockTokens[coin.id];
			if (!tokenAddress) {
				throw new Error(`Token address not found for ${coin.id}`);
			}

			// MetaMask signer
			const { ethers } = await import("ethers");
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const userAddress = await signer.getAddress();

			console.log("--- BUY MARKET DEBUG ---");
			console.log("User Address:", userAddress);
			console.log("Token Address:", tokenAddress);

			// Verify contract exists
			const code = await provider.getCode(tokenAddress);
			if (!code || code === "0x") {
				throw new Error(`Token contract not found at ${tokenAddress}. Vui lòng kiểm tra lại server hoặc redeploy.`);
			}

			// ERC20 faucet call
			const erc20Abi = [
				"function faucet(uint256 amount) external",
				"function balanceOf(address owner) external view returns (uint256)",
				"function symbol() view returns (string)"
			];
			const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
			
			try {
				const sym = await tokenContract.symbol();
				const bal = await tokenContract.balanceOf(userAddress);
				console.log(`Token: ${sym}, Balance Before: ${ethers.formatUnits(bal, 18)}`);
			} catch (e) {
				console.log("Could not get token info before buy:", e);
			}

			const amountWei = ethers.parseUnits(numericAmount.toString(), 18);

			toast.info("⛽ Đang xác nhận trên MetaMask...");
			const tx = await tokenContract.faucet(amountWei);
			console.log("Transaction sent:", tx.hash);
			
			const receipt = await tx.wait();
			console.log("Transaction confirmed:", receipt.hash);

			try {
				const balAfter = await tokenContract.balanceOf(userAddress);
				console.log(`Balance After: ${ethers.formatUnits(balAfter, 18)}`);
			} catch (e) {
				console.log("Could not get token info after buy:", e);
			}

			const marketPrice = Number(coin.current_price) || 0;

			// Log transaction to backend for history
			try {
				await api.post("/api/marketplace/transactions", {
					txHash: receipt.hash,
					type: "buyFromExchange",
					walletAddress: account,
					coinId: coin.id,
					coinName: coin.name,
					coinSymbol: coin.symbol,
					amount: amountWei.toString(),
					pricePerUnit: marketPrice.toString(),
					totalValue: (numericAmount * marketPrice).toString(),
				});
			} catch (logErr) {
				console.warn("Could not log transaction:", logErr);
				toast.warning("⚠️ Giao dịch on-chain thành công nhưng chưa lưu lịch sử.");
			}

			const totalInvestment = numericAmount * marketPrice;

			toast.success(`Đã mua ${amount} ${(coin.symbol?.toUpperCase() || coin.id.toUpperCase())} với MetaMask!`);
			if (onPortfolioUpdate) {
				await onPortfolioUpdate({
					coin,
					totalInvestmentUSD: totalInvestment,
					amount: numericAmount,
					pricePerUnitUSD: marketPrice,
					source: "market",
					skipMint: true,
				});
			}
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
			
			// Require wallet connection
			if (!isConnected) {
				await connect();
			}
			if (!account) {
				toast.error("Vui lòng kết nối ví trước");
				setProcessing(false);
				return;
			}

			// Load config + tokens
			const [configRes, tokensRes] = await Promise.all([
				api.get("/api/marketplace/config"),
				api.get("/api/marketplace/tokens"),
			]);
			const { address: marketplaceAddress, abi } = configRes.data;
			const mockTokens = tokensRes.data || {};

			const tokenAddress = mockTokens[coin.id];
			if (!tokenAddress) {
				throw new Error(`Token address not found for ${coin.id}`);
			}

			// MetaMask signer
			const { ethers } = await import("ethers");
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const signerAddress = await signer.getAddress();

			// Verify wallet matches logged in account
			if (account && signerAddress.toLowerCase() !== account.toLowerCase()) {
				toast.error(`❌ Ví MetaMask không khớp! Vui lòng chuyển sang ví ${account.slice(0, 6)}...${account.slice(-4)}`);
				setProcessing(false);
				return;
			}

			// Load fresh listing data on-chain to avoid stale/float issues
			const marketplaceContract = new ethers.Contract(marketplaceAddress, abi, signer);
			const onchain = await marketplaceContract.getListing(listing.id);
			const remainingOnchain = onchain.remainingAmount ? BigInt(onchain.remainingAmount.toString()) : 0n;
			const pricePerUnitWei = onchain.pricePerUnit ? BigInt(onchain.pricePerUnit.toString()) : 0n;

			// Convert to wei
			const amountWei = ethers.parseUnits(numericAmount.toString(), 18);

			if (amountWei > remainingOnchain) {
				toast.error("Số lượng vượt quá còn lại trong listing");
				setProcessing(false);
				return;
			}

			// Contract computes total = (pricePerUnit * amount) / 1e18
			const totalWei = (pricePerUnitWei * amountWei) / ethers.parseUnits("1", 18);

			const isNativePayment =
				!onchain.paymentToken ||
				onchain.paymentToken.toLowerCase() === ethers.ZeroAddress.toLowerCase();

			toast.info("⏳ Đang mua từ listing... Vui lòng xác nhận trên MetaMask");
			// Check native balance if paying in ETH
			if (isNativePayment) {
				const signerAddress = await signer.getAddress();
				const nativeBal = await provider.getBalance(signerAddress);
				if (nativeBal < totalWei) {
					toast.error("❌ Ví không đủ ETH để thanh toán listing");
					setProcessing(false);
					return;
				}
			}

			const tx = await marketplaceContract.buy(
				listing.id,
				amountWei,
				isNativePayment ? { value: totalWei } : {}
			);
			const receipt = await tx.wait();

			// Log transaction
			try {
				await api.post("/api/marketplace/transactions", {
					txHash: receipt.hash,
					type: "buy",
					walletAddress: account,
					listingId: listing.id,
					coinId: coin.id,
					coinName: coin.name,
					coinSymbol: coin.symbol,
					amount: amountWei.toString(),
					pricePerUnit: pricePerUnitWei.toString(),
					totalValue: totalWei.toString(),
				});
			} catch (logErr) {
				console.warn("Could not log transaction:", logErr);
				toast.warning("⚠️ Giao dịch on-chain thành công nhưng chưa lưu lịch sử.");
			}

			const listingPriceDisplay =
				(listing.pricePerUnitNumber ?? parseFloat(listing.pricePerUnit)) || Number(pricePerUnitWei) / 1e18;
			const totalInvestment = numericAmount * listingPriceDisplay;

			toast.success(`Đã mua ${amount} ${(coin.symbol?.toUpperCase() || coin.id.toUpperCase())} từ listing!`);
			if (onPortfolioUpdate) {
				await onPortfolioUpdate({
					coin,
					totalInvestmentUSD: totalInvestment,
					amount: numericAmount,
					pricePerUnitUSD: listingPriceDisplay,
					source: "listing",
					skipMint: true,
				});
			}
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

	const handleBuyListingWithBalance = async (listing) => {
		if (!isAuthenticated) {
			toast.error("Vui lòng đăng nhập trước");
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

        // Calculate Cost
        const listingPrice = Number((listing.pricePerUnitNumber ?? listing.pricePerUnitHuman ?? parseFloat(listing.pricePerUnit)) || 0);
        const totalCost = numericAmount * listingPrice;
        
        if ((user?.fiatBalance || 0) < totalCost) {
            toast.error(`Số dư không đủ! Cần $${totalCost.toFixed(2)}, có $${(user?.fiatBalance || 0).toFixed(2)}`);
            return;
        }

		try {
			setProcessing(true);

            // Require wallet connection for receiving tokens
            if (!isConnected) {
                await connect();
            }
            if (!account) {
                toast.error("Vui lòng kết nối ví MetaMask để nhận Token!");
                setProcessing(false);
                return;
            }

            // Verify wallet matches logged in account (if user has a linked wallet)
            if (user.walletAddress && account.toLowerCase() !== user.walletAddress.toLowerCase()) {
                toast.error(`❌ Ví MetaMask không khớp! Vui lòng chuyển sang ví ${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`);
                setProcessing(false);
                return;
            }

            // MetaMask Signature for Confirmation
            const { ethers } = await import("ethers");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            const message = `Xác nhận mua ${amount} ${coin.symbol} từ Listing #${listing.id}\nTổng tiền: $${totalCost.toFixed(2)}\nVí nhận Token: ${account}`;
            
            try {
                await signer.signMessage(message);
            } catch (signErr) {
                toast.warning("Bạn đã hủy xác nhận trên MetaMask");
                setProcessing(false);
                return;
            }

            const res = await api.post("/api/payment/buy-with-balance", {
                coinId: coin.id,
                walletAddress: account || user.walletAddress || "internal",
                amountToken: amount,
                listingId: listing.id,
                totalCost: totalCost.toFixed(2)
            });

            if (res.data.success) {
                setLastTxHash(res.data.txHash);
                const explorerUrl = getExplorerUrl(res.data.txHash);
                toast.success(
                    <div>
                        <p>✅ Đã mua {amount} {coin.symbol} thành công!</p>
                        <p className="text-xs mt-1">Tx Hash: {res.data.txHash.slice(0, 10)}...{res.data.txHash.slice(-8)}</p>
                        {explorerUrl ? (
                            <a 
                                href={explorerUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs underline text-yellow-300 hover:text-yellow-100"
                            >
                                Xem trên Explorer ↗
                            </a>
                        ) : (
                            <p className="text-xs text-gray-300 mt-1 italic">(Local Network)</p>
                        )}
                    </div>,
                    { autoClose: 10000 }
                );
                fetchProfile(); // Update balance
                fetchListings(); // Refresh listings
                setAmount("");
                onBuySuccess && onBuySuccess();
                
                if (onPortfolioUpdate) {
                    await onPortfolioUpdate({
                        coin,
                        totalInvestmentUSD: totalCost,
                        amount: numericAmount,
                        pricePerUnitUSD: listingPrice,
                        source: "listing-balance",
                        skipMint: true,
                    });
                }
            }
		} catch (error) {
			console.error("Buy with balance error:", error);
			toast.error(error.response?.data?.error || "Giao dịch thất bại");
            fetchProfile(); // Refresh balance in case of refund
		} finally {
			setProcessing(false);
		}
	};

	const marketPrice = Number(coin.current_price) || 0;
	// Fallback to best listing price if market price is 0
	const bestListingPrice = listings.length > 0 
		? Math.min(...listings.map(l => l.pricePerUnitNumber || Infinity)) 
		: Infinity;
	const effectivePrice = marketPrice > 0 ? marketPrice : (bestListingPrice !== Infinity ? bestListingPrice : 0);
	
	// Debug log
	console.log("Price Debug:", { marketPrice, bestListingPrice, effectivePrice, listingsCount: listings.length });

	const conversionRate = currency?.[1] ?? 1;
	const displayedMarketPrice = effectivePrice * conversionRate;

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
						<div className="flex justify-end">
							<button 
								onClick={() => setShowFiat(!showFiat)}
								className="text-sm text-blue-600 hover:underline dark:text-blue-400 mb-2"
							>
								{showFiat ? "⬅ Quay lại mua bằng Crypto" : "💳 Mua bằng Fiat (PayPal/QR)"}
							</button>
						</div>

						{showFiat ? (
							<FiatPurchase 
								coin={coin} 
								marketPrice={effectivePrice} 
								walletAddress={account}
								listing={null}
								onSuccess={async (data) => {
									fetchListings();
									if (onPortfolioUpdate && data.amount) {
										await onPortfolioUpdate({
											coin,
											totalInvestmentUSD: data.amount * effectivePrice,
											amount: data.amount,
											pricePerUnitUSD: effectivePrice,
											source: "fiat",
											skipMint: true,
										});
									}
								}}
								onClose={onClose}
							/>
						) : (
							<>
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
							</>
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
								const listingPrice =
									Number((listing.pricePerUnitNumber ?? listing.pricePerUnitHuman ?? parseFloat(listing.pricePerUnit)) || 0);
								const remaining =
									Number((listing.remainingNumber ?? parseFloat(listing.remainingAmount || 0)) || 0);
								const priceDiff =
									marketPrice > 0 ? ((listingPrice - marketPrice) / marketPrice) * 100 : null;
								
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
													<p className="text-xs text-gray-500 dark:text-gray-400">
														Số dư: {listing.sellerBalance ? parseFloat(listing.sellerBalance).toFixed(4) : "0"} ETH
													</p>
												</div>
												<div className="text-right">
													<p className="text-lg font-bold text-gray-900 dark:text-white">
														{formatCurrency(listingPrice * conversionRate)}
													</p>
													{priceDiff !== null && (
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
													)}
												</div>
											</div>
											<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
												<span>Còn lại: {remaining.toLocaleString()}</span>
												<span>
													Tổng: {formatCurrency(listingPrice * remaining * conversionRate)}
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
										max={selectedListing.remainingNumber ?? selectedListing.remainingAmount}
										className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
									/>
									{amount && (
										<p className="text-sm text-gray-600 dark:text-gray-400">
											Tổng: {formatCurrency(
												parseFloat(amount) *
													((selectedListing.pricePerUnitNumber ?? parseFloat(selectedListing.pricePerUnit)) || 0) *
													conversionRate
											)}
										</p>
									)}

										{(!isConnected) ? (
											<button
												onClick={connect}
												className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
											>
												Kết nối ví để nhận Token
											</button>
										) : (
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => handleBuyListing(selectedListing)}
                                                    disabled={processing || !amount}
                                                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processing ? "Đang xử lý giao dịch..." : "Mua ngay bằng ví MetaMask"}
                                                </button>
                                                
                                                {lastTxHash && (
                                                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                        <p className="text-sm text-green-800 dark:text-green-200 font-semibold flex items-center gap-2">
                                                            ✅ Giao dịch Blockchain thành công!
                                                        </p>
                                                        {getExplorerUrl(lastTxHash) ? (
                                                            <a 
                                                                href={getExplorerUrl(lastTxHash)}
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-blue-600 dark:text-blue-400 underline break-all mt-1 block hover:text-blue-800"
                                                            >
                                                                Xem chi tiết (Etherscan): {lastTxHash}
                                                            </a>
                                                        ) : (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-all">
                                                                Tx Hash: {lastTxHash} <span className="italic">(Local Network)</span>
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            *Token đã được chuyển vào ví MetaMask của bạn. Kiểm tra tab "Activity" hoặc "Tokens".
                                                        </p>
                                                    </div>
                                                )}
                                                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                                                    Token sẽ được chuyển về ví MetaMask: {account.slice(0, 6)}...{account.slice(-4)}
                                                </p>
                                            </div>
										)}
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* Fiat Purchase */}
				<div className="mt-6">
					<button
						onClick={() => setShowFiat((prev) => !prev)}
						className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold flex items-center justify-between"
					>
						<span>Mua bằng Fiat (VNĐ, USD)</span>
						{showFiat ? (
							<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
							</svg>
						) : (
							<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 9l-4 4-4-4m0 6l4-4 4 4" />
							</svg>
						)}
					</button>

					{showFiat && (
						<div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-md">
							<FiatPurchase 
								coin={coin} 
								marketPrice={effectivePrice}
								walletAddress={account}
								listing={buyMode === "listing" ? selectedListing : null}
								onClose={() => setShowFiat(false)} 
								onSuccess={onBuySuccess} 
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
