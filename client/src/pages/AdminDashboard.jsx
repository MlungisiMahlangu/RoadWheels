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
  const [searchParams] = useSearchParams();
  // Open directly on a specific tab via ?tab= (e.g. /admin?tab=messages)
  const [tab, setTab] = useState(() => {
    const t = searchParams.get('tab');
    return NAV_ITEMS.some((item) => item.key === t) ? t : 'overview';
  });
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [actionError, setActionError] = useState('');

  // Modals
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [editCar, setEditCar] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusChange, setStatusChange] = useState(null);
  const [availabilityCar, setAvailabilityCar] = useState(null);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/');
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [carsData, bookingsData, messagesData] = await Promise.all([
        api.getCarsAdmin(),
        api.getAllBookings(),
        api.getContactMessages().catch(() => []),
      ]);
      setCars(carsData);
      setBookings(bookingsData);
      setMessages(messagesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDeleteCar = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteCar(deleteTarget);
      setDeleteTarget(null);
      fetchData();
    } catch (err) {
      setDeleteTarget(null);
      setActionError('Failed to remove car: ' + err.message);
    }
  };

  const handleStatusChange = async () => {
    if (!statusChange) return;
    try {
      await api.updateBookingStatus(statusChange.id, statusChange.status);
      setStatusChange(null);
      fetchData();
    } catch (err) {
      setStatusChange(null);
      setActionError('Failed to update status: ' + err.message);
      // Re-fetch so the table reflects the server's true status
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ─── SIDEBAR ─── */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#111318] text-white flex flex-col
        transform transition-transform duration-200 ease-out
        md:fixed md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm">R</div>
            <div>
              <p className="font-bold text-sm tracking-tight">RoadWheels</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === item.key
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <item.icon active={tab === item.key} />
              <span>{item.label}</span>
              {item.key === 'bookings' && pendingBookings > 0 && (
                <span className="ml-auto flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-[var(--color-accent)]">
                  {pendingBookings}
                </span>
              )}
              {item.key === 'messages' && unreadMessages > 0 && (
                <span className="ml-auto flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-[var(--color-accent)]">
                  {unreadMessages}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <ExternalIcon />
            View Site
          </Link>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            <LogoutIcon />
            Log out
          </button>
        </div>

        {/* Admin info */}
        <div className="px-6 py-4 border-t border-white/10">
          <p className="text-xs text-white/30">Signed in as</p>
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-white/40 truncate">{user?.email}</p>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-[var(--color-border)] px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-bold truncate">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'cars' && (
              <button
                onClick={() => setAddCarOpen(true)}
                className="px-4 py-2 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                + Add Car
              </button>
            )}
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen((o) => !o)} className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingBookings > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold text-white bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                    {pendingBookings}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white border border-[var(--color-border)] rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] font-medium text-sm">Pending Bookings</div>
                  {bookings.filter((b) => b.status === 'pending').slice(0, 5).length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Nothing needs your attention.</p>
                  ) : (
                    bookings.filter((b) => b.status === 'pending').slice(0, 5).map((b) => (
                      <button
                        key={b._id}
                        onClick={() => { setTab('bookings'); setNotifOpen(false); }}
                        className="w-full text-left px-4 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium">{b.user?.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{b.car?.brand} {b.car?.name} · R{b.totalPrice?.toLocaleString()}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {actionError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center justify-between gap-3">
              <span>{actionError}</span>
              <button onClick={() => setActionError('')} className="text-lg leading-none shrink-0" aria-label="Dismiss">×</button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[var(--color-accent)] rounded-full animate-spin" />
            </div>
          ) : tab === 'overview' ? (
            /* ─── OVERVIEW ─── */
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Cars" value={cars.length} sub={`${activeCars} available · ${unavailableCars} removed`} icon="car" />
                <StatCard label="Pending Bookings" value={pendingBookings} sub="Awaiting your approval" icon="clock" accent />
                <StatCard label="Active Rentals" value={activeBookings} sub="Cars currently on the road" icon="road" />
                <StatCard label="Total Revenue" value={`R${totalRevenue.toLocaleString()}`} sub={`R${completedRevenue.toLocaleString()} collected`} icon="money" />
              </div>

              {/* Recent bookings */}
              <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
                  <h2 className="font-bold">Recent Bookings</h2>
                  <button onClick={() => setTab('bookings')} className="text-sm text-[var(--color-accent)] font-medium hover:underline">View all</button>
                </div>
                {bookings.slice(0, 5).length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">No bookings yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                    <thead className="bg-gray-50 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3">Customer</th>
                        <th className="px-5 py-3">Car</th>
                        <th className="px-5 py-3">Total</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.slice(0, 5).map((b) => (
                        <tr key={b._id} className="border-t border-[var(--color-border)]">
                          <td className="px-5 py-3 text-sm">{b.user?.name || 'Unknown'}</td>
                          <td className="px-5 py-3 text-sm">{b.car?.brand} {b.car?.name}</td>
                          <td className="px-5 py-3 text-sm font-medium">R{b.totalPrice?.toLocaleString()}</td>
                          <td className="px-5 py-3">
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

              {/* Booking breakdown */}
              <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5">
                <h2 className="font-bold mb-4">Booking Breakdown</h2>
                <div className="flex flex-wrap gap-4">
                  {Object.entries({ pending: pendingBookings, confirmed: confirmedBookings, active: activeBookings, completed: completedBookings, cancelled: cancelledBookings }).map(([key, count]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_BADGE[key].split(' ')[0]}`} />
                      <span className="text-sm text-[var(--color-text-muted)] capitalize">{key}</span>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          ) : tab === 'cars' ? (
            /* ─── CARS TABLE ─── */
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[var(--color-text-muted)]">{cars.length} car{cars.length !== 1 ? 's' : ''} · {activeCars} available</p>
              </div>
              <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="bg-gray-50 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Car</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3">Price/day</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cars.map((car) => (
                      <tr key={car._id} className="border-t border-[var(--color-border)] hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium">{car.brand} {car.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{car.year} · {car.color}</p>
                        </td>
                        <td className="px-5 py-3 text-sm text-[var(--color-text-muted)]">{car.category}</td>
                        <td className="px-5 py-3 font-medium">R{car.pricePerDay}</td>
                        <td className="px-5 py-3">
                          {car.isAvailable === false ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">Unavailable</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Available</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setAvailabilityCar(car)} className="px-3 py-1.5 text-xs font-medium rounded-full border border-[var(--color-border)] hover:bg-gray-50 transition-colors" title="View Calendar">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button onClick={() => setEditCar(car)} className="px-3 py-1.5 text-xs font-medium rounded-full border border-[var(--color-border)] hover:bg-gray-50 transition-colors">
                              Edit
                            </button>
                            {car.isAvailable !== false && (
                              <button onClick={() => setDeleteTarget(car._id)} className="px-3 py-1.5 text-xs font-medium rounded-full text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                                Remove
                              </button>
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
            <MessagesPanel onRead={fetchData} />

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
              <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-gray-50 text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Car</th>
                      <th className="px-5 py-3">Dates</th>
                      <th className="px-5 py-3">Total</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b._id} className="border-t border-[var(--color-border)] hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-sm">{b.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{b.user?.email}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium">{b.car?.brand} {b.car?.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{b.car?.location}</p>
                        </td>
                        <td className="px-5 py-3 text-sm text-[var(--color-text-muted)]">
                          {new Date(b.pickupDate).toLocaleDateString()} → {new Date(b.returnDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 font-medium">R{b.totalPrice?.toLocaleString()}</td>
                        <td className="px-5 py-3">
                          {/* Terminal or expired bookings cannot be changed — render a static badge */}
                          {b.status === 'completed' || new Date(b.returnDate) < new Date() ? (
                            <span
                              title={new Date(b.returnDate) < new Date() ? 'Rental period has ended — status is final' : undefined}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${STATUS_BADGE[b.status]}`}
                            >
                              {b.status}
                            </span>
                          ) : (
                            <select
                              value={b.status}
                              onChange={(e) => setStatusChange({ id: b._id, status: e.target.value, prev: b.status })}
                              className={`border rounded-full px-3 py-1 text-xs font-medium capitalize cursor-pointer ${STATUS_BADGE[b.status]}`}
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="active">Active</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
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
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleDeleteCar}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!statusChange}
        title="Update Booking Status"
        message={statusChange ? `Change status from "${statusChange.prev}" to "${statusChange.status}"? ${STATUS_DESCRIPTIONS[statusChange.status] || ''}` : ''}
        confirmLabel="Update"
        onConfirm={handleStatusChange}
        onCancel={() => setStatusChange(null)}
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
  <div className={`rounded-2xl border p-5 ${accent ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5' : 'border-[var(--color-border)] bg-white'}`}>
    <p className="text-sm text-[var(--color-text-muted)] mb-1">{label}</p>
    <p className="text-2xl font-bold">{value}</p>
    {sub && <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>}
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
