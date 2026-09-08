import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import ConfirmDialog from './ConfirmDialog';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const menuRef = useRef(null);

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = () => {
    setShowLogout(false);
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>

          <div className="hidden md:flex items-center gap-8 font-medium">
            {user && (
              <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="hover:text-[var(--color-accent)] transition-colors">Dashboard</Link>
            )}
            <Link to="/browse" className="hover:text-[var(--color-accent)] transition-colors">Browse Cars</Link>
            {user?.role === 'admin' ? (
              <Link to="/admin?tab=messages" className="hover:text-[var(--color-accent)] transition-colors">Messages</Link>
            ) : (
              <Link to="/contact" className="hover:text-[var(--color-accent)] transition-colors">Contact</Link>
            )}
            {user && user.role !== 'admin' && (
              <Link to="/my-bookings" className="hover:text-[var(--color-accent)] transition-colors">My Bookings</Link>
            )}
          </div>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-[var(--color-border)] hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-bold text-xs">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-medium">{user.name?.split(' ')[0]}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden z-50">
                  {user.role !== 'admin' && (
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-gray-50">My Profile</Link>
                  )}
                  <button onClick={() => setShowLogout(true)} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 border-t border-[var(--color-border)]">
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="px-4 py-2 font-medium hover:text-[var(--color-accent)] transition-colors">Log in</Link>
              <Link to="/signup" className="px-5 py-2 rounded-full bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors">Sign up</Link>
            </div>
          )}
        </div>
      </nav>

      <ConfirmDialog
        open={showLogout}
        title="Log out"
        message="Are you sure you want to log out? You'll need to sign in again to access your bookings."
        confirmLabel="Log out"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </>
  );
};

export default Navbar;
