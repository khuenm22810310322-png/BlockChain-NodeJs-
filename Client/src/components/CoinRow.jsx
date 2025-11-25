import React, { memo, useRef, useEffect, useState } from "react";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import StarIcon from "@mui/icons-material/Star";
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { Link as LinkIcon } from "@mui/icons-material";
import { useCurrency } from "../context/CurrencyContext";
import { useAuth } from "../context/AuthContext";
import getColor from "../utils/color";
import AlertManager from "./Alerts/AlertManager";

// Data source indicator: always show Chainlink badge
const DataSourceIndicator = memo(() => (
	<div className="inline-flex w-fit self-start items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
		<LinkIcon className="w-3 h-3" />
		<span>Chainlink</span>
	</div>
));

const StaticInfo = memo(({ name, symbol }) => (
	<div className="flex flex-col gap-1">
		<p className="font-semibold text-gray-900 dark:text-white">{name}</p>
		<p className="text-gray-500 text-sm uppercase dark:text-gray-400">{symbol}</p>
		<DataSourceIndicator />
	</div>
));

const PriceCell = memo(({ price, formatCurrency, currencyRate }) => {
	const prevPrice = useRef(price);
	const ref = useRef(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		if (price > prevPrice.current) {
			el.classList.add('flash-green');
			el.classList.remove('flash-red');
		} else if (price < prevPrice.current) {
			el.classList.add('flash-red');
			el.classList.remove('flash-green');
		}

		const timer = setTimeout(() => {
			if (el) el.classList.remove('flash-green', 'flash-red');
		}, 1000);

		prevPrice.current = price;
		return () => clearTimeout(timer);
	}, [price]);

	return (
		<span ref={ref} className="transition-colors duration-300 block px-2 py-1 rounded">
			{typeof price === "number" ? formatCurrency(price * currencyRate, 6) : "-"}
		</span>
	);
});

const PercentCell = memo(({ value }) => {
	const color = getColor(value);
	const text = typeof value === "number" ? `${value.toFixed(2)}%` : "-";
	return <span className={`font-medium ${color}`}>{text}</span>;
});

const ActionButtons = memo(({ isStarred, isAuthenticated, onToggleWatchlist, onAddClick, onRequireLogin, onAlertClick }) => (
	<div className="flex items-center gap-2">
		<button
			className={`cursor-pointer ${
				!isStarred
					? "text-gray-400 hover:text-amber-300 transition-all duration-200"
					: "text-amber-300"
			}`}
			onClick={() => {
				if (isAuthenticated) {
					onToggleWatchlist();
				} else if (typeof onRequireLogin === "function") {
					onRequireLogin();
				}
			}}
			title="Add to Watchlist"
		>
			{isStarred ? <StarIcon /> : <StarOutlineIcon />}
		</button>
		
		<button
			className="text-gray-400 hover:text-blue-500 transition-all duration-200"
			onClick={() => {
				if (isAuthenticated) {
					onAlertClick();
				} else if (typeof onRequireLogin === "function") {
					onRequireLogin();
				}
			}}
			title="Set Price Alert"
		>
			<NotificationsNoneIcon />
		</button>

		<button
			className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-all duration-200 cursor-pointer"
			onClick={() => {
				if (isAuthenticated) {
					onAddClick();
				} else if (typeof onRequireLogin === "function") {
					onRequireLogin();
				}
			}}
		>
			Add
		</button>
	</div>
));

const CoinRow = ({ coin, isStarred, toggleWatchlist, onAddClick, onRequireLogin }) => {
	const { isAuthenticated } = useAuth();
	const { currency, formatCurrency } = useCurrency();
	const [showAlerts, setShowAlerts] = useState(false);

	// Destructure primitives to pass to memoized cells
	const { name, symbol, current_price, price_change_percentage_24h, id } = coin;

	return (
		<>
			<tr className="border-b border-gray-200 hover:bg-gray-50 transition-all duration-150 dark:hover:bg-gray-800 dark:border-b dark:border-gray-700">
				<td className="px-6 py-4">
					<StaticInfo name={name} symbol={symbol} />
				</td>
				<td className="px-6 py-4 font-medium">
					<PriceCell 
						price={current_price} 
						formatCurrency={formatCurrency} 
						currencyRate={currency[1]} 
					/>
				</td>
				<td className="px-6 py-4">
					<PercentCell value={price_change_percentage_24h} />
				</td>
				<td className="px-6 py-4">
					<ActionButtons 
						isStarred={isStarred} 
						isAuthenticated={isAuthenticated}
						onToggleWatchlist={() => toggleWatchlist(id, name)}
						onAddClick={() => onAddClick && onAddClick(coin)}
						onRequireLogin={() => onRequireLogin && onRequireLogin(coin)}
						onAlertClick={() => setShowAlerts(!showAlerts)}
					/>
				</td>
			</tr>
			{showAlerts && (
				<tr>
					<td colSpan="4" className="px-4 pb-4 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
						<AlertManager 
							coinId={id} 
							coinSymbol={symbol} 
							currentPrice={current_price} 
						/>
					</td>
				</tr>
			)}
		</>
	);
};

function arePropsEqual(prev, next) {
	return (
		prev.isStarred === next.isStarred &&
		prev.coin.id === next.coin.id &&
		prev.coin.current_price === next.coin.current_price &&
		prev.coin.price_change_percentage_24h === next.coin.price_change_percentage_24h &&
		prev.coin.name === next.coin.name
	);
}

export default memo(CoinRow, arePropsEqual);
