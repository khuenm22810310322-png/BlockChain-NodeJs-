import RefreshIcon from "@mui/icons-material/Refresh";

const format = (n) => {
	if (n === null || n === undefined) return "-";
	return `$${Number(n).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
};

export default function PriceComparison({ item, onRefresh }) {
	return (
		<div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					{item.image && (
						<img src={item.image} alt={item.name} className="w-10 h-10 rounded-full" />
					)}
					<div>
						<div className="text-lg font-semibold text-gray-900 dark:text-white">
							{item.name} ({item.symbol?.toUpperCase()})
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">ID: {item.id}</div>
					</div>
				</div>
				<button
					className="flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
					onClick={() => onRefresh && onRefresh(item.id)}
					aria-label={`Refresh ${item.name}`}
				>
					<RefreshIcon fontSize="small" /> Refresh
				</button>
			</div>

			<div className="space-y-2 text-sm">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
							Chainlink
						</span>
					</div>
					<div className="font-semibold text-gray-900 dark:text-white">{format(item.chainlinkPrice)}</div>
				</div>
			</div>
		</div>
	);
}
