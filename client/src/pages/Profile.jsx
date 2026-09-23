import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccountNav from '../components/AccountNav';
import ConfirmDialog from '../components/ConfirmDialog';
import { PasswordField } from '../components/AuthLayout';

const isStrongPassword = (pw) =>
  pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

const Profile = () => {
  const { user, login } = useAuth();
  const authenticated = Boolean(user);
  const userId = user?._id || user?.id;
  const [form, setForm] = useState({ name: '', email: '', phone: '', licenseNumber: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const canSave = loadStatus === 'ready';

  useEffect(() => {
    if (!authenticated) return;
    let active = true;

    const loadProfile = async () => {
      try {
        const data = await api.getMe();
        if (!active) return;
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          licenseNumber: data.licenseNumber || '',
        });
        setLoadStatus('ready');
      } catch (err) {
        if (!active) return;
        setLoadError(err.message || 'Please check your connection and try again.');
        setLoadStatus('error');
      }
    };

    loadProfile();
    return () => { active = false; };
  }, [authenticated, userId, reloadKey]);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    if (!canSave || savingProfile) return;
    setProfileMsg(null);
    if (!form.name.trim()) {
      setProfileMsg({ type: 'error', text: 'Please enter your full name.' });
      return;
    }
    setShowProfileConfirm(true);
  };

  const handleProfileSave = async () => {
    setShowProfileConfirm(false);
    if (!canSave || savingProfile || !form.name.trim()) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await api.updateProfile({ ...form, name: form.name.trim(), email: user.email });
      login({ ...user, name: updated.name, email: updated.email }, localStorage.getItem('token'));
      setForm((current) => ({
        name: updated.name ?? current.name.trim(),
        email: updated.email ?? current.email,
        phone: updated.phone ?? current.phone,
        licenseNumber: updated.licenseNumber ?? current.licenseNumber,
      }));
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Unable to save your profile. Please try again.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!canSave || savingPassword) return;
    setPasswordMsg(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: "New passwords don't match." });
      return;
    }
    if (!isStrongPassword(passwordForm.newPassword)) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters with an uppercase letter, number, and special character' });
      return;
    }
    setShowPasswordConfirm(true);
  };

  const handlePasswordSave = async () => {
    setShowPasswordConfirm(false);
    if (!canSave || savingPassword) return;
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMsg({ type: 'success', text: 'Password changed.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Unable to change your password. Please try again.' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} replace />;

  return (
    <div className="bg-[#f7f7f2] text-[#18221f]">
      <div className="page-shell pb-20 pt-6 sm:pt-8">
        <AccountNav />
        <header className="py-9 sm:py-12">
          <p className="eyebrow mb-4">Your account, your way</p>
          <h1 className="page-title">My profile.</h1>
          <p className="page-intro mt-4">A few details now. A smoother start to your next journey.</p>
        </header>

        {loadStatus === 'loading' && <p className="mb-6 text-sm text-[#64716a]" role="status">Loading your profile...</p>}
        {loadStatus === 'error' && (
          <div className="notice-error mb-6">
            <div role="alert">
              <p className="font-semibold">We couldn't load your profile.</p>
              <p className="mt-2 text-sm">{loadError} Changes are disabled until your details load.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoadStatus('loading');
                setLoadError('');
                setReloadKey((current) => current + 1);
              }}
              className="btn-secondary mt-4"
            >
              Try again
            </button>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
          <aside className="order-2 min-w-0 rounded-[24px] bg-[#18221f] p-7 text-white lg:order-1">
            <div aria-hidden="true" className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl font-semibold">
              {user.name?.trim()?.[0]?.toUpperCase()}
            </div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">Your RoadWheels account</p>
            <h2 className="break-words text-2xl font-semibold tracking-tight">{user.name}</h2>
            <p className="mt-2 break-words text-sm leading-relaxed text-white/70">{user.email}</p>
            <div className="mt-7 border-t border-white/15 pt-6">
              <p className="text-sm leading-relaxed text-white/70">Keep your contact and driver's license details up to date, all in one place.</p>
              <Link to="/contact" className="mt-6 inline-block text-sm font-medium underline decoration-white/40 underline-offset-4 hover:decoration-white">Need a hand? Contact us</Link>
            </div>
          </aside>

          <div className="order-1 min-w-0 space-y-6 lg:order-2">
            <section aria-labelledby="profile-details-title" className="panel p-6 sm:p-8">
              <p className="eyebrow mb-3">01 / Personal details</p>
              <h2 id="profile-details-title" className="text-2xl font-semibold tracking-tight">The essentials.</h2>
              <p className="mt-2 mb-7 text-sm leading-relaxed text-[#64716a]">Your name is required. Phone and license details are optional.</p>
              <form onSubmit={handleProfileSubmit} aria-busy={loadStatus === 'loading' || savingProfile}>
                <fieldset disabled={!canSave || savingProfile} className="min-w-0 space-y-6 disabled:opacity-60">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="profile-name" className="field-label">Full name</label>
                      <input
                        id="profile-name"
                        name="name"
                        required
                        autoComplete="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="profile-email" className="field-label">Email address</label>
                      <input
                        id="profile-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        disabled
                        aria-describedby="profile-email-hint"
                        className="input-field cursor-not-allowed bg-[#f7f7f2] text-[#64716a]"
                      />
                      <p id="profile-email-hint" className="mt-2 text-xs leading-relaxed text-[#64716a]">Your login email cannot be changed.</p>
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="profile-phone" className="field-label">Phone number</label>
                      <input
                        id="profile-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="profile-license" className="field-label">Driver's license number</label>
                      <input
                        id="profile-license"
                        name="licenseNumber"
                        autoComplete="off"
                        value={form.licenseNumber}
                        onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  {profileMsg && (
                    <p className={profileMsg.type === 'success' ? 'notice-success' : 'notice-error'} role={profileMsg.type === 'success' ? 'status' : 'alert'}>{profileMsg.text}</p>
                  )}
                  <div className="border-t border-[#e4e6df] pt-5">
                    <button type="submit" disabled={!canSave || savingProfile} className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">
                      {savingProfile ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>

            <section aria-labelledby="profile-password-title" className="panel p-6 sm:p-8">
              <p className="eyebrow mb-3">02 / Account security</p>
              <h2 id="profile-password-title" className="text-2xl font-semibold tracking-tight">Change your password.</h2>
              <p className="mt-2 mb-7 text-sm leading-relaxed text-[#64716a]">Choose a strong password you don't use elsewhere.</p>
              <form onSubmit={handlePasswordSubmit} aria-busy={loadStatus === 'loading' || savingPassword}>
                <fieldset disabled={!canSave || savingPassword} className="min-w-0 space-y-5 disabled:opacity-60">
                  <PasswordField
                    id="profile-current-password"
                    label="Current password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <PasswordField
                      id="profile-new-password"
                      label="New password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      description="At least 8 characters, including an uppercase letter, a number, and a special character."
                    />
                    <PasswordField
                      id="profile-confirm-password"
                      label="Confirm new password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                  </div>
                  {passwordMsg && (
                    <p className={passwordMsg.type === 'success' ? 'notice-success' : 'notice-error'} role={passwordMsg.type === 'success' ? 'status' : 'alert'}>{passwordMsg.text}</p>
                  )}
                  <div className="border-t border-[#e4e6df] pt-5">
                    <button type="submit" disabled={!canSave || savingPassword} className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">
                      {savingPassword ? 'Updating...' : 'Update password'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
          </div>
        </div>

        <ConfirmDialog
          open={showProfileConfirm}
          title="Update profile"
          message="Are you sure you want to save these changes to your profile?"
          confirmLabel="Yes, update"
          onConfirm={handleProfileSave}
          onCancel={() => setShowProfileConfirm(false)}
        />
        <ConfirmDialog
          open={showPasswordConfirm}
          title="Change password"
          message="Are you sure you want to change your password? You'll need to use the new password next time you log in."
          confirmLabel="Yes, change"
          onConfirm={handlePasswordSave}
          onCancel={() => setShowPasswordConfirm(false)}
        />
      </div>
    </div>
  );
};

export default Profile;
