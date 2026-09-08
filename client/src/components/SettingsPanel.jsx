import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from './ConfirmDialog';

const SettingsPanel = () => {
  const { user, login } = useAuth();
  const [profileForm, setProfileForm] = useState({ name: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  useEffect(() => {
    api.getMe().then((data) => setProfileForm({ name: data.name }));
  }, []);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    setShowProfileConfirm(true);
  };

  const handleProfileSave = async () => {
    setShowProfileConfirm(false);
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const updated = await api.updateProfile({ ...profileForm, email: user.email });
      login({ ...user, name: updated.name, email: updated.email }, localStorage.getItem('token'));
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: "New passwords don't match." });
      return;
    }

    setShowPasswordConfirm(true);
  };

  const handlePasswordSave = async () => {
    setShowPasswordConfirm(false);
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMsg({ type: 'success', text: 'Password changed.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile card */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-bold text-xl">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-lg">Profile</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Update your admin account details</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Full name</label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 bg-gray-50 text-[var(--color-text-muted)] cursor-not-allowed"
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Email cannot be changed — it's used for login.</p>
          </div>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="px-6 py-2.5 rounded-full bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            {profileSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password card */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1">Change Password</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Choose a strong password you don't use elsewhere</p>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Current password</label>
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm new password</label>
              <input
                type="password"
                required
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {passwordMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={passwordSaving}
            className="px-6 py-2.5 rounded-full bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
          >
            {passwordSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={showProfileConfirm}
        title="Update Profile"
        message={`Are you sure you want to update your name to "${profileForm.name}"?`}
        confirmLabel="Yes, update"
        onConfirm={handleProfileSave}
        onCancel={() => setShowProfileConfirm(false)}
      />

      <ConfirmDialog
        open={showPasswordConfirm}
        title="Change Password"
        message="Are you sure you want to change your password? You'll need to use the new password next time you log in."
        confirmLabel="Yes, change"
        onConfirm={handlePasswordSave}
        onCancel={() => setShowPasswordConfirm(false)}
      />
    </div>
  );
};

export default SettingsPanel;
