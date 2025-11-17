import StarOutlineIcon from "@mui/icons-material/StarOutline";
import StarIcon from "@mui/icons-material/Star";
import { Link as LinkIcon } from "@mui/icons-material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import getColor from "../utils/color";

const DataSourceIndicator = ({ diffPct }) => {
	const largeDiff = diffPct !== null && Math.abs(diffPct) > 1;

	return (
		<div className="flex items-center gap-2">
			<div
				className={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
					"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
				}`}
			>
				<LinkIcon className="w-3 h-3" />
				<span>Chainlink</span>
			</div>
			{largeDiff && (
				<div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
					<WarningAmberIcon className="w-3 h-3" />
					<span>Large Difference</span>
				</div>
			)}
		</div>
	);
};

const CoinCard = ({ coin, isStarred, toggleWatchlist, onAddClick, onRequireLogin }) => {
	const { isAuthenticated } = useAuth();
	const { currency, formatCurrency } = useCurrency();
	const pctValue =
		typeof coin.price_change_percentage_24h === "number"
			? coin.price_change_percentage_24h
			: null;
	const pctColor = getColor(pctValue ?? 0);
	const diffPct = typeof coin.priceDiffPct === "number" ? coin.priceDiffPct : null;

	return (
		<div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex flex-col gap-3 border border-gray-100 dark:border-gray-700">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex flex-col">
						<div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
							<span>{coin.name}</span>
							<span className="text-xs uppercase text-gray-500 dark:text-gray-400">
								{coin.symbol}
							</span>
						</div>
						<DataSourceIndicator diffPct={diffPct} />
					</div>
				</div>
				<button
					className={`cursor-pointer ${
						!isStarred
							? "text-gray-400 hover:text-amber-300 transition-all duration-200"
							: "text-amber-300"
					}`}
					onClick={() => {
						if (isAuthenticated) {
							toggleWatchlist(coin.id, coin.name);
						} else if (typeof onRequireLogin === "function") {
							onRequireLogin();
						}
					}}
					aria-label={isStarred ? "Remove from watchlist" : "Add to watchlist"}
				>
					{isStarred ? <StarIcon /> : <StarOutlineIcon />}
				</button>
			</div>

			<div className="grid grid-cols-2 gap-2 text-sm">
				<div className="text-gray-500 dark:text-gray-400">Price</div>
				<div className="font-medium text-gray-900 dark:text-white">
					{formatCurrency(coin.current_price * currency[1], 6)}
				</div>

				<div className="text-gray-500 dark:text-gray-400">24h</div>
				<div className={`font-medium ${pctColor}`}>
					{pctValue !== null ? `${pctValue.toFixed(2)}%` : "-"}
				</div>
			</div>

			{diffPct !== null && (
				<div className="text-xs text-gray-600 dark:text-gray-400">
					Price difference:{" "}
					<span
						className={`font-semibold ${
							Math.abs(diffPct) > 1 ? "text-amber-500" : "text-green-500"
						}`}
					>
						{diffPct > 0 ? "+" : ""}
						{diffPct.toFixed(3)}%
					</span>
				</div>
			)}

			<div className="mt-1">
				<button
					className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-all duration-200 cursor-pointer"
					onClick={() => {
						if (isAuthenticated) {
							onAddClick && onAddClick(coin);
						} else if (typeof onRequireLogin === "function") {
							onRequireLogin();
						}
					}}
				>
					Add
				</button>
			</div>
		</div>
	);
};

const CoinGrid = ({ loading, error, coins, toggleWatchlist, watchlist, onAddClick, onRequireLogin }) => {
	if (loading) {
		return (
			<div className="text-center p-8 text-gray-500 dark:text-gray-400">Loading data...</div>
		);
	}
	if (error) {
		return (
			<div className="text-center p-8 text-red-500 dark:text-red-400">An Error Occured</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{coins.map((coin) => (
				<CoinCard
					key={coin.id}
					coin={coin}
					isStarred={watchlist.includes(coin.id)}
					toggleWatchlist={toggleWatchlist}
					onAddClick={onAddClick}
					onRequireLogin={onRequireLogin}
				/>
			))}
		</div>
	);
};

export default CoinGrid;
