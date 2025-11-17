import { useState } from "react";
import { useActiveListings } from "../hooks/useMarketplace";
import { useWallet } from "../context/WalletContext";
import api from "../services/api";

export default function MarketplaceShop() {
	// Auto-refresh listings every 10 seconds for real-time updates
	const { data: listings, loading, error, refresh } = useActiveListings(10000);
	const [selected, setSelected] = useState(null);
	const [amount, setAmount] = useState("");
	const [useOracle, setUseOracle] = useState(false);
	const [message, setMessage] = useState("");
	const { isConnected, connect } = useWallet();

	const buy = async () => {
		try {
			setMessage("Processing...");
			const res = await api.post("/api/marketplace/buy", {
				listingId: selected,
				amount,
				useOracle,
			});
			setMessage(`Trade submitted: ${res.data.tradeId || res.data.txHash}`);
			refresh();
		} catch (e) {
			setMessage(e.response?.data?.error || e.message);
		}
	};

	return (
		<div className="space-y-4">
			<h2 className="text-xl font-semibold">Marketplace</h2>
			{loading && <div>Loading listings...</div>}
			{error && <div className="text-red-500">{error}</div>}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{listings.map((lst) => (
					<div
						key={lst.id}
						className={`border rounded-lg p-3 cursor-pointer ${selected === lst.id ? "border-blue-500" : "border-gray-200"}`}
						onClick={() => setSelected(lst.id)}
					>
						<div className="font-semibold">Listing #{lst.id}</div>
						<div className="text-sm text-gray-500 break-all">Seller: {lst.seller}</div>
						<div className="text-sm">Remaining: {lst.remainingAmount?.toString?.() ?? lst.remainingAmount}</div>
						<div className="text-sm">Price per unit: {lst.pricePerUnit?.toString?.() ?? lst.pricePerUnit}</div>
						<div className="text-sm">Payment: {lst.paymentToken}</div>
						<div className="text-sm">Status: {lst.status}</div>
					</div>
				))}
			</div>

			<div className="space-y-2">
				<label className="block text-sm">Amount</label>
				<input
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					className="w-full border rounded px-3 py-2"
					placeholder="Enter amount to buy"
				/>
				<label className="inline-flex items-center gap-2 text-sm">
					<input type="checkbox" checked={useOracle} onChange={(e) => setUseOracle(e.target.checked)} />
					Mua theo giá sàn (oracle)
				</label>
				{!isConnected ? (
					<button onClick={connect} className="px-4 py-2 bg-blue-600 text-white rounded">
						Kết nối ví để mua
					</button>
				) : (
					<button
						onClick={buy}
						disabled={!selected || !amount}
						className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
					>
						Mua
					</button>
				)}
			</div>
			{message && <div className="text-sm">{message}</div>}
		</div>
	);
}
