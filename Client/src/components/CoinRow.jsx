import StarOutlineIcon from "@mui/icons-material/StarOutline";
import StarIcon from "@mui/icons-material/Star";
import { Link as LinkIcon } from "@mui/icons-material";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import getColor from "../utils/color";

const CoinRow = ({ coin, isStarred, toggleWatchlist, onAddClick, onRequireLogin }) => {
	const { isAuthenticated } = useAuth();
	const { currency, formatCurrency } = useCurrency();

	const color = getColor(coin.price_change_percentage_24h);
	const priceText =
		typeof coin.current_price === "number"
			? formatCurrency(coin.current_price * currency[1], 6)
			: "-";
	const pctText =
		typeof coin.price_change_percentage_24h === "number"
			? `${coin.price_change_percentage_24h.toFixed(2)}%`
			: "-";

	// Data source indicator: always show Chainlink badge
	const DataSourceIndicator = () => (
		<div className="inline-flex w-fit self-start items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
			<LinkIcon className="w-3 h-3" />
			<span>Chainlink</span>
		</div>
	);

	return (
		<tr className="border-b border-gray-200 hover:bg-gray-50 transition-all duration-150 dark:hover:bg-gray-800 dark:border-b dark:border-gray-700">
			<td className="px-6 py-4">
				<div className="flex flex-col gap-1">
					<p className="font-semibold text-gray-900 dark:text-white">{coin.name}</p>
					<p className="text-gray-500 text-sm uppercase dark:text-gray-400">{coin.symbol}</p>
					<DataSourceIndicator />
				</div>
			</td>
			<td className="px-6 py-4 font-medium">{priceText}</td>
			<td className={`px-6 py-4 font-medium ${color}`}>{pctText}</td>
			<td className="px-6 py-4">
				<div className="flex items-center gap-2">
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
					>
						{isStarred ? <StarIcon /> : <StarOutlineIcon />}
					</button>
					<button
						className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-all duration-200 cursor-pointer"
						onClick={() => {
							if (isAuthenticated) {
								onAddClick && onAddClick(coin);
							} else if (typeof onRequireLogin === "function") {
								onRequireLogin(coin);
							}
						}}
					>
						Add
					</button>
				</div>
			</td>
		</tr>
	);
};

export default CoinRow;
