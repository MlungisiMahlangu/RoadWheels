import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { PasswordField } from '../components/AuthLayout';

const isStrongPassword = (pw) =>
  pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authDestination, setAuthDestination] = useState(null);
  const requestedFrom = location.state?.from;
  const from = typeof requestedFrom === 'string' && requestedFrom.startsWith('/')
    && !requestedFrom.startsWith('//') && !/[\\\p{Cc}]/u.test(requestedFrom)
    ? requestedFrom : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!form.name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!isStrongPassword(form.password)) {
      setError('Password must be at least 8 characters with an uppercase letter, number, and special character');
      return;
    }

    setLoading(true);
    try {
      const data = await api.signup({ ...form, name: form.name.trim() });
      const destination = data.user.role === 'admin' ? '/admin' : from || '/dashboard';
      setAuthDestination(destination);
      login(data.user, data.token);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (user) return <Navigate to={authDestination || (user.role === 'admin' ? '/admin' : '/dashboard')} replace />;

  return (
    <AuthLayout
      eyebrow="Make room for adventure"
      title="Let's get you moving."
      intro={from ? 'Create an account to continue where you left off.' : 'Create your account to book a car and keep your trips in one place.'}
      visualTitle="More road. More possibility."
      visualDescription="From everyday plans to a change of scenery. Your next journey is yours to choose."
    >
      <form onSubmit={handleSubmit} aria-busy={loading}>
        <fieldset disabled={loading} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="signup-name" className="field-label">Full name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="field-label">Email address</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            description="At least 8 characters, including an uppercase letter, a number, and a special character."
          />
          <PasswordField
            id="signup-confirm-password"
            label="Confirm password"
            autoComplete="new-password"
            minLength={8}
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          />
          {error && <p className="notice-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </fieldset>
      </form>
      <p className="mt-7 border-t border-[#e4e6df] pt-6 text-center text-sm text-[#64716a]">
        Already have an account?{' '}
        <Link to="/login" state={from ? { from } : undefined} className="font-semibold text-[#bc4c2a] underline-offset-4 hover:text-[#a43c1e] hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Signup;
