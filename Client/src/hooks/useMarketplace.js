import { useEffect, useState, useCallback } from "react";
import api from "../services/api";

export function useMarketplaceConfig() {
	const [config, setConfig] = useState(null);
	useEffect(() => {
		api.get("/api/marketplace/config").then((res) => setConfig(res.data)).catch(() => {});
	}, []);
	return config;
}

export function useActiveListings(pollingInterval = 10000) {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const fetchAll = useCallback(async () => {
		setLoading(true);
		setError(null);
	try {
		const res = await api.get("/api/marketplace/listings");
		setData(res.data?.active || []);
	} catch (e) {
		setError(e.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAll();
		
		// Set up polling for real-time updates
		if (pollingInterval > 0) {
			const intervalId = setInterval(() => {
				fetchAll();
			}, pollingInterval);
			
			return () => clearInterval(intervalId);
		}
	}, [fetchAll, pollingInterval]);

	return { data, loading, error, refresh: fetchAll };
}

export function useListings(ids = []) {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const fetchListings = useCallback(async () => {
		if (!ids.length) return;
		setLoading(true);
		setError(null);
	try {
		const results = await Promise.all(ids.map((id) => api.get(`/api/marketplace/listings/${id}`)));
		setData(results.map((r, idx) => ({ id: ids[idx], ...r.data })));
	} catch (e) {
		setError(e.message);
		} finally {
			setLoading(false);
		}
	}, [ids]);

	useEffect(() => {
		fetchListings();
	}, [fetchListings]);

	return { data, loading, error, refresh: fetchListings };
}
