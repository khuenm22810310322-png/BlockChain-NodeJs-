import { useEffect, useState } from "react";
import api from "../services/api";

export default function AdminFeeds() {
	const [feeds, setFeeds] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchFeeds = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.get("/admin/feeds");
			setFeeds(res.data?.data || []);
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFeeds();
	}, []);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 sm:p-6">
			<div className="max-w-5xl mx-auto space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold">Feed Admin</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400">Discovered feeds and manual entries</p>
					</div>
					<button
						onClick={fetchFeeds}
						className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
					>
						Refresh
					</button>
				</div>

				{loading && <div>Loading...</div>}
				{error && <div className="text-red-500">{error}</div>}

				<div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
					<table className="min-w-full text-sm">
						<thead className="bg-gray-100 dark:bg-gray-700">
							<tr>
								<th className="px-4 py-2 text-left">Coin</th>
								<th className="px-4 py-2 text-left">Chain</th>
								<th className="px-4 py-2 text-left">Feed</th>
								<th className="px-4 py-2 text-left">Source</th>
								<th className="px-4 py-2 text-left">Updated</th>
							</tr>
						</thead>
						<tbody>
							{feeds.map((f) => (
								<tr key={f._id} className="border-t border-gray-100 dark:border-gray-700">
									<td className="px-4 py-2">{f.coinId} ({f.symbol})</td>
									<td className="px-4 py-2">{f.chain}</td>
									<td className="px-4 py-2 font-mono text-xs">{f.feedAddress}</td>
									<td className="px-4 py-2">{f.source}</td>
									<td className="px-4 py-2">{f.updatedAt ? new Date(f.updatedAt).toLocaleString() : ""}</td>
								</tr>
							))}
							{!feeds.length && !loading && (
								<tr>
									<td className="px-4 py-3 text-center text-gray-500" colSpan={5}>
										No feeds found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
