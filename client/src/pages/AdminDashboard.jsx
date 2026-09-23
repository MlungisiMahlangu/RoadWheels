import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import AddCarModal from '../components/AddCarModal';
import SettingsPanel from '../components/SettingsPanel';
import UsersPanel from '../components/UsersPanel';
import AvailabilityModal from '../components/AvailabilityModal';
import MessagesPanel from '../components/MessagesPanel';
import { today, formatDate } from '../services/rentalDates';
import Logo from '../components/Logo';
import Icon from '../components/Icon';

const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['active', 'cancelled'],
  active: ['completed'],
  completed: [],
  cancelled: [],
};

const PAGE_COPY = {
  overview: ['A clear view of the road.', 'Your fleet, your customers, and everything that keeps them moving.'],
  cars: ['A fleet with possibility.', 'Manage your listings, fine-tune the details, and keep availability up to date.'],
  bookings: ['Every journey, in order.', 'Review reservations and guide each booking from pick-up to return.'],
  users: ['The people behind the trips.', 'Manage customer accounts and keep your community moving.'],
  messages: ['Keep the conversation going.', 'Read and respond to customer enquiries. A little attention goes a long way.'],
  settings: ['Make yourself at home.', 'Keep your account details current and your access secure.'],
};

const STATUS_BADGE = {
  pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  active:    'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

const STATUS_DESCRIPTIONS = {
  pending:   'Awaiting admin approval',
  confirmed: 'Approved — car reserved for customer',
  active:    'Customer has picked up the car',
  completed: 'Car returned, booking finished',
  cancelled: 'Cancelled by admin or customer',
};

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: GridIcon },
  { key: 'cars', label: 'Manage Cars', icon: CarIcon },
  { key: 'bookings', label: 'Bookings', icon: CalendarIcon },
  { key: 'users', label: 'Users', icon: UsersIcon },
  { key: 'messages', label: 'Messages', icon: MessageIcon },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

function UsersIcon({ active }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[var(--color-accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3.13a4 4 0 00-3-3.87" />
    </svg>
  );
}

function MessageIcon({ active }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[var(--color-accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = NAV_ITEMS.some((item) => item.key === requestedTab) ? requestedTab : 'overview';
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchErrors, setFetchErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [mutationPending, setMutationPending] = useState(false);
  const mutationInFlight = useRef(false);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [editCar, setEditCar] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  const [availabilityCar, setAvailabilityCar] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const notifButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  const setTab = (nextTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', nextTab);
      return next;
    });
    setSidebarOpen(false);
    setNotifOpen(false);
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let current = true;
    Promise.allSettled([api.getCarsAdmin(), api.getAllBookings(), api.getContactMessages()])
      .then((results) => {
        if (!current) return;
        const errors = {};
        const setters = [setCars, setBookings, setMessages];
        ['cars', 'bookings', 'messages'].forEach((key, index) => {
          const result = results[index];
          if (result.status === 'fulfilled') setters[index](result.value);
          else errors[key] = result.reason?.message || 'Unable to load this data. Please try again.';
        });
        setFetchErrors(errors);
        setLoading(false);
      });
    return () => { current = false; };
  }, [user, attempt]);

  const fetchData = (background = false) => {
    if (user?.role !== 'admin') return;
    if (background !== true) setLoading(true);
    setFetchErrors({});
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setSidebarOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!sidebarOpen || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    const opener = menuButtonRef.current;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setSidebarOpen(false); }
      if (event.key === 'Tab') {
        const focusable = sidebarRef.current?.querySelectorAll('a[href], button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      opener?.focus();
    };
  }, [sidebarOpen, isMobile]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (event) => { if (!notifRef.current?.contains(event.target)) setNotifOpen(false); };
    const handleEscape = (event) => {
      if (event.key === 'Escape') { setNotifOpen(false); notifButtonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notifOpen]);

  const handleDeleteCar = async () => {
    if (user?.role !== 'admin' || !deleteTarget || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutationPending(true);
    setActionError('');
    setActionSuccess('');
    try {
      await api.deleteCar(deleteTarget);
      setActionSuccess('Car removed from listings. Existing bookings are unchanged.');
      fetchData();
    } catch (err) {
      setActionError('Failed to remove car: ' + err.message);
    } finally {
      setDeleteTarget(null);
      setMutationPending(false);
      mutationInFlight.current = false;
    }
  };

  const handleStatusChange = async () => {
    if (user?.role !== 'admin' || !statusChange || mutationInFlight.current) return;
    mutationInFlight.current = true;
    setMutationPending(true);
    setActionError('');
    setActionSuccess('');
    try {
      await api.updateBookingStatus(statusChange.id, statusChange.status);
      setActionSuccess('Booking status updated.');
    } catch (err) {
      setActionError('Failed to update status: ' + err.message);
    } finally {
      setStatusChange(null);
      setMutationPending(false);
      mutationInFlight.current = false;
      fetchData();
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/');
  };

  // Stats
  const activeCars = cars.filter((c) => c.isAvailable !== false).length;
  const unavailableCars = cars.length - activeCars;
  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;
  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const activeBookings = bookings.filter((b) => b.status === 'active').length;
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled').length;
  const unreadMessages = messages.filter((m) => !m.isRead).length;
  const totalRevenue = bookings.filter((b) => b.status !== 'cancelled').reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const completedRevenue = bookings.filter((b) => b.status === 'completed').reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  const pageTitle = NAV_ITEMS.find((n) => n.key === tab)?.label || 'Dashboard';
  const recentBookings = [...bookings].sort((a, b) => new Date(b.createdAt || b.pickupDate) - new Date(a.createdAt || a.pickupDate)).slice(0, 5);
  const tabUnavailable = (tab === 'cars' && fetchErrors.cars) || (['bookings', 'users'].includes(tab) && fetchErrors.bookings) || (tab === 'messages' && fetchErrors.messages);

  if (user?.role !== 'admin') return null;

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {sidebarOpen && <button type="button" tabIndex={-1} aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#18221f]/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside
        id="admin-navigation"
        ref={sidebarRef}
        inert={isMobile && !sidebarOpen}
        role={isMobile && sidebarOpen ? 'dialog' : undefined}
        aria-modal={isMobile && sidebarOpen ? true : undefined}
        aria-label="Administration navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto bg-[#18221f] text-white transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="border-b border-white/10 px-6 py-7">
          <div className="flex items-center justify-between gap-2">
            <Link to="/admin?tab=overview" onClick={() => setSidebarOpen(false)} aria-label="RoadWheels admin overview"><Logo className="h-auto w-40 text-white" /></Link>
            <button ref={closeButtonRef} type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 md:hidden"><Icon name="close" size={20} /></button>
          </div>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-white/50">The control room</p>
        </div>
        <nav aria-label="Admin sections" className="flex-1 space-y-2 px-4 py-7">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-current={tab === item.key ? 'page' : undefined}
              onClick={() => setTab(item.key)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${tab === item.key ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <item.icon active={tab === item.key} />
              <span>{item.label}</span>
              {item.key === 'bookings' && !loading && !fetchErrors.bookings && pendingBookings > 0 && <span className="ml-auto rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] text-white">{pendingBookings}</span>}
              {item.key === 'messages' && !loading && !fetchErrors.messages && unreadMessages > 0 && <span className="ml-auto rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] text-white">{unreadMessages}</span>}
            </button>
          ))}
        </nav>
        <div className="mx-4 mb-6 rounded-2xl border border-white/10 p-4">
          <Icon name="car" size={22} className="mb-3 text-[#e59474]" />
          <p className="text-sm font-medium">Good journeys start here.</p>
          <p className="mt-2 text-xs leading-relaxed text-white/50">A little care behind the scenes. A better experience on the road.</p>
        </div>
        <div className="space-y-1 border-t border-white/10 px-4 py-4">
          <Link to="/" className="flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"><ExternalIcon />View site</Link>
          <button type="button" onClick={() => { setSidebarOpen(false); setShowLogoutConfirm(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"><LogoutIcon />Log out</button>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-6 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">{user.name?.[0]?.toUpperCase()}</span>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="mt-1 truncate text-[11px] text-white/50">{user.email}</p></div>
        </div>
      </aside>

      <div inert={isMobile && sidebarOpen} className="flex-1 flex flex-col min-w-0 md:ml-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={menuButtonRef} type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="admin-navigation" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white md:hidden"><Icon name="menu" /></button>
            <p className="truncate text-sm"><span className="hidden text-[var(--color-text-muted)] sm:inline">Workspace <span className="mx-3 opacity-40">/</span></span><span className="font-medium">{pageTitle}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-[var(--color-text-muted)] lg:block">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <div className="relative" ref={notifRef}>
              <button ref={notifButtonRef} type="button" aria-label="Pending bookings notifications" aria-expanded={notifOpen} aria-controls="booking-notifications" onClick={() => setNotifOpen((open) => !open)} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-white transition-colors hover:border-[var(--color-accent)]">
                <Icon name="calendar" size={18} />
                {!loading && !fetchErrors.bookings && pendingBookings > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-medium text-white">{pendingBookings}</span>}
              </button>
              {notifOpen && (
                <div id="booking-notifications" className="absolute right-0 z-40 mt-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-xl">
                  <p className="border-b border-[var(--color-border)] px-5 py-4 text-sm font-semibold">Awaiting your approval</p>
                  {loading ? <p className="p-5 text-sm text-[var(--color-text-muted)]" role="status">Loading notifications…</p> : fetchErrors.bookings ? <div className="p-5 text-sm"><p>Notifications couldn’t be loaded.</p><button type="button" onClick={fetchData} className="mt-3 font-semibold text-[var(--color-accent)] hover:underline">Retry</button></div> : pendingBookings === 0 ? <p className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">You’re all caught up.</p> : bookings.filter((booking) => booking.status === 'pending').slice(0, 5).map((booking) => (
                    <button type="button" key={booking._id} onClick={() => setTab('bookings')} className="w-full border-b border-[var(--color-border)] px-5 py-4 text-left transition-colors last:border-0 hover:bg-[var(--color-bg)]"><p className="text-sm font-medium">{booking.user?.name || 'Unknown customer'}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{booking.car?.brand} {booking.car?.name} · R{booking.totalPrice?.toLocaleString()}</p></button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 pb-14 pt-9 sm:px-8 sm:pt-12 lg:px-10">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
            <div><p className="eyebrow mb-3">RoadWheels / {pageTitle}</p><h1 className="text-3xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-4xl xl:text-5xl">{PAGE_COPY[tab][0]}</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">{PAGE_COPY[tab][1]}</p></div>
            {tab === 'cars' && <button type="button" onClick={() => setAddCarOpen(true)} className="btn-primary inline-flex items-center gap-3"><Icon name="car" size={18} />Add a car</button>}
          </div>
          {actionError && <div className="notice-error mb-5 flex items-center justify-between gap-4" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError('')} aria-label="Dismiss error" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5"><Icon name="close" size={18} /></button></div>}
          {actionSuccess && <div className="notice-success mb-5 flex items-center justify-between gap-4" role="status"><span>{actionSuccess}</span><button type="button" onClick={() => setActionSuccess('')} aria-label="Dismiss confirmation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5"><Icon name="close" size={18} /></button></div>}
          {Object.keys(fetchErrors).length > 0 && (
            <div className="notice-error mb-6 flex flex-wrap items-center justify-between gap-4" role="alert">
              <div><p className="font-semibold">Some workspace data couldn’t be loaded.</p>{Object.entries(fetchErrors).map(([key, message]) => <p key={key} className="mt-1 text-sm"><span className="capitalize">{key}</span>: {message}</p>)}</div>
              <button type="button" onClick={fetchData} className="btn-secondary">Retry data</button>
            </div>
          )}
          {loading ? (
            <div className="panel flex items-center justify-center gap-3 py-24 text-sm text-[var(--color-text-muted)]" role="status"><span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />Loading your workspace…</div>
          ) : tabUnavailable ? (
            <div className="panel p-10 text-center"><Icon name="grid" size={30} className="mx-auto mb-5 text-[var(--color-accent)]" /><h2 className="text-xl font-semibold">This view is temporarily unavailable.</h2><p className="mt-3 text-sm text-[var(--color-text-muted)]">Retry the request above to see current data.</p></div>
          ) : tab === 'overview' ? (
            /* ─── OVERVIEW ─── */
            <div className="space-y-7">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Cars in the fleet" value={fetchErrors.cars ? '—' : cars.length} sub={fetchErrors.cars ? 'Fleet data unavailable' : `${activeCars} available · ${unavailableCars} unavailable`} icon="car" />
                <StatCard label="Pending bookings" value={fetchErrors.bookings ? '—' : pendingBookings} sub={fetchErrors.bookings ? 'Booking data unavailable' : 'Awaiting your approval'} icon="clock" accent />
                <StatCard label="Active rentals" value={fetchErrors.bookings ? '—' : activeBookings} sub={fetchErrors.bookings ? 'Booking data unavailable' : 'Out making memories'} icon="key" />
                <StatCard label="Booking value" value={fetchErrors.bookings ? '—' : `R${totalRevenue.toLocaleString()}`} sub={fetchErrors.bookings ? 'Booking data unavailable' : `R${completedRevenue.toLocaleString()} in completed trips`} icon="grid" />
              </div>

              <div className="panel overflow-hidden">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-6">
                  <div><p className="eyebrow mb-1">The latest activity</p><h2 className="text-xl font-semibold tracking-tight">Recent bookings</h2></div>
                  <button type="button" onClick={() => setTab('bookings')} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)] hover:underline">View all <Icon name="arrow-right" size={17} /></button>
                </div>
                {fetchErrors.bookings ? <p className="px-6 py-14 text-center text-sm text-[var(--color-text-muted)]">Recent bookings couldn’t be loaded. Retry data above.</p> : recentBookings.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">No bookings yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                    <thead className="bg-[var(--color-bg)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.14em]">
                      <tr>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Car</th>
                        <th className="px-6 py-4">Total</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((b) => (
                        <tr key={b._id} className="border-t border-[var(--color-border)]">
                          <td className="px-6 py-4 text-sm">{b.user?.name || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm">{b.car?.brand} {b.car?.name}</td>
                          <td className="px-6 py-4 text-sm font-medium">R{b.totalPrice?.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${STATUS_BADGE[b.status]}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="panel p-6 sm:p-7">
                  <h2 className="mb-6 text-xl font-semibold tracking-tight">The journey at a glance</h2>
                  {fetchErrors.bookings ? <p className="text-sm text-[var(--color-text-muted)]">Booking breakdown unavailable.</p> : (
                    <div className="space-y-4">
                      {Object.entries({ pending: pendingBookings, confirmed: confirmedBookings, active: activeBookings, completed: completedBookings, cancelled: cancelledBookings }).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-4">
                          <span className="w-20 text-xs capitalize text-[var(--color-text-muted)]">{status}</span>
                          <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]"><div className="h-full rounded-full bg-[var(--color-accent)]/70" style={{ width: `${bookings.length ? count / bookings.length * 100 : 0}%` }} /></div>
                          <span className="w-8 text-right text-sm font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start rounded-[24px] bg-[#18221f] p-7 text-white">
                  <Icon name="mail" size={25} className="mb-7 text-[#e59474]" />
                  <h2 className="text-2xl font-semibold tracking-tight">A personal touch.</h2>
                  <p className="mb-7 mt-3 text-sm leading-relaxed text-white/65">{fetchErrors.messages ? 'Your inbox is temporarily unavailable. Retry data above to see new enquiries.' : unreadMessages ? `${unreadMessages} unread ${unreadMessages === 1 ? 'message is' : 'messages are'} waiting for you. Help someone take their next step.` : 'Your inbox is up to date. A thoughtful reply can make someone’s journey.'}</p>
                  <button type="button" onClick={() => setTab('messages')} className="mt-auto inline-flex items-center gap-3 text-sm font-semibold text-white hover:underline">Open messages <Icon name="arrow-right" size={17} /></button>
                </div>
              </div>
            </div>

          ) : tab === 'cars' ? (
            /* ─── CARS TABLE ─── */
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[var(--color-text-muted)]">{cars.length} car{cars.length !== 1 ? 's' : ''} · {activeCars} available</p>
              </div>
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="bg-[var(--color-bg)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.14em]">
                    <tr>
                      <th className="px-6 py-4">Car</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Price/day</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cars.length === 0 && <tr><td colSpan={5} className="px-6 py-16 text-center"><Icon name="car" size={28} className="mx-auto mb-4 text-[var(--color-accent)]" /><p className="text-xl font-semibold">Your fleet starts here.</p><p className="mt-2 text-sm text-[var(--color-text-muted)]">Use “Add a car” to create your first listing.</p></td></tr>}
                    {cars.map((car) => (
                      <tr key={car._id} className="border-t border-[var(--color-border)] hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={car.images?.[0] || '/placeholder-car.svg'} alt="" onError={(event) => { if (!event.currentTarget.src.endsWith('/placeholder-car.svg')) event.currentTarget.src = '/placeholder-car.svg'; }} className="h-14 w-20 shrink-0 rounded-xl bg-[var(--color-bg)] object-cover" />
                            <div><p className="text-sm font-semibold">{car.brand} {car.name}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{car.year} · {car.color}</p></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">{car.category}</td>
                        <td className="px-6 py-4 font-medium">R{car.pricePerDay}</td>
                        <td className="px-6 py-4">
                          {car.isAvailable === false ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">Unavailable</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Available</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" disabled={!!fetchErrors.bookings} onClick={() => setAvailabilityCar(car)} aria-label={`View availability for ${car.brand} ${car.name}`} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] hover:bg-[var(--color-bg)] disabled:opacity-40" title={fetchErrors.bookings ? 'Retry booking data to view availability' : 'View availability calendar'}><Icon name="calendar" size={16} /></button>
                            <button type="button" onClick={() => setEditCar(car)} aria-label={`Edit ${car.brand} ${car.name}`} className="min-h-10 rounded-full border border-[var(--color-border)] px-4 py-2 text-xs font-medium hover:bg-[var(--color-bg)]">Edit</button>
                            {car.isAvailable !== false && (
                              <button type="button" disabled={mutationPending} onClick={() => setDeleteTarget(car._id)} aria-label={`Remove ${car.brand} ${car.name}`} className="min-h-10 rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Remove</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>

          ) : tab === 'messages' ? (
            /* ─── MESSAGES ─── */
            <MessagesPanel onRead={() => fetchData(true)} />

          ) : tab === 'users' ? (
            /* ─── USERS ─── */
            <UsersPanel bookings={bookings} />

          ) : tab === 'settings' ? (
            /* ─── SETTINGS ─── */
            <SettingsPanel />

          ) : (
            /* ─── BOOKINGS TABLE ─── */
            <div>
              <div className="mb-4">
                <p className="text-sm text-[var(--color-text-muted)] mb-3">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_DESCRIPTIONS).map(([key, desc]) => (
                    <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[key]}`}>
                      <span className="capitalize">{key}</span>
                      <span className="hidden lg:inline font-normal opacity-70">— {desc}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-[var(--color-bg)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.14em]">
                    <tr>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Car</th>
                      <th className="px-6 py-4">Dates</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 && <tr><td colSpan={5} className="px-6 py-16 text-center text-sm text-[var(--color-text-muted)]">No reservations yet. New bookings will appear here.</td></tr>}
                    {bookings.map((b) => (
                      <tr key={b._id} className="border-t border-[var(--color-border)] hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-sm">{b.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{b.user?.email}</p>
                          <p className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">RW-{b._id.slice(-8).toUpperCase()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium">{b.car?.brand} {b.car?.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{b.car?.location}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">
                          {formatDate(b.pickupDate)} → {formatDate(b.returnDate)}
                        </td>
                        <td className="px-6 py-4 font-medium">R{b.totalPrice?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {/* Terminal or expired bookings cannot be changed — render a static badge */}
                          {['completed', 'cancelled'].includes(b.status) || b.returnDate.slice(0, 10) <= today() ? (
                            <span
                              title="This booking is final and cannot be changed"
                              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${STATUS_BADGE[b.status]}`}
                            >
                              {b.status}
                            </span>
                          ) : (
                            <select
                              aria-label={`Status for booking RW-${b._id.slice(-8).toUpperCase()}`}
                              disabled={mutationPending}
                              value={b.status}
                              onChange={(e) => setStatusChange({ id: b._id, status: e.target.value, prev: b.status })}
                              className={`min-h-10 border rounded-full px-3 py-2 text-xs font-medium capitalize cursor-pointer disabled:opacity-50 ${STATUS_BADGE[b.status]}`}
                            >
                              {[b.status, ...STATUS_TRANSITIONS[b.status]].map((status) => (
                                <option key={status} value={status} disabled={['active', 'completed'].includes(status) && b.pickupDate.slice(0, 10) > today()}>{status[0].toUpperCase() + status.slice(1)}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODALS ─── */}
      {addCarOpen && <AddCarModal onClose={() => setAddCarOpen(false)} onSaved={fetchData} />}
      {editCar && <AddCarModal car={editCar} onClose={() => setEditCar(null)} onSaved={fetchData} />}
      {availabilityCar && <AvailabilityModal car={availabilityCar} bookings={bookings} onClose={() => setAvailabilityCar(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Car"
        message="This car will be removed from listings and won't appear on the browse page. Existing bookings for this car will remain unchanged."
        confirmLabel={mutationPending ? 'Removing…' : 'Remove car'}
        variant="danger"
        onConfirm={handleDeleteCar}
        onCancel={() => { if (!mutationInFlight.current) setDeleteTarget(null); }}
      />

      <ConfirmDialog
        open={!!statusChange}
        title="Update Booking Status"
        message={statusChange ? `Change status from "${statusChange.prev}" to "${statusChange.status}"? ${STATUS_DESCRIPTIONS[statusChange.status] || ''}` : ''}
        confirmLabel={mutationPending ? 'Updating…' : 'Update status'}
        onConfirm={handleStatusChange}
        onCancel={() => { if (!mutationInFlight.current) setStatusChange(null); }}
      />

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log out"
        message="Are you sure you want to log out of the admin panel?"
        confirmLabel="Log out"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

/* ─── SUB-COMPONENTS ─── */

const StatCard = ({ label, value, sub, icon, accent }) => (
  <div className={`min-w-0 rounded-[24px] border p-6 ${accent ? 'border-[#18221f] bg-[#18221f] text-white' : 'border-[var(--color-border)] bg-white'}`}>
    <div className="mb-7 flex items-center justify-between gap-3"><p className={`text-xs ${accent ? 'text-white/65' : 'text-[var(--color-text-muted)]'}`}>{label}</p><Icon name={icon} size={19} className={`shrink-0 ${accent ? 'text-[#e59474]' : 'text-[var(--color-accent)]'}`} /></div>
    <p className="break-words text-3xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{value}</p>
    <p className={`mt-3 text-[11px] leading-relaxed ${accent ? 'text-white/60' : 'text-[var(--color-text-muted)]'}`}>{sub}</p>
  </div>
);

/* ─── SVG ICONS ─── */

function GridIcon({ active }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[var(--color-accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

function CarIcon({ active }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[var(--color-accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M16 17h.01M3 11l1.5-5A2 2 0 016.4 4h11.2a2 2 0 011.9 1.4L21 11M3 11h18M3 11v6a1 1 0 001 1h1m16-7v6a1 1 0 01-1 1h-1M6 18v1a1 1 0 001 1h1m8-2v1a1 1 0 001 1h1" />
    </svg>
  );
}

function CalendarIcon({ active }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[var(--color-accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SettingsIcon({ active }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-[var(--color-accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

export default AdminDashboard;
