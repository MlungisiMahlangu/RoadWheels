import { useState, useEffect, useId } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from './ConfirmDialog';

const isStrongPassword = (pw) =>
  pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

const SettingsPanel = () => {
  const { user, login } = useAuth();
  const id = useId();
  const [profileForm, setProfileForm] = useState({ name: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    api.getMe()
      .then((data) => { if (current) setProfileForm({ name: data.name }); })
      .catch((err) => { if (current) setLoadError(err.message || 'Unable to load your account.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [attempt]);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (loading || loadError || profileSaving) return;
    if (!profileForm.name.trim()) {
      setProfileMsg({ type: 'error', text: 'Please enter your full name.' });
      return;
    }
    setShowProfileConfirm(true);
  };

  const handleProfileSave = async () => {
    setShowProfileConfirm(false);
    if (loading || loadError || profileSaving || !profileForm.name.trim()) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const updated = await api.updateProfile({ name: profileForm.name.trim(), email: user.email });
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
    if (!isStrongPassword(passwordForm.newPassword)) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters with an uppercase letter, number, and special character.' });
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
      {loading && <p role="status" className="text-sm text-[var(--color-text-muted)]">Loading account details…</p>}
      {loadError && <div className="notice-error" role="alert"><p>{loadError}</p><button type="button" className="btn-secondary mt-3" onClick={() => { setLoading(true); setLoadError(''); setAttempt((value) => value + 1); }}>Retry account details</button></div>}
      <div className="panel p-6">
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
            <label htmlFor={`${id}-name`} className="field-label">Full name</label>
            <input
              id={`${id}-name`}
              type="text"
              autoComplete="name"
              required
              disabled={loading || !!loadError || profileSaving}
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor={`${id}-email`} className="field-label">Email</label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              aria-describedby={`${id}-email-help`}
              value={user?.email || ''}
              disabled
              className="input-field cursor-not-allowed"
            />
            <p id={`${id}-email-help`} className="text-xs text-[var(--color-text-muted)] mt-1">Email cannot be changed — it's used for login.</p>
          </div>

          {profileMsg && (
            <p className={profileMsg.type === 'success' ? 'notice-success' : 'notice-error'} role={profileMsg.type === 'success' ? 'status' : 'alert'}>
              {profileMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !!loadError || profileSaving}
            className="btn-primary"
          >
            {profileSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password card */}
      <div className="panel p-6">
        <h2 className="font-bold text-lg mb-1">Change Password</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Choose a strong password you don't use elsewhere</p>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${id}-current-password`} className="field-label">Current password</label>
            <input
              id={`${id}-current-password`}
              type="password"
              autoComplete="current-password"
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${id}-new-password`} className="field-label">New password</label>
              <input
                id={`${id}-new-password`}
                type="password"
                autoComplete="new-password"
                aria-describedby={`${id}-password-requirements`}
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor={`${id}-confirm-password`} className="field-label">Confirm new password</label>
              <input
                id={`${id}-confirm-password`}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <p id={`${id}-password-requirements`} className="text-xs text-[var(--color-text-muted)]">At least 8 characters, including an uppercase letter, a number, and a special character.</p>

          {passwordMsg && (
            <p className={passwordMsg.type === 'success' ? 'notice-success' : 'notice-error'} role={passwordMsg.type === 'success' ? 'status' : 'alert'}>
              {passwordMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={passwordSaving}
            className="btn-primary"
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
