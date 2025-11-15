import { useState, useEffect } from "react";
import { marketAPI } from "../services/api"; // <-- THÊM

export default function useCoins(portfolio) {
	const portfolioCoins = Object.keys(portfolio); // Đây là mảng ID CoinGecko
	const [coins, setCoins] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const searchCoins = async () => {
			setLoading(true);
			setError(null);

			if (portfolioCoins.length === 0) {
				setCoins([]);
				setLoading(false);
				return;
			}

			try {
				// BỎ: const coinIds = portfolioCoins.join(",");
				// BỎ: const res = await fetch(`https...`);
				// BỎ: const data = await res.json();
				// THAY THẾ BẰNG:
				const data = await marketAPI.getPrices(portfolioCoins); // Gọi backend
				setCoins(data);
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		searchCoins();
	}, [portfolio]); // Giữ dependency array, nó là đúng

	return { coins, loading, error };
}
