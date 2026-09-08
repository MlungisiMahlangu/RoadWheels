import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(form);
      login(data.user, data.token);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[calc(100vh-72px)] flex items-center justify-end overflow-hidden">
      <img
        src="/whiteBMW.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/10 to-black/40" />

      <div className="relative w-full max-w-md mx-4 sm:mx-0 sm:mr-6 md:mr-20 my-6 max-h-[calc(100vh-120px)] overflow-y-auto bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl px-6 sm:px-8 py-8">
        <Link to="/" className="inline-block mb-6">
          <Logo className="h-9" />
        </Link>

        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-[var(--color-text-muted)] mb-6">Log in to book your next ride.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-[var(--color-border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[var(--color-accent)] font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;