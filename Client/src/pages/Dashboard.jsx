import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useState } from "react";
import PortfolioTable from "../components/PortfolioTable";
import TopCoins from "../components/TopCoins";
import DataSourceSummary from "../components/DataSourceSummary";
import SellModal from "../components/SellModal";
import CoinMarketplace from "../components/CoinMarketplace";
import { useCurrency } from "../context/CurrencyContext";
import useCoins from "../hooks/useCoins";
import useChart from "../hooks/useChart";
import PieChartComponent from "../components/PieChartComponent";
import BarChartComponent from "../components/BarChartComponent";

const Dashboard = ({
	watchlist,
	toggleWatchlist,
	portfolio,
	form,
	addCoin,
	toggleForm,
	removeCoin,
	coinData,
	onPortfolioUpdate,
}) => {
	console.log('📊 Dashboard rendered with portfolio:', portfolio);
	
	const portfolioCoins = Object.keys(portfolio);
	console.log('📊 Portfolio coins:', portfolioCoins);
	
	const [sellModalOpen, setSellModalOpen] = useState(false);
	const [selectedCoin, setSelectedCoin] = useState(null);
	const [marketplaceOpen, setMarketplaceOpen] = useState(false);
	const [marketplaceCoin, setMarketplaceCoin] = useState(null);
	const { currency, formatCurrency } = useCurrency();
	const { coins, loading, error } = useCoins(portfolio);
	
	console.log('📊 useCoins result - coins:', coins, 'loading:', loading, 'error:', error);
	
	const chart = useChart(portfolio, coins);

	const handleSellClick = (coin) => {
		setSelectedCoin(coin);
		setSellModalOpen(true);
	};

	const handleBuyClick = (coin) => {
		setMarketplaceCoin(coin);
		setMarketplaceOpen(true);
	};

	const handleSellSuccess = () => {
		// Optionally refresh portfolio or show success message
		setSellModalOpen(false);
		setSelectedCoin(null);
	};

	const totalInvestment = Object.keys(portfolio).reduce((acc, coinId) => {
		return acc + portfolio[coinId].totalInvestment;
	}, 0);

	const currentValue = Object.keys(portfolio).reduce((acc, coinId) => {
		const coinData = coins.find((c) => c.id === coinId);
		if (coinData && portfolio[coinId]) {
			return acc + portfolio[coinId].coins * coinData.current_price;
		}
		return acc;
	}, 0);

	const profit =
		totalInvestment > 0
			? ((currentValue - totalInvestment) / totalInvestment) * 100
			: 0;

	return (
		<div className="bg-slate-100 min-h-screen w-full p-4 sm:p-6 lg:p-8 dark:bg-gray-900 dark:text-white">
			<div className="max-w-9xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="bg-white shadow-lg rounded-xl p-6 flex flex-col items-start gap-1 sm:gap-3 dark:bg-gray-800">
					<h2 className="text-md sm:text-xl font-semibold text-gray-500 dark:text-white">
						Current Value
					</h2>
					<p className="text-2xl sm:text-4xl font-bold wrap-anywhere">
						{formatCurrency(currentValue * currency[1])}
					</p>
					<div
						className={`flex items-center gap-2 font-semibold ${
							profit < 0 ? "text-red-600" : "text-green-600"
						}`}
					>
						{profit < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
						<span>{profit.toFixed(2)}%</span>
					</div>
				</div>
				<div className="bg-white shadow-lg rounded-xl p-6 flex flex-col items-start gap-3 dark:bg-gray-800">
					<h2 className="text-md sm:text-xl font-semibold text-gray-500 dark:text-white">
						Total Investment
					</h2>
					<p className="text-2xl sm:text-4xl font-bold wrap-anywhere">
						{formatCurrency(totalInvestment * currency[1])}
					</p>
				</div>
			</div>
			<div className="max-w-9xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="bg-white shadow-lg rounded-xl p-6 mt-8 dark:bg-gray-800">
					<h2 className="text-xl font-semibold text-gray-500 mb-4 dark:text-white">
						Portfolio Allocation
					</h2>
					<div className="w-full h-80">
						{loading ? (
							<div className="flex justify-center items-center h-full">
								<p>Loading Chart...</p>
							</div>
						) : error ? (
							<div className="flex justify-center items-center h-full text-red-500">
								<p>{error}</p>
							</div>
						) : chart.length > 0 ? (
							<PieChartComponent chart={chart} />
						) : (
							<div className="flex justify-center items-center h-full">
								<p>No coins in portfolio to display.</p>
							</div>
						)}
					</div>
				</div>
				<TopCoins
					coins={coins}
					loading={loading}
					error={error}
					portfolio={portfolio}
				/>
			</div>
			<div className="bg-white shadow-lg rounded-xl p-6 mt-8 dark:bg-gray-800 ">
				<h2 className="text-xl font-semibold text-gray-500 mb-4 dark:text-white">
					Investment vs Current Value
				</h2>
				<div className="w-full h-96 overflow-x-auto ">
					{loading ? (
						<div className="flex justify-center items-center h-full">
							<p>Loading Chart...</p>
						</div>
					) : error ? (
						<div className="flex justify-center items-center h-full text-red-500">
							<p>{error}</p>
						</div>
					) : chart.length > 0 ? (
						<BarChartComponent chart={chart} />
					) : (
						<div className="flex justify-center items-center h-full">
							<p>No data to display in chart.</p>
						</div>
					)}
				</div>
			</div>
			<div className="mt-10 mx-auto overflow-x-auto [scrollbar-width:none]">
				<PortfolioTable
					loading={loading}
					error={error}
					coins={coins}
					toggleWatchlist={toggleWatchlist}
					watchlist={watchlist}
					portfolio={portfolio}
					message={
						portfolioCoins.length !== 0
							? ""
							: "No Coins Added To Portfolio"
					}
					onSellClick={handleSellClick}
					onAddClick={handleBuyClick}
					totalInvestment={totalInvestment}
					currentValue={currentValue}
				/>

			</div>
			
			{sellModalOpen && selectedCoin && (
				<SellModal
					coin={selectedCoin}
					portfolio={portfolio}
					onClose={() => setSellModalOpen(false)}
					onSuccess={async () => {
						handleSellSuccess();
						onPortfolioUpdate && (await onPortfolioUpdate());
					}}
					onPortfolioUpdate={onPortfolioUpdate}
				/>
			)}
			{marketplaceOpen && marketplaceCoin && (
				<CoinMarketplace
					coin={marketplaceCoin}
					onClose={() => {
						setMarketplaceOpen(false);
						setMarketplaceCoin(null);
					}}
					onBuySuccess={() => {
						setMarketplaceOpen(false);
						setMarketplaceCoin(null);
					}}
					onPortfolioUpdate={addCoin}
				/>
			)}
		</div>
	);
};

export default Dashboard;
