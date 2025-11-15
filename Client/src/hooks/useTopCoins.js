import { useState, useEffect } from "react";
import { marketAPI } from "../services/api"; // <-- THÊM
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function useTopCoins() {
	const [coins, setCoins] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	useEffect(() => {
		const topCoins = async () => {
			setLoading(true);
			setError(null);
			try {
				// BỎ: const response = await fetch(COINGECKO_TOP_COINS_API);
				// BỎ: if (!response.ok) ...
				// BỎ: const data = await response.json();
				// THAY THẾ BẰNG:
				const data = await marketAPI.getTop100(); // Gọi backend
				setCoins(data);
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		topCoins();

		// Setup socket.io client for realtime updates
		const socket = io(SOCKET_URL);
		socket.on('connect', () => {
			// console.log('socket connected', socket.id);
		});
		socket.on('top100:update', (payload) => {
			if (Array.isArray(payload)) {
				setCoins(payload);
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	return { coins, loading, error };
}
