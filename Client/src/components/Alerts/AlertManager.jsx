import React, { useState, useEffect } from 'react';
import { alertsAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { useWallet } from '../../context/WalletContext';

const AlertManager = ({ coinId, coinSymbol, currentPrice }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    targetPrice: '',
    condition: 'above'
  });
  const { isConnected } = useWallet();

  useEffect(() => {
    if (isConnected) {
      loadAlerts();
    }
  }, [isConnected]);

  const loadAlerts = async () => {
    try {
      const data = await alertsAPI.getAll();
      // Filter for current coin if coinId is provided, else show all
      const filtered = coinId ? data.filter(a => a.coinId === coinId) : data;
      setAlerts(filtered);
    } catch (error) {
      console.error("Failed to load alerts", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.targetPrice) return;

    try {
      await alertsAPI.create({
        coinId,
        coinSymbol,
        targetPrice: parseFloat(formData.targetPrice),
        condition: formData.condition
      });
      toast.success("Alert set successfully!");
      setFormData({ targetPrice: '', condition: 'above' });
      setShowForm(false);
      loadAlerts();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to set alert");
    }
  };

  const handleDelete = async (id) => {
    try {
      await alertsAPI.delete(id);
      toast.info("Alert deleted");
      loadAlerts();
    } catch (error) {
      toast.error("Failed to delete alert");
    }
  };

  if (!isConnected) return null;

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold dark:text-white">Price Alerts</h3>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : '+ Set Alert'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Condition</label>
              <select 
                value={formData.condition}
                onChange={e => setFormData({...formData, condition: e.target.value})}
                className="w-full p-2 rounded border dark:bg-gray-600 dark:text-white dark:border-gray-500"
              >
                <option value="above">Price goes above</option>
                <option value="below">Price goes below</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-300 mb-1">Target Price ($)</label>
              <input 
                type="number" 
                step="any"
                value={formData.targetPrice}
                onChange={e => setFormData({...formData, targetPrice: e.target.value})}
                placeholder={currentPrice ? currentPrice.toString() : "0.00"}
                className="w-full p-2 rounded border dark:bg-gray-600 dark:text-white dark:border-gray-500"
                required
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Save
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No active alerts for this coin.</p>
        ) : (
          alerts.map(alert => (
            <div key={alert._id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded border-l-4 border-blue-500">
              <div>
                <p className="text-sm font-medium dark:text-white">
                  Target: <span className="font-bold">${alert.targetPrice}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-300">
                  Condition: {alert.condition === 'above' ? 'Above (Wait for pump)' : 'Below (Wait for dip)'}
                </p>
              </div>
              <button 
                onClick={() => handleDelete(alert._id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertManager;
