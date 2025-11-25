import { useState } from "react";
import Table from "../components/Table";
import useWatchlist from "../hooks/useWatchlist";
import CoinMarketplace from "../components/CoinMarketplace";

const Watchlist = ({ watchlist, toggleWatchlist, addCoin }) => {
	const { coins, loading, error } = useWatchlist(watchlist);
	const [marketplaceOpen, setMarketplaceOpen] = useState(false);
	const [selectedCoin, setSelectedCoin] = useState(null);

	const handleAddClick = (coin) => {
		setSelectedCoin(coin);
		setMarketplaceOpen(true);
	};

	const handleBuySuccess = () => {
		setMarketplaceOpen(false);
		setSelectedCoin(null);
	};

	return (
		<>
			<div className="mt-3 overflow-x-auto [scrollbar-width:none] mx-6">
				<Table
					loading={loading}
					error={error}
					coins={coins}
					toggleWatchlist={toggleWatchlist}
					watchlist={watchlist}
					message={
						watchlist.length === 0
							? "No Coin Has Been Added To Watchlist"
							: ""
					}
					onAddClick={handleAddClick}
				/>
			</div>

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
		</>
	);
};

export default Watchlist;
