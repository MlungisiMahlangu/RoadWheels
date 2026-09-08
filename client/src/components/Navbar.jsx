import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import ConfirmDialog from './ConfirmDialog';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    setMobileOpen(false);
    logout();
    navigate('/');
  };

  // Shared between desktop links and the mobile hamburger menu
  const navLinks = [
    ...(user ? [{ to: user.role === 'admin' ? '/admin' : '/dashboard', label: 'Dashboard' }] : []),
    { to: '/browse', label: 'Browse Cars' },
    user?.role === 'admin'
      ? { to: '/admin?tab=messages', label: 'Messages' }
      : { to: '/contact', label: 'Contact' },
    ...(user && user.role !== 'admin' ? [{ to: '/my-bookings', label: 'My Bookings' }] : []),
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8 font-medium">
            {navLinks.map((l) => (
              <Link key={l.label} to={l.to} className="hover:text-[var(--color-accent)] transition-colors">{l.label}</Link>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => { setMenuOpen((o) => !o); setMobileOpen(false); }}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-[var(--color-border)] hover:bg-gray-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-bold text-xs">
                    {user.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">{user.name?.split(' ')[0]}</span>
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
              <div className="flex items-center gap-3">
                <Link to="/login" className="hidden sm:block px-4 py-2 font-medium hover:text-[var(--color-accent)] transition-colors">Log in</Link>
                <Link to="/signup" className="px-4 py-2 rounded-full bg-[var(--color-accent)] text-white font-medium text-sm sm:text-base hover:bg-[var(--color-accent-hover)] transition-colors">Sign up</Link>
              </div>
            )}

            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
            <div className="absolute top-full left-0 right-0 z-50 md:hidden bg-white border-b border-[var(--color-border)] shadow-lg">
              <div className="px-4 py-3 flex flex-col">
                {navLinks.map((l) => (
                  <Link
                    key={l.label}
                    to={l.to}
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-3 rounded-lg font-medium hover:bg-gray-50 hover:text-[var(--color-accent)] transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
                {!user && (
                  <div className="flex gap-3 pt-3 mt-2 border-t border-[var(--color-border)]">
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2.5 rounded-full border border-[var(--color-border)] font-medium text-sm hover:bg-gray-50 transition-colors">Log in</Link>
                    <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2.5 rounded-full bg-[var(--color-accent)] text-white font-medium text-sm hover:bg-[var(--color-accent-hover)] transition-colors">Sign up</Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
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
