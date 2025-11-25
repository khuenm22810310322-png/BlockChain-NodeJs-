import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { useState } from "react";
import DepositModal from "../components/DepositModal";

const Profile = () => {
	const { user, isAuthenticated, fetchProfile } = useAuth();
	const { account, isConnected, connect, disconnect, error } = useWallet();
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-24">
            <DepositModal 
                isOpen={isDepositModalOpen} 
                onClose={() => setIsDepositModalOpen(false)} 
                onSuccess={() => fetchProfile()} 
            />
			<div className="max-w-4xl mx-auto space-y-6">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
					Thông tin cá nhân
				</h1>

				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Tài khoản
					</p>
					{isAuthenticated && user ? (
						<div className="text-lg font-medium text-gray-900 dark:text-gray-100">
							{user.username || user.email || "User"}
						</div>
					) : (
						<div className="text-red-500">
							Bạn chưa đăng nhập tài khoản ứng dụng.
						</div>
					)}
				</div>

				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								Ví nội bộ (App Balance)
							</p>
							<div className="text-2xl font-bold text-green-600 dark:text-green-400">
								${user?.fiatBalance?.toFixed(2) || "0.00"}
							</div>
						</div>
						<button
							onClick={() => setIsDepositModalOpen(true)}
							className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-medium"
						>
							Nạp tiền
						</button>
					</div>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Dùng để mua coin nhanh chóng mà không cần qua cổng thanh toán.
					</p>
				</div>

				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-gray-500 dark:text-gray-400">
								Wallet (MetaMask)
							</p>
							{isConnected ? (
								<div className="text-lg font-medium break-all text-gray-900 dark:text-gray-100">
									{account}
								</div>
							) : (
								<div className="text-sm text-gray-600 dark:text-gray-400">
									Chưa kết nối ví
								</div>
							)}
						</div>
						<div className="flex gap-2">
							{isConnected ? (
								<button
									onClick={disconnect}
									className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
								>
									Ngắt kết nối
								</button>
							) : (
								<button
									onClick={connect}
									className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
								>
									Kết nối MetaMask
								</button>
							)}
						</div>
					</div>
					{error && (
						<div className="text-sm text-red-500">
							{error}
						</div>
					)}
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Bạn chỉ có thể mua/bán trên marketplace khi đã kết nối ví.
					</p>
				</div>
			</div>
		</div>
	);
};

export default Profile;
