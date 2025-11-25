import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:3000/api/admin/audit-logs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Audit Logs</h1>
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <table className="min-w-full text-white">
          <thead>
            <tr className="bg-gray-700 text-gray-300 text-sm uppercase">
              <th className="p-4 text-left">Time</th>
              <th className="p-4 text-left">Admin</th>
              <th className="p-4 text-left">Action</th>
              <th className="p-4 text-left">Details</th>
              <th className="p-4 text-left">Target ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">No logs found</td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log._id} className="border-t border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-4 font-medium">{log.adminId?.username || 'Unknown'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.action.includes('DELETE') ? 'bg-red-900 text-red-200' :
                      log.action.includes('BAN') ? 'bg-orange-900 text-orange-200' :
                      'bg-blue-900 text-blue-200'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{log.details}</td>
                  <td className="p-4 font-mono text-xs text-gray-500">{log.targetId}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
