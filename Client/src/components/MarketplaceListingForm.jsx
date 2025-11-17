import { useState } from "react";
import api from "../services/api";
import { useWallet } from "../context/WalletContext";

export default function MarketplaceListingForm({ onCreated }) {
	const [token, setToken] = useState("");
	const [paymentToken, setPaymentToken] = useState("");
	const [amount, setAmount] = useState("");
	const [pricePerUnit, setPricePerUnit] = useState("");
	const [message, setMessage] = useState("");
	const { isConnected, connect } = useWallet();

	const submit = async () => {
		try {
			setMessage("Đang gửi...");
			const res = await api.post("/api/marketplace/listings", {
				token,
				paymentToken: paymentToken || undefined,
				amount,
				pricePerUnit,
			});
			setMessage(`Listing created: ${res.data.listingId || res.data.txHash}`);
			onCreated && onCreated();
		} catch (e) {
			setMessage(e.response?.data?.error || e.message);
		}
	};

	return (
		<div className="space-y-3">
			<h3 className="text-lg font-semibold">Đăng bán</h3>
			<input className="w-full border rounded px-3 py-2" placeholder="Token address" value={token} onChange={(e) => setToken(e.target.value)} />
			<input className="w-full border rounded px-3 py-2" placeholder="Payment token (0x0 for native)" value={paymentToken} onChange={(e) => setPaymentToken(e.target.value)} />
			<input className="w-full border rounded px-3 py-2" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
			<input className="w-full border rounded px-3 py-2" placeholder="Price per unit" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} />
			{!isConnected ? (
				<button onClick={connect} className="px-4 py-2 bg-blue-600 text-white rounded">
					Kết nối ví để đăng listing
				</button>
			) : (
				<button onClick={submit} disabled={!token || !amount || !pricePerUnit} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">
					Tạo listing
				</button>
			)}
			{message && <div className="text-sm">{message}</div>}
		</div>
	);
}
