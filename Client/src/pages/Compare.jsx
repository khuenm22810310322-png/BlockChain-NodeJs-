import { useEffect, useMemo, useState } from "react";
import { marketAPI } from "../services/api";
import PriceComparison from "../components/PriceComparison";
import { toast } from "react-toastify";

function downloadCSV(rows) {
	const header = ["id", "symbol", "chainlinkPrice", "coingeckoPrice", "diffPct"];
	const lines = [header.join(",")].concat(
		rows.map((r) =>
			[
				r.id,
				r.symbol,
				r.chainlinkPrice ?? "",
				r.coingeckoPrice ?? "",
				r.diffPct ?? "",
			].join(",")
		)
	);
	const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", "price-comparison.csv");
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

export default function Compare() {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [threshold, setThreshold] = useState(0);
	const [sortKey, setSortKey] = useState("diff");
	const [sortDir, setSortDir] = useState("desc");

	const fetchData = async (ids) => {
		setLoading(true);
		setError(null);
		try {
			const list = ids?.length ? ids : (await marketAPI.getTop100()).map((c) => c.id);
			const compare = await marketAPI.comparePrices(list.slice(0, 50));
			setData(compare);
			compare
				.filter((c) => c.diffPct !== null && Math.abs(c.diffPct) > 2)
				.slice(0, 3)
				.forEach((c) => {
					toast.warn(`⚠️ ${c.name}: ${c.diffPct.toFixed(2)}% difference`, {
						icon: "⛓️",
						autoClose: 4000,
					});
				});
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	const filtered = useMemo(() => {
		return data
			.filter((d) => (threshold ? (d.diffPct !== null && Math.abs(d.diffPct) > threshold) : true))
			.sort((a, b) => {
				const aVal = sortKey === "diff" ? Math.abs(a.diffPct ?? 0) : (a.chainlinkUpdatedAt || 0);
				const bVal = sortKey === "diff" ? Math.abs(b.diffPct ?? 0) : (b.chainlinkUpdatedAt || 0);
				return sortDir === "asc" ? aVal - bVal : bVal - aVal;
			});
	}, [data, threshold, sortKey, sortDir]);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6">
			<div className="max-w-6xl mx-auto space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold">Price Comparison</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400">
							Chainlink price feed snapshots
						</p>
					</div>
					<div className="flex flex-wrap gap-2 items-center">
						<label className="text-sm text-gray-600 dark:text-gray-300">
							Filter &gt; %
							<input
								type="number"
								min="0"
								className="ml-2 w-20 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
								value={threshold}
								onChange={(e) => setThreshold(Number(e.target.value))}
							/>
						</label>
						<select
							className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
							value={sortKey}
							onChange={(e) => setSortKey(e.target.value)}
						>
							<option value="diff">Sort by diff</option>
							<option value="time">Sort by updatedAt</option>
						</select>
						<select
							className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
							value={sortDir}
							onChange={(e) => setSortDir(e.target.value)}
						>
							<option value="desc">Desc</option>
							<option value="asc">Asc</option>
						</select>
						<button
							onClick={() => downloadCSV(filtered)}
							className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
						>
							Export CSV
						</button>
						<button
							onClick={() => fetchData()}
							className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
						>
							Refresh
						</button>
					</div>
				</div>

				{loading && <div className="text-center py-6 text-gray-500">Loading...</div>}
				{error && <div className="text-center py-6 text-red-500">{error}</div>}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{filtered.map((item) => (
						<PriceComparison key={item.id} item={item} onRefresh={() => fetchData([item.id])} />
					))}
				</div>
			</div>
		</div>
	);
}
