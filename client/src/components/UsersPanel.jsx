import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import ConfirmDialog from './ConfirmDialog';

const UsersPanel = ({ bookings }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspending, setSuspending] = useState(false);
  const suspendInFlight = useRef(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let current = true;
    const loadUsers = async () => {
      try {
        const data = await api.getUsers();
        if (current) setUsers(data);
      } catch (err) {
        if (current) setFetchError(err.message || 'Unable to load users. Please try again.');
      } finally {
        if (current) setLoading(false);
      }
    };
    loadUsers();
    return () => { current = false; };
  }, [loadAttempt]);

  const fetchUsers = () => {
    setLoading(true);
    setFetchError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  const handleSuspend = async () => {
    if (!suspendTarget || suspendInFlight.current) return;
    const userId = suspendTarget;
    suspendInFlight.current = true;
    setSuspending(true);
    setSuspendTarget(null);
    setMsg(null);
    try {
      await api.toggleUserSuspend(userId);
      fetchUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Unable to update this user. Please try again.' });
    } finally {
      suspendInFlight.current = false;
      setSuspending(false);
    }
  };

  const targetUser = users.find((u) => u._id === suspendTarget);

  const userBookings = (userId) => bookings.filter((b) => b.user?._id === userId).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {!loading && !fetchError && <p className="text-sm text-[var(--color-text-muted)]">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>}
        {suspending && <p role="status" className="text-sm text-[var(--color-text-muted)]">Updating user...</p>}
      </div>

      {msg && <div className="notice-error mb-4" role="alert">{msg.text}</div>}
      {fetchError && (
        <div className="notice-error mb-4 flex flex-wrap items-center justify-between gap-3" role="alert">
          <p>{fetchError}</p>
          <button type="button" onClick={fetchUsers} disabled={loading || suspending} className="btn-secondary">Retry loading users</button>
        </div>
      )}

      <div className="panel overflow-hidden" aria-busy={loading || suspending}>
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20" role="status">
            <div aria-hidden="true" className="w-7 h-7 border-3 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            <span className="text-sm text-[var(--color-text-muted)]">Loading users...</span>
          </div>
        ) : fetchError ? null : (
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
              {users.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">No registered users yet.</td></tr>}
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
                        type="button"
                        disabled={suspending}
                        onClick={() => { if (!suspendInFlight.current) setSuspendTarget(u._id); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
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
