import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";

const WalletContext = createContext(null);

export const useWallet = () => {
	const ctx = useContext(WalletContext);
	if (!ctx) throw new Error("useWallet must be used within WalletProvider");
	return ctx;
};

export const WalletProvider = ({ children }) => {
	const [account, setAccount] = useState(null);
	const [error, setError] = useState(null);
	const { user, isAuthenticated, updateUser } = useAuth();

	// Auto-connect wallet when user logs in with saved wallet address
	useEffect(() => {
		if (!window?.ethereum) return;
		
		const autoConnect = async () => {
			if (isAuthenticated && user?.walletAddress) {
				// Check if MetaMask has the saved wallet
				const accounts = await window.ethereum.request({ method: "eth_accounts" });
				const savedWallet = user.walletAddress.toLowerCase();
				
				if (accounts.some(acc => acc.toLowerCase() === savedWallet)) {
					setAccount(savedWallet);
				}
			}
		};
		
		autoConnect();
	}, [isAuthenticated, user]);

	const connect = async () => {
		if (!window?.ethereum) {
			setError("MetaMask not found");
			toast.error("MetaMask chưa được cài đặt!");
			return;
		}
		
		if (!isAuthenticated) {
			toast.error("Vui lòng đăng nhập trước khi kết nối ví!");
			return;
		}
		
		try {
			setError(null);
			const accounts = await window.ethereum.request({
				method: "eth_requestAccounts",
			});
			const walletAddress = accounts[0].toLowerCase();
			
			// If user already has a wallet, warn them if they are changing it
			if (user?.walletAddress) {
				const savedWallet = user.walletAddress.toLowerCase();
				if (walletAddress !== savedWallet) {
					const confirmChange = window.confirm(
						`Tài khoản của bạn đang liên kết với ví: ${savedWallet.substring(0, 6)}...${savedWallet.substring(savedWallet.length - 4)}\n` +
						`Bạn có chắc chắn muốn đổi sang ví mới: ${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)} không?`
					);
					
					if (!confirmChange) {
						toast.info("Đã hủy thay đổi ví.");
						return;
					}
				}
			}
			
			setAccount(walletAddress);

			// Save wallet address to backend
			try {
				const response = await api.put("/user/wallet", { walletAddress });
				
				// Update user context with new wallet address
				const updatedUser = { ...user, walletAddress };
				updateUser(updatedUser);
				
				toast.success("Ví đã được kết nối thành công!");
				console.log("Wallet address synced to backend");
			} catch (err) {
				console.error("Could not sync wallet address:", err);
				const errorMsg = err.response?.data?.error || "Không thể lưu địa chỉ ví. Vui lòng thử lại!";
				toast.error(errorMsg);
				// If backend sync fails, disconnect locally to maintain consistency
				setAccount(null);
			}
		} catch (e) {
			if (e.code === 4001) {
				toast.warning("Bạn đã từ chối kết nối ví");
			} else {
				toast.error("Không thể kết nối ví: " + e.message);
			}
			setError(e.message || "Failed to connect wallet");
		}
	};

	const disconnect = () => {
		setAccount(null);
	};

	// Listen for account changes in MetaMask
	useEffect(() => {
		if (!window?.ethereum) return;

		const handleAccountsChanged = (accounts) => {
			if (accounts.length === 0) {
				// User disconnected wallet
				setAccount(null);
				toast.warning("Ví đã ngắt kết nối");
			} else {
				const newAddress = accounts[0].toLowerCase();
				
				// Check if new address matches saved wallet
				if (user?.walletAddress) {
					const savedWallet = user.walletAddress.toLowerCase();
					if (newAddress !== savedWallet) {
						setAccount(null);
						toast.error(`Bạn đã chuyển sang ví khác!\nTài khoản này chỉ có thể dùng với ví ${savedWallet.substring(0, 10)}...`);
						return;
					}
				}
				
				setAccount(newAddress);
			}
		};

		window.ethereum.on('accountsChanged', handleAccountsChanged);

		return () => {
			window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
		};
	}, [user]);

	return (
		<WalletContext.Provider
			value={{
				account,
				isConnected: Boolean(account),
				connect,
				disconnect,
				error,
			}}
		>
			{children}
		</WalletContext.Provider>
	);
};
