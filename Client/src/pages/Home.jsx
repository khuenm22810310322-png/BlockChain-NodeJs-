import { useState, useEffect, useCallback } from "react";
import Table from "../components/Table";
import LoginWarning from "../components/LoginWarning";
import DataSourceSummary from "../components/DataSourceSummary";
import CoinMarketplace from "../components/CoinMarketplace";
import { useAuth } from "../context/AuthContext";
import useTopCoins from "../hooks/useTopCoins";
import Searchbar from "../components/Searchbar";
import CoinGrid from "../components/CoinGrid";

const Home = ({
	watchlist,
	toggleWatchlist,
	addCoin,
	showLoginPrompt,
	openLoginPrompt,
	closeLoginPrompt,
}) => {
	const { isAuthenticated } = useAuth();
	const { coins, loading, error } = useTopCoins();
	const [search, setSearch] = useState("");
	const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'list'); // 'list' | 'grid'
	const [marketplaceOpen, setMarketplaceOpen] = useState(false);
	const [selectedCoin, setSelectedCoin] = useState(null);

	useEffect(() => {
		localStorage.setItem('viewMode', viewMode);
	}, [viewMode]);

	const filteredCoins = coins.filter(
		(coin) =>
			coin.name.toLowerCase().includes(search.toLowerCase()) ||
			coin.symbol.toLowerCase().includes(search.toLowerCase())
	);

	const handleOpenMarketplace = useCallback((coin) => {
		if (isAuthenticated) {
			// Show marketplace instead of form
			setSelectedCoin(coin);
			setMarketplaceOpen(true);
		} else {
			// Show login warning
			openLoginPrompt();
		}
	}, [isAuthenticated, openLoginPrompt]);

	const handleBuySuccess = useCallback(() => {
		// Optionally update portfolio or show success
		setMarketplaceOpen(false);
		setSelectedCoin(null);
	}, []);

	if (showLoginPrompt && !isAuthenticated) {
		return <LoginWarning onClose={closeLoginPrompt} />;
	}

	return (
		<>
				<div className="p-4 pb-24 font-sans ">
					<div className="w-full max-w-3xl mx-auto text-center flex flex-col items-center mt-7 sm:mt-12 mb-6 gap-4">
						<h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
							Track Cryptocurrency Prices
						</h1>
						<p className="text-md sm:text-lg text-gray-600 dark:text-gray-400">
							Stay updated with real-time cryptocurrency prices
							and track your portfolio.
						</p>
						<Searchbar
							searchValue={search}
							setSearchValue={setSearch}
							placeholder="Search crypto.."
						/>
					</div>

					{/* View mode switch */}
					<div className="w-full max-w-6xl mx-auto flex items-center justify-end mb-4">
						<div className="inline-flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
							<button
								className={`px-3 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
								onClick={() => setViewMode('list')}
							>
								List
							</button>
							<button
								className={`px-3 py-2 text-sm font-medium ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
								onClick={() => setViewMode('grid')}
							>
								Grid
							</button>
						</div>
					</div>

					{/* Data Source Summary */}
					<div className="w-full max-w-6xl mx-auto mt-8">
						<DataSourceSummary coins={filteredCoins} />
					</div>

					{viewMode === 'list' ? (
						<div className="w-full max-w-6xl mx-auto overflow-x-auto [scrollbar-width:none]">
							<Table
								loading={loading}
								error={error}
								coins={filteredCoins}
								toggleWatchlist={toggleWatchlist}
								watchlist={watchlist}
								message={""}
								onAddClick={handleOpenMarketplace}
								onRequireLogin={openLoginPrompt}
							/>
						</div>
					) : (
						<div className="w-full max-w-6xl mx-auto">
							<CoinGrid
								loading={loading}
								error={error}
								coins={filteredCoins}
								toggleWatchlist={toggleWatchlist}
								watchlist={watchlist}
								onAddClick={handleOpenMarketplace}
								onRequireLogin={openLoginPrompt}
							/>
						</div>
					)}

					{marketplaceOpen && selectedCoin && (
						<CoinMarketplace
							coin={selectedCoin}
							onClose={() => {
								setMarketplaceOpen(false);
								setSelectedCoin(null);
							}}
							onBuySuccess={handleBuySuccess}
							onPortfolioUpdate={(payload) =>
								addCoin({ ...payload, skipMint: true })
							}
						/>
					)}
				</div>
		</>
	);
};

export default Home;
