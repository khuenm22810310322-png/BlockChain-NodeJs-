import { useState, useEffect } from 'react';
import api from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminAnalytics() {
  const [userStats, setUserStats] = useState(null);
  const [volumeData, setVolumeData] = useState([]);
  const [topCoins, setTopCoins] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, volumeRes, coinsRes] = await Promise.all([
          api.get('/admin/stats/users'),
          api.get('/admin/stats/volume'),
          api.get('/admin/stats/top-coins')
        ]);

        setUserStats(usersRes.data);
        setVolumeData(volumeRes.data);
        setTopCoins(coinsRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  if (!userStats) return <div className="text-white p-6">Loading analytics...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
      
      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm uppercase">Total Users</h3>
          <p className="text-3xl font-bold text-white mt-2">{userStats.totalUsers}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm uppercase">New Users (Today)</h3>
          <p className="text-3xl font-bold text-green-400 mt-2">{userStats.newUsersToday}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm uppercase">New Users (Week)</h3>
          <p className="text-3xl font-bold text-blue-400 mt-2">{userStats.newUsersWeek}</p>
        </div>
      </div>



      {/* Top Coins */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Top Coins (By Transaction Count)</h3>
        <div className="space-y-2">
          {topCoins.map((coin, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors">
              <span className="text-white font-medium flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center bg-gray-600 rounded-full text-xs">{index + 1}</span>
                {coin.name}
              </span>
              <span className="text-gray-300 font-mono">{coin.count} txs</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
