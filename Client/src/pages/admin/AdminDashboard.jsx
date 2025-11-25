import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await adminAPI.getUsers();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await adminAPI.deleteUser(id);
        toast.success("User deleted");
        loadUsers();
      } catch (error) {
        toast.error("Failed to delete user");
      }
    }
  };

  const handleBanToggle = async (user) => {
    const action = user.isBanned ? 'unban' : 'ban';
    if (window.confirm(`Are you sure you want to ${action} this user?`)) {
      try {
        await adminAPI.toggleBanUser(user._id, !user.isBanned);
        toast.success(`User ${action}ned successfully`);
        loadUsers();
      } catch (error) {
        toast.error(`Failed to ${action} user`);
      }
    }
  };

  if (loading) return <div className="p-8 text-center dark:text-white">Loading...</div>;

  return (
    <div className="p-8 dark:text-white">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Username</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase hidden md:table-cell">Wallet</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map(user => (
              <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 dark:text-white">{user.username}</td>
                <td className="px-6 py-4 dark:text-white">
                  <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 dark:text-white">
                  <span className={`px-2 py-1 rounded text-xs ${user.isBanned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {user.isBanned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 dark:text-white font-mono text-sm hidden md:table-cell">{user.walletAddress || '-'}</td>
                <td className="px-6 py-4 space-x-2 whitespace-nowrap">
                  <Link 
                    to={`/admin/users/${user._id}`} 
                    className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    View
                  </Link>
                  {user.role !== 'admin' && (
                    <button 
                      onClick={() => handleBanToggle(user)} 
                      className={`px-3 py-1 text-sm rounded text-white transition-colors ${user.isBanned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {user.isBanned ? 'Unban' : 'Ban'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
