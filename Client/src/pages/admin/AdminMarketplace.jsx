import { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

export default function AdminMarketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3000/api/admin/marketplace/listings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setListings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleRemove = async (id) => {
    if (!window.confirm('Are you sure you want to remove this listing? Funds will be returned to the seller.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/admin/marketplace/listings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Listing removed successfully');
      fetchListings();
    } catch (err) {
      alert('Failed to remove listing: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="text-white p-6">Loading marketplace data...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Marketplace Management</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
        <table className="min-w-full text-white">
          <thead>
            <tr className="bg-gray-700 text-gray-300 text-sm uppercase">
              <th className="p-4 text-left">ID</th>
              <th className="p-4 text-left">Seller</th>
              <th className="p-4 text-left">Token</th>
              <th className="p-4 text-left">Amount</th>
              <th className="p-4 text-left">Price</th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-400">No active listings found</td>
              </tr>
            ) : (
              listings.map(lst => (
                <tr key={lst.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4">{lst.id}</td>
                  <td className="p-4 font-mono text-sm text-blue-400">{lst.seller.slice(0, 6)}...{lst.seller.slice(-4)}</td>
                  <td className="p-4 font-mono text-sm">{lst.token.slice(0, 6)}...</td>
                  <td className="p-4">{ethers.formatEther(lst.remainingAmount)}</td>
                  <td className="p-4">{ethers.formatEther(lst.pricePerUnit)}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleRemove(lst.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
