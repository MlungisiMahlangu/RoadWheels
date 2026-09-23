import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import Icon from './Icon';
import ConfirmDialog from './ConfirmDialog';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const menuRef = useRef(null);
  const mobileRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'keydown' || !menuRef.current?.contains(event.target)) setMenuOpen(false);
      if (event.type === 'keydown') {
        setMobileOpen(false);
        if (mobileOpen) mobileRef.current?.focus();
        else menuRef.current?.querySelector('button')?.focus();
      }
    };
    if (menuOpen || mobileOpen) {
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', close);
    }
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menuOpen, mobileOpen]);

  const links = [
    { to: '/', label: 'Home' },
    { to: '/browse', label: 'Explore cars' },
    ...(user ? [{ to: user.role === 'admin' ? '/admin' : '/dashboard', label: 'Dashboard' }] : []),
    { to: '/contact', label: 'Contact' },
  ];
  const closeMenus = () => { setMenuOpen(false); setMobileOpen(false); };

  return (
    <>
      <header className="site-nav">
        <div className="nav-inner">
          <Link to="/" aria-label="RoadWheels home" onClick={closeMenus}><Logo className="h-7 sm:h-10" /></Link>
          <nav aria-label="Main navigation" className="nav-links">
            {links.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>)}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button className="flex items-center gap-2 rounded-full border border-[var(--color-border)] py-1.5 pl-1.5 pr-3 text-xs" aria-expanded={menuOpen} aria-controls="account-menu" aria-label="Open account menu" onClick={() => { setMenuOpen(!menuOpen); setMobileOpen(false); }}>
                  <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-soft)] font-semibold">{user.name?.[0]?.toUpperCase()}</span>
                  <span className="hidden sm:block max-w-24 truncate">{user.name?.split(' ')[0]}</span><Icon name="chevron-down" size={14} />
                </button>
                {menuOpen && <nav id="account-menu" aria-label="Account menu" className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-xl">
                  <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Your RoadWheels</p>
                  {(user.role === 'admin' ? [['/admin', 'grid', 'Admin dashboard']] : [['/dashboard', 'grid', 'Overview'], ['/my-bookings', 'calendar', 'My bookings'], ['/profile', 'user', 'My profile']]).map(([to, icon, label]) => <Link key={to} to={to} onClick={closeMenus} className="flex items-center gap-3 rounded-lg px-3 py-3 text-xs hover:bg-[var(--color-soft)]"><Icon name={icon} size={16} />{label}</Link>)}
                  <button className="mt-1 flex w-full items-center gap-3 border-t border-[var(--color-border)] px-3 py-3 text-xs text-red-700" onClick={() => { closeMenus(); setShowLogout(true); }}><Icon name="logout" size={16} />Log out</button>
                </nav>}
              </div>
            ) : <>
              <Link to="/login" className="hidden sm:inline text-xs font-medium hover:text-[var(--color-accent)]">Log in</Link>
              <Link to="/signup" className="btn-dark shrink-0 whitespace-nowrap !min-h-10 !px-3 sm:!px-5 !py-2.5 !text-[11px]">Get started <Icon name="arrow-up-right" size={14} className="hidden sm:block" /></Link>
            </>}
            <button ref={mobileRef} className="icon-button md:!hidden" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => { setMobileOpen(!mobileOpen); setMenuOpen(false); }}><Icon name={mobileOpen ? 'close' : 'menu'} size={18} /></button>
          </div>
        </div>
        {mobileOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-[var(--color-border)] bg-white px-5 py-4 md:hidden shadow-lg">
          {links.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/'} onClick={closeMenus} className={({ isActive }) => `block rounded-xl px-4 py-3.5 text-sm ${isActive ? 'bg-[var(--color-soft)] font-semibold' : ''}`}>{label}</NavLink>)}
          <Link to={user ? user.role === 'admin' ? '/admin' : '/my-bookings' : '/login'} onClick={closeMenus} className="btn-secondary mt-3 w-full">{user ? user.role === 'admin' ? 'Admin workspace' : 'My bookings' : 'Log in to your account'}</Link>
        </nav>}
      </header>
      <ConfirmDialog open={showLogout} title="Ready to log out?" message="Your bookings will be here when you return." confirmLabel="Log out" cancelLabel="Stay signed in" onCancel={() => setShowLogout(false)} onConfirm={() => { setShowLogout(false); logout(); navigate('/'); }} />
    </>
  );
}
