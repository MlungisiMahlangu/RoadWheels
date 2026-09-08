import { useState, useEffect } from 'react';
import { api } from '../services/api';

const UsersPanel = ({ bookings }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggle = async () => {
    await api.toggleUserSuspend(confirmTarget._id);
    setConfirmTarget(null);
    fetchUsers();
  };

  const bookingCount = (userId) => bookings.filter((b) => b.user?._id === userId).length;

  if (loading) return <p className="text-center py-16">Loading...</p>;

  return (
    <div>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>

      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Bookings</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t border-[var(--color-border)]">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-muted)]">{u.email}</td>
                <td className="px-5 py-3 text-sm capitalize">{u.role}</td>
                <td className="px-5 py-3 text-sm">{bookingCount(u._id)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    u.isSuspended ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {u.isSuspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => setConfirmTarget(u)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        u.isSuspended
                          ? 'border-green-200 text-green-700 hover:bg-green-50'
                          : 'border-red-200 text-red-600 hover:bg-red-50'
                      }`}
                    >
                      {u.isSuspended ? 'Reactivate' : 'Suspend'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold mb-2">{confirmTarget.isSuspended ? 'Reactivate' : 'Suspend'} {confirmTarget.name}?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              {confirmTarget.isSuspended ? 'They will be able to log in again.' : 'They will be blocked from logging in.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmTarget(null)} className="flex-1 py-2.5 rounded-full border border-[var(--color-border)] font-medium">Cancel</button>
              <button onClick={handleToggle} className="flex-1 py-2.5 rounded-full bg-[var(--color-accent)] text-white font-medium">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPanel;