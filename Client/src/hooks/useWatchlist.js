import { useEffect, useState } from "react";
import { marketAPI } from "../services/api"; // <-- THÊM

export default function useWatchlist(watchlist) { // watchlist là mảng ID CoinGecko
	const [coins, setCoins] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const searchCoins = async (query) => {
			setLoading(true);
			setError(null);

			if (watchlist.length === 0) {
				setCoins([]);
				setLoading(false);
				return;
			}

			try {
				// BỎ: const coinIds = watchlist.join(",");
				// BỎ: const res = await fetch(`https...`);
				// BỎ: const data = await res.json();
				// THAY THẾ BẰNG:
				const data = await marketAPI.getPrices(watchlist); // Gọi backend
				setCoins(data);
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		searchCoins();
	}, [watchlist]);

	return {
		coins,
		loading,
		error,
	};
}
