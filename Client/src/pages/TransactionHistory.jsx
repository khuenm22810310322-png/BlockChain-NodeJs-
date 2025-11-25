import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import { ethers } from "ethers";
import { getExplorerUrl } from "../utils/explorer";

const TransactionHistory = () => {
	const [transactions, setTransactions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("all"); // all, buyFromExchange, createListing, buy

	useEffect(() => {
		loadTransactions();
	}, [filter]);

	const loadTransactions = async () => {
		try {
			setLoading(true);
			const params = filter !== "all" ? { type: filter } : {};
			const response = await api.get("/api/marketplace/transactions", { params });
			
			// API returns { transactions: [...] } or just [...]
			const data = response.data;
			setTransactions(Array.isArray(data) ? data : (data.transactions || []));
			
			console.log("Loaded transactions:", response.data);
		} catch (error) {
			console.error("Failed to load transactions:", error);
			toast.error("Không thể tải lịch sử giao dịch");
			setTransactions([]); // Set empty array on error
		} finally {
			setLoading(false);
		}
	};

	const formatAmount = (rawAmount) => {
		if (rawAmount === null || rawAmount === undefined) return "0";
		const str = rawAmount.toString();

		// Heuristic: if it's a big integer (> 18 digits) assume Wei
		const digitsOnly = str.replace(/[^0-9]/g, "");
		const looksLikeWei = digitsOnly.length > 18 && !str.includes(".");

		try {
			if (looksLikeWei) {
				return ethers.formatUnits(str, 18);
			}
			// Otherwise treat as a plain token amount
			const n = Number(str);
			if (!Number.isFinite(n)) return "0";
			return n.toString();
		} catch {
			return "0";
		}
	};

	const getTypeLabel = (type) => {
		const labels = {
			buyFromExchange: "🛒 Mua từ sàn",
			createListing: "📝 Đăng bán",
			buy: "💰 Mua từ P2P",
			cancel: "❌ Hủy listing",
		};
		return labels[type] || type;
	};

	const getStatusColor = (status) => {
		const colors = {
			confirmed: "text-green-500",
			pending: "text-yellow-500",
			failed: "text-red-500",
		};
		return colors[status] || "text-gray-500";
	};

	const formatAmountDisplay = (amountWei) => {
		const n = Number(formatAmount(amountWei));
		if (!Number.isFinite(n)) return "0";
		return new Intl.NumberFormat("en-US", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 6,
		}).format(n);
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-3xl font-bold text-white">📜 Lịch sử giao dịch</h1>
				<button
					onClick={loadTransactions}
					className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
				>
					🔄 Refresh
				</button>
			</div>

			{/* Filters */}
			<div className="flex gap-2 mb-6 flex-wrap">
				{["all", "buyFromExchange", "createListing", "buy"].map((type) => (
					<button
						key={type}
						onClick={() => setFilter(type)}
						className={`px-4 py-2 rounded-lg transition ${
							filter === type
								? "bg-blue-500 text-white"
								: "bg-gray-700 text-gray-300 hover:bg-gray-600"
						}`}
					>
						{type === "all" ? "Tất cả" : getTypeLabel(type)}
					</button>
				))}
			</div>

			{/* Transactions Table */}
			{loading ? (
				<div className="text-center text-gray-400 py-8">
					<div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
					<p className="mt-2">Đang tải...</p>
				</div>
			) : transactions.length === 0 ? (
				<div className="text-center text-gray-400 py-12">
					<p className="text-xl">📭 Chưa có giao dịch nào</p>
					<p className="mt-2 text-sm">Mua coin hoặc tạo listing để bắt đầu!</p>
				</div>
			) : (
				<div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-gray-700">
								<tr>
									<th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Loại</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Coin</th>
									<th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Số lượng</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Trạng thái</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Thời gian</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">TX Hash</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700">
								{transactions.map((tx) => (
									<tr key={tx._id} className="hover:bg-gray-750 transition">
										<td className="px-4 py-3 text-sm">{getTypeLabel(tx.type)}</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<span className="font-semibold text-white">{tx.coinSymbol}</span>
												<span className="text-xs text-gray-400">{tx.coinName}</span>
											</div>
										</td>
										<td className="px-4 py-3 text-right font-mono">
											{formatAmountDisplay(tx.amount)}
										</td>
										<td className="px-4 py-3">
											<span className={`text-sm font-semibold ${getStatusColor(tx.status)}`}>
												{tx.status}
											</span>
										</td>
										<td className="px-4 py-3 text-sm text-gray-400">
											{new Date(tx.createdAt).toLocaleString("vi-VN")}
										</td>
										<td className="px-4 py-3">
											{getExplorerUrl(tx.txHash) ? (
												<a
													href={getExplorerUrl(tx.txHash)}
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-400 hover:text-blue-300 text-xs font-mono"
												>
													{tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
												</a>
											) : (
												<span className="text-gray-500 text-xs font-mono" title={tx.txHash}>
													{tx.txHash.slice(0, 10)}... (Local)
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
};

export default TransactionHistory;
