import StarOutlineIcon from "@mui/icons-material/StarOutline";
import StarIcon from "@mui/icons-material/Star";
import { useCurrency } from "../context/CurrencyContext";
import getColor from "../utils/color";

const PortfolioCoinRow = ({
	coin,
	isStarred,
	coinData,
	toggleWatchlist,
	onAddClick,
	onSellClick,
}) => {
	const { currency, formatCurrency } = useCurrency();
	const canBuy = typeof onAddClick === "function";

	if (!coinData) {
		return <></>;
	}

	const profit =
		((coin.current_price * coinData.coins - coinData.totalInvestment) /
			coinData.totalInvestment) *
		100;
	const color = getColor(profit);

	return (
		<tr className="border-b border-gray-200 hover:bg-gray-50 transition-all duration-150 dark:hover:bg-gray-900 dark:border-gray-700">
			<td className="px-6 py-4">
				<div>
					<p className="font-semibold text-gray-900 dark:text-white">
						{coin.name}
					</p>
					<p className="text-gray-500 text-sm uppercase dark:text-gray-400">
						{coin.symbol}
					</p>
				</div>
			</td>
			<td className="px-6 py-4 font-medium">
				{formatCurrency(coin.current_price * currency[1], 6)}
			</td>
			<td className="px-6 py-4 font-medium text-gray-800 dark:text-white">
				{formatCurrency(
					(coinData.totalInvestment * currency[1]).toFixed(2),
					6
				)}
			</td>
			<td className="px-6 py-4 font-medium text-gray-800 dark:text-white">
				{coinData.coins.toLocaleString()}
			</td>
			<td className={`px-6 py-4 font-medium`}>
				{formatCurrency(
					(coin.current_price * coinData.coins * currency[1]).toFixed(
						2
					),
					6
				)}
			</td>

			<td className={`px-6 py-4 font-medium ${color}`}>
				{profit.toFixed(2).toLocaleString()}%
			</td>
			<td className="px-6 py-4">
				<div className="flex items-center gap-2">
					<button
						className={`cursor-pointer ${
							!isStarred
								? "text-gray-400 hover:text-amber-300 transition-all duration-200"
								: "text-amber-300"
						}`}
						onClick={() => {
							toggleWatchlist(coin.id, coin.name);
						}}
					>
						{isStarred ? <StarIcon /> : <StarOutlineIcon />}
					</button>
					<button
						className={`px-3 py-1 text-white text-sm font-semibold rounded-md transition-all duration-200 cursor-pointer ${
							canBuy
								? "bg-green-600 hover:bg-green-700"
								: "bg-gray-400 cursor-not-allowed"
						}`}
						disabled={!canBuy}
						onClick={() => {
							canBuy && onAddClick(coin);
						}}
					>
						Buy
					</button>
					<button
						className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-all duration-200 cursor-pointer"
						onClick={() => {
							onSellClick && onSellClick(coin);
						}}
					>
						Sell
					</button>
				</div>
			</td>
		</tr>
	);
};

export default PortfolioCoinRow;
