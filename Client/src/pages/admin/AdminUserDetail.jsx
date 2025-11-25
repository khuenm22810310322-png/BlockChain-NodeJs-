import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI, marketAPI } from '../../services/api';
import { toast } from 'react-toastify';
import useTopCoins from '../../hooks/useTopCoins';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { coins } = useTopCoins();
  const { isConnected, connect } = useWallet();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState({});

  useEffect(() => {
    loadData();
    loadTokens();
  }, [id]);

  const loadTokens = async () => {
    try {
      const t = await marketAPI.getTokens();
      setTokens(t || {});
    } catch (e) {
      console.error("Failed to fetch tokens", e);
    }
  };

  const loadData = async () => {
    try {
      const data = await adminAPI.getUserDetails(id);
      setUser(data.user);
      setTransactions(data.transactions);
    } catch (error) {
      toast.error("Failed to load user details");
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (rawAmount) => {
    if (rawAmount === null || rawAmount === undefined) return "0";
    const str = rawAmount.toString();

    // Heuristic: if it's a big integer (>= 15 digits) assume Wei
    // 1 ETH = 10^18 (19 digits). 0.001 ETH = 10^15 (16 digits).
    const digitsOnly = str.replace(/[^0-9]/g, "");
    const looksLikeWei = digitsOnly.length >= 15 && !str.includes(".");

    try {
      if (looksLikeWei) {
        return ethers.formatUnits(str, 18);
      }
      return str;
    } catch {
      return str;
    }
  };

  const handleBanToggle = async () => {
    const action = user.isBanned ? 'unban' : 'ban';
    if (window.confirm(`Are you sure you want to ${action} this user?`)) {
      try {
        await adminAPI.toggleBanUser(user._id, !user.isBanned);
        toast.success(`User ${action}ned successfully`);
        loadData();
      } catch (error) {
        toast.error(`Failed to ${action} user`);
      }
    }
  };

  if (loading) return <div className="p-8 text-center dark:text-white">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <button onClick={() => navigate('/admin')} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">← Back to Dashboard</button>
        {user && user.role !== 'admin' && (
          <button 
            onClick={handleBanToggle}
            className={`px-4 py-2 rounded text-white ${user.isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {user.isBanned ? 'Unban User' : 'Ban User'}
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 dark:text-white">User Info</h2>
          <div className="space-y-2 dark:text-gray-300">
            <p><span className="font-semibold">Username:</span> {user.username}</p>
            <p><span className="font-semibold">Role:</span> {user.role}</p>
            <p><span className="font-semibold">Status:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-xs ${user.isBanned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                {user.isBanned ? 'Banned' : 'Active'}
              </span>
            </p>
            <p><span className="font-semibold">Wallet:</span> {user.walletAddress || 'Not linked'}</p>
            <p><span className="font-semibold">ID:</span> {user._id}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 dark:text-white">Portfolio Summary</h2>
          <div className="space-y-2 dark:text-gray-300">
             <p className="mb-2">Portfolio Items: {user.portfolio ? Object.keys(user.portfolio).length : 0}</p>
             {user.portfolio && Object.keys(user.portfolio).length > 0 ? (
               <div className="overflow-x-auto max-h-60 overflow-y-auto">
                 <table className="min-w-full text-sm text-left">
                   <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                     <tr>
                       <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-300">Coin</th>
                       <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-300">Amount</th>
                       <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-300">Invested (USD)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                     {Object.entries(user.portfolio).map(([coinId, data]) => (
                       <tr key={coinId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                         <td className="px-3 py-2 font-medium">{coinId.toUpperCase()}</td>
                         <td className="px-3 py-2">{(Number(data.coins) || 0).toLocaleString()}</td>
                         <td className="px-3 py-2">${(Number(data.totalInvestment) || 0).toLocaleString()}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             ) : (
               <p className="text-sm text-gray-500 italic">No assets in portfolio</p>
             )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold dark:text-white">Transactions</h2>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Coin</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map(tx => (
              <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 dark:text-white text-sm">{new Date(tx.createdAt || tx._id).toLocaleString()}</td>
                <td className="px-6 py-4 dark:text-white text-sm">{tx.type}</td>
                <td className="px-6 py-4 dark:text-white text-sm">{tx.coinSymbol || tx.coinId}</td>
                <td className="px-6 py-4 dark:text-white text-sm">{formatAmount(tx.amount)}</td>
                <td className="px-6 py-4 dark:text-white text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${tx.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUserDetail;
