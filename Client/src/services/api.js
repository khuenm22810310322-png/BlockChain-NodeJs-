import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const api = axios.create({
	baseURL: API_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem("token");
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export const authAPI = {
	login: async (username, password, captchaToken) => {
		const response = await api.post("/login", { username, password, captchaToken });
		return response.data;
	},

	register: async (username, password, captchaToken) => {
		const response = await api.post("/register", { username, password, captchaToken });
		return response.data;
	},
};

export const portfolioAPI = {
	get: async () => {
		const response = await api.get("/portfolio");
		return response.data;
	},

	update: async (coin, coinData) => {
		const response = await api.put("/portfolio/update", { coin, coinData });
		return response.data;
	},
};

export const watchlistAPI = {
	get: async () => {
		const response = await api.get("/watchlist");
		return response.data;
	},

	add: async (coin) => {
		const response = await api.put("/watchlist/add", { coin });
		return response.data;
	},

	remove: async (coin) => {
		const response = await api.put("/watchlist/remove", { coin });
		return response.data;
	},
};

// Market + chainlink compare APIs
export const marketAPI = {
	getTop100: async () => {
		const response = await api.get("/api/market/top100");
		const d = response.data;
		return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
	},
	getPrices: async (coinIds) => {
		const response = await api.post("/api/prices", { coinIds });
		const d = response.data;
		return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
	},
	comparePrices: async (coinIds) => {
		const query = encodeURIComponent(coinIds.join(","));
		const response = await api.get(`/api/compare/prices?ids=${query}`);
		return Array.isArray(response.data?.data) ? response.data.data : [];
	},
	compareStats: async (coinIds) => {
		const query = coinIds?.length ? `?ids=${encodeURIComponent(coinIds.join(","))}` : "";
		const response = await api.get(`/api/compare/stats${query}`);
		return response.data;
	},
	getMarketplaceConfig: async () => (await api.get("/api/marketplace/config")).data,
	getTokens: async () => (await api.get("/api/marketplace/tokens")).data,
	getListing: async (id) => (await api.get(`/api/marketplace/listings/${id}`)).data,
	createListing: async (payload) => (await api.post("/api/marketplace/listings", payload)).data,
	buyListing: async (payload) => (await api.post("/api/marketplace/buy", payload)).data,
};

export const adminAPI = {
	getUsers: async () => (await api.get("/api/admin/users")).data,
	getUserDetails: async (id) => (await api.get(`/api/admin/users/${id}`)).data,
	deleteUser: async (id) => (await api.delete(`/api/admin/users/${id}`)).data,
	toggleBanUser: async (id, isBanned) => (await api.put(`/api/admin/users/${id}/ban`, { isBanned })).data,
	refundUser: async (id, payload) => (await api.post(`/api/admin/users/${id}/refund`, payload)).data,
};

export const alertsAPI = {
	getAll: async () => (await api.get("/api/alerts")).data,
	create: async (payload) => (await api.post("/api/alerts", payload)).data,
	delete: async (id) => (await api.delete(`/api/alerts/${id}`)).data,
};

export default api;
