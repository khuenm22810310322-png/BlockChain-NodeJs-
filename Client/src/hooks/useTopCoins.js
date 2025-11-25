import { useState, useEffect, useRef } from "react";
import { marketAPI } from "../services/api";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Helper to check if essential data has changed
function hasDataChanged(prev, next) {
	if (prev.length !== next.length) return true;
	for (let i = 0; i < prev.length; i++) {
		const p = prev[i];
		const n = next[i];
		if (p.id !== n.id) return true;
		if (p.current_price !== n.current_price) return true;
		if (p.price_change_percentage_24h !== n.price_change_percentage_24h) return true;
		// Add other fields if they are displayed and change frequently
	}
	return false;
}

export default function useTopCoins() {
	const [coins, setCoins] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	
	// Use a ref to keep track of the current coins for comparison
	// without adding it to the effect dependency array
	const coinsRef = useRef([]);

	useEffect(() => {
		const socket = io(SOCKET_URL);
		let isMounted = true;

		const topCoins = async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await marketAPI.getTop100();
				if (isMounted) {
					setCoins(data);
					coinsRef.current = data;
					// Subscribe to updates
					socket.emit('subscribe', data.map(c => c.id));
				}
			} catch (err) {
				if (isMounted) setError(err.message);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		topCoins();

		// Handle full list updates (e.g. on connect)
		socket.on('top100:update', (payload) => {
			if (Array.isArray(payload)) {
				if (hasDataChanged(coinsRef.current, payload)) {
					setCoins(payload);
					coinsRef.current = payload;
					socket.emit('subscribe', payload.map(c => c.id));
				}
			}
		});

		// Handle partial price updates (Lazy Fetching)
		socket.on('prices:updated', (updates) => {
			if (Array.isArray(updates)) {
				setCoins(prevCoins => {
					const updateMap = new Map(updates.map(u => [u.id, u]));
					let changed = false;
					const newCoins = prevCoins.map(coin => {
						const update = updateMap.get(coin.id);
						if (update && update.current_price !== coin.current_price) {
							changed = true;
							return { 
								...coin, 
								current_price: update.current_price,
								chainlinkUpdatedAt: update.chainlinkUpdatedAt || coin.chainlinkUpdatedAt
							};
						}
						return coin;
					});
					
					if (changed) {
						coinsRef.current = newCoins;
						return newCoins;
					}
					return prevCoins;
				});
			}
		});

		return () => {
			isMounted = false;
			if (coinsRef.current.length > 0) {
				socket.emit('unsubscribe', coinsRef.current.map(c => c.id));
			}
			socket.disconnect();
		};
	}, []);

	return { coins, loading, error };
}
