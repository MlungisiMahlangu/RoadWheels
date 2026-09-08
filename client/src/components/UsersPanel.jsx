import { useState, useEffect } from 'react';
import { api } from '../services/api';
import ConfirmDialog from './ConfirmDialog';

const UsersPanel = ({ bookings }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [msg, setMsg] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    try {
      await api.toggleUserSuspend(suspendTarget);
      setSuspendTarget(null);
      fetchUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const targetUser = users.find((u) => u._id === suspendTarget);
  const nonAdminUsers = users.filter((u) => u.role !== 'admin');

  const userBookings = (userId) => bookings.filter((b) => b.user?._id === userId).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-text-muted)]">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-3 border-gray-200 border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-gray-50 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Bookings</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-[var(--color-border)] hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${
                      u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm">{userBookings(u._id)}</td>
                  <td className="px-5 py-3">
                    {u.isSuspended ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">Suspended</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Active</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => setSuspendTarget(u._id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          u.isSuspended
                            ? 'border-green-200 text-green-700 hover:bg-green-50'
                            : 'border-red-200 text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!suspendTarget}
        title={targetUser?.isSuspended ? 'Unsuspend User' : 'Suspend User'}
        message={
          targetUser?.isSuspended
            ? `Unsuspend ${targetUser.name}? They will be able to log in again.`
            : `Suspend ${targetUser?.name}? They will be blocked from logging in until unsuspended.`
        }
        confirmLabel={targetUser?.isSuspended ? 'Unsuspend' : 'Suspend'}
        variant={targetUser?.isSuspended ? 'default' : 'danger'}
        onConfirm={handleSuspend}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  );
};

export default UsersPanel;
