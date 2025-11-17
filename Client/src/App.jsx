import React, { useState, useEffect } from "react";
import {
	Routes,
	Route,
	useLocation,
	Navigate,
	useNavigate,
} from "react-router-dom";
import Header from "./components/Header";
import Menu from "./components/Menu";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Watchlist from "./pages/Watchlist";
import Compare from "./pages/Compare";
import AdminFeeds from "./pages/AdminFeeds";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import TransactionHistory from "./pages/TransactionHistory";
import { AnimatePresence } from "motion/react";
import { useAuth } from "./context/AuthContext";
import { portfolioAPI, watchlistAPI } from "./services/api";
import api from "./services/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
	const [menu, setMenu] = useState(false);
	const { isAuthenticated, loading, logout } = useAuth();
	const [watchlist, setWatchlist] = useState([]);
	const [form, setForm] = useState(false);
	const [coinData, setCoinData] = useState({});
	const [portfolio, setPortfolio] = useState({});
	const [account, setAccount] = useState(null);
	const navigate = useNavigate();
	
	// Connect MetaMask wallet
	useEffect(() => {
		const connectWallet = async () => {
			if (window.ethereum) {
				try {
					const accounts = await window.ethereum.request({ method: 'eth_accounts' });
					if (accounts.length > 0) {
						setAccount(accounts[0]);
					}
					
					// Listen for account changes
					window.ethereum.on('accountsChanged', (accounts) => {
						setAccount(accounts[0] || null);
					});
				} catch (error) {
					console.error("Failed to connect wallet:", error);
				}
			}
		};
		connectWallet();
	}, []);

	const handleLogout = () => {
		setWatchlist([]);
		setPortfolio({});
		logout();
		toast.success("Logged out successfully", {
			position: "top-right",
			autoClose: 3000,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: false,
			draggable: true,
		});
		navigate("/");
	};

	useEffect(() => {
		if (isAuthenticated) {
			loadUserData();
		} else {
			setWatchlist([]);
			setPortfolio({});
		}
	}, [isAuthenticated]);

	const loadUserData = async () => {
		try {
			const [portfolioData, watchlistData] = await Promise.all([
				portfolioAPI.get(),
				watchlistAPI.get(),
			]);
			setPortfolio(portfolioData);
			setWatchlist(watchlistData.watchlist);
		} catch (error) {
			if (error?.response?.status === 401) {
				// Token invalid/expired -> log out to stop repeated 401 spam
				handleLogout();
			} else {
				console.error("Failed to load user data:", error);
			}
		}
	};

	function toggleForm(coin = null, open = false) {
		setCoinData(coin || {});
		setForm(Boolean(open));
	}

	async function addCoin(idOrPayload, totalInvestment, coins) {
		try {
			console.log("=== ADD COIN START ===");
			
			// Support both calling conventions:
			// 1. addCoin(id, totalInvestment, coins) - from Form
			// 2. addCoin({coin, totalInvestmentUSD, amount, ...}) - from CoinMarketplace
			let id, finalTotalInvestment, finalCoins, skipMint = false;
			
			if (typeof idOrPayload === 'object' && idOrPayload.coin) {
				// New format from CoinMarketplace
				const payload = idOrPayload;
				id = payload.coin.id;
				finalTotalInvestment = payload.totalInvestmentUSD;
				finalCoins = payload.amount;
				skipMint = payload.skipMint || false;
				console.log("📦 Payload format (from marketplace)");
			} else {
				// Old format from Form
				id = idOrPayload;
				finalTotalInvestment = totalInvestment;
				finalCoins = coins;
				console.log("📝 Parameters format (from form)");
			}
			
			console.log("Coin ID:", id);
			console.log("Total Investment:", finalTotalInvestment);
			console.log("Coins Amount:", finalCoins);
			console.log("Skip Mint:", skipMint);
			console.log("Current coinData state:", coinData);
			console.log("MetaMask account:", account);
			
			const portfolioData = {
				totalInvestment: parseFloat(finalTotalInvestment),
				coins: parseFloat(finalCoins),
			};
			
			// Update portfolio in database
			console.log("Updating portfolio with:", portfolioData);
			const updatedPortfolio = await portfolioAPI.update(id, portfolioData);
			console.log("✅ Portfolio updated:", updatedPortfolio);
			setPortfolio(updatedPortfolio);
			
			// Show success message for portfolio update
			toast.success(`✅ Portfolio updated: ${finalCoins} ${id.toUpperCase()} added!`, {
				position: "top-right",
				autoClose: 3000,
			});
			
			// Skip minting if requested (marketplace already handles it)
			if (skipMint) {
				console.log("⏭️ Skipping mint (already handled by marketplace)");
				toggleForm(null, false);
				console.log("=== ADD COIN END ===");
				return;
			}
			
			// If user has connected wallet, mint mock tokens and record transaction
			console.log("Checking MetaMask...");
			console.log("  window.ethereum:", !!window.ethereum);
			console.log("  account:", account);
			
			if (window.ethereum && account) {
				try {
					console.log("🪙 Starting token purchase...");
					toast.info("🪙 Đang mua tokens từ sàn...");
					
					// coinData state contains the current coin info from form
					const coinInfo = coinData && coinData.id === id ? coinData : null;
					console.log("Coin info extracted:", coinInfo);
					
					// Fetch current coin price if not available
					let currentPrice = coinInfo?.current_price || 0;
					if (!currentPrice && coinInfo?.market_data?.current_price?.usd) {
						currentPrice = coinInfo.market_data.current_price.usd;
					}
					console.log("Current price:", currentPrice);
					
					const buyRequest = {
						coinId: id,
						coinSymbol: coinInfo?.symbol || id.toUpperCase(),
						coinName: coinInfo?.name || id,
						amount: finalCoins,
						walletAddress: account,
						priceUSD: currentPrice,
					};
					console.log("Sending buy-from-exchange request:", buyRequest);
					
					const response = await api.post("/api/marketplace/buy-from-exchange", buyRequest);
					
					console.log("✅ Tokens purchased successfully:", response.data);
					toast.success(`✅ Đã mua ${finalCoins} ${coinInfo?.symbol || id.toUpperCase()} tokens!`, {
						position: "top-right",
						autoClose: 5000,
					});
					
					// Reload portfolio to ensure UI is in sync
					console.log("Reloading portfolio...");
					const refreshedPortfolio = await portfolioAPI.get();
					setPortfolio(refreshedPortfolio);
					console.log("✅ Portfolio refreshed:", refreshedPortfolio);
					
				} catch (mintError) {
					console.error("❌ Failed to mint tokens:", mintError);
					console.error("Error details:", mintError.response?.data);
					toast.warning("⚠️ Portfolio đã cập nhật nhưng chưa mint tokens. Lỗi: " + (mintError.response?.data?.error || mintError.message));
				}
			} else {
				console.log("⚠️ MetaMask not connected");
				toast.info("💡 Connect MetaMask để nhận tokens blockchain!", {
					position: "top-right",
					autoClose: 5000,
				});
			}
			
			toggleForm(null, false);
			console.log("=== ADD COIN END ===");
		} catch (error) {
			console.error("❌ Failed to add coin:", error);
			toast.error("Failed to update portfolio");
		}
	}

	async function removeCoin(id, totalInvestment, coins) {
		try {
			const coinData = {
				totalInvestment: -parseFloat(totalInvestment),
				coins: -parseFloat(coins),
			};
			const updatedPortfolio = await portfolioAPI.update(id, coinData);
			setPortfolio(updatedPortfolio);
			toggleForm(null, false);
			toast.success("Portfolio updated successfully.", {
				position: "top-right",
				autoClose: 3000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: false,
				draggable: true,
			});
		} catch (error) {
			console.error("Failed to remove coin:", error);
		}
	}

	const location = useLocation();

	useEffect(() => {
		setMenu(false);
	}, [location]);

	function toggleMenu() {
		setMenu((menu) => !menu);
	}

	async function toggleWatchlist(coinId, coinName = null) {
		try {
			if (!watchlist.includes(coinId)) {
				const response = await watchlistAPI.add(coinId);
				setWatchlist(response.watchlist);
				toast.success(`${coinName || "Coin"} was added to watchlist`, {
					position: "top-right",
					autoClose: 3000,
					hideProgressBar: false,
					closeOnClick: true,
					pauseOnHover: false,
					draggable: true,
				});
			} else {
				const response = await watchlistAPI.remove(coinId);
				setWatchlist(response.watchlist);
				toast.info(`${coinName || "Coin"} was removed from watchlist`, {
					position: "top-right",
					autoClose: 3000,
					hideProgressBar: false,
					closeOnClick: true,
					pauseOnHover: false,
					draggable: true,
				});
			}
		} catch (error) {
			console.error("Failed to update watchlist:", error);
			toast.error("Failed to update watchlist. Please try again.", {
				position: "top-right",
				autoClose: 3000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
			});
		}
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				Loading...
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-200">
			<Header
				menu={menu}
				toggleMenu={toggleMenu}
				handleLogout={handleLogout}
			/>

			<AnimatePresence>
				{menu && <Menu handleLogout={handleLogout} />}
			</AnimatePresence>
			<Routes>
				<Route
					path="/"
					element={
						<Home
							watchlist={watchlist}
							toggleWatchlist={toggleWatchlist}
							addCoin={addCoin}
							form={form}
							toggleForm={toggleForm}
							coinData={coinData}
						/>
					}
				/>
				<Route
					path="/dashboard"
					element={
						isAuthenticated ? (
							<Dashboard
								watchlist={watchlist}
								toggleWatchlist={toggleWatchlist}
								portfolio={portfolio}
								addCoin={addCoin}
								form={form}
								toggleForm={toggleForm}
								coinData={coinData}
								removeCoin={removeCoin}
							/>
						) : (
							<Navigate to="/login" />
						)
					}
				/>
				<Route
					path="/watchlist"
					element={
						isAuthenticated ? (
							<Watchlist
								watchlist={watchlist}
								toggleForm={toggleForm}
								toggleWatchlist={toggleWatchlist}
								addCoin={addCoin}
								form={form}
								coinData={coinData}
							/>
						) : (
							<Navigate to="/login" />
						)
					}
				/>
				<Route path="/compare" element={<Compare />} />
				<Route path="/marketplace" element={<Marketplace />} />
				<Route
					path="/profile"
					element={
						isAuthenticated ? <Profile /> : <Navigate to="/login" />
					}
				/>
				<Route
					path="/transactions"
					element={
						isAuthenticated ? <TransactionHistory /> : <Navigate to="/login" />
					}
				/>
				<Route path="/admin/feeds" element={<AdminFeeds />} />
				<Route
					path="/login"
					element={
						isAuthenticated ? (
							<Navigate to="/dashboard" />
						) : (
							<Login toggleForm={toggleForm} form={form} />
						)
					}
				/>
				<Route
					path="/signup"
					element={
						isAuthenticated ? (
							<Navigate to="/dashboard" />
						) : (
							<SignUp />
						)
					}
				/>
			</Routes>
			<ToastContainer
				position="top-right"
				autoClose={3000}
				hideProgressBar={false}
				newestOnTop={false}
				closeOnClick
				rtl={false}
				draggable
				theme="light"
			/>
		</div>
	);
};

export default App;
