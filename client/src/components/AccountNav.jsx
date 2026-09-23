import { NavLink } from 'react-router-dom';
import Icon from './Icon';

export default function AccountNav() {
  return (
    <nav aria-label="Your account" className="account-nav">
      {[['/dashboard', 'grid', 'Overview'], ['/my-bookings', 'calendar', 'My bookings'], ['/profile', 'user', 'My profile']].map(([to, icon, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => `account-link ${isActive ? 'active' : ''}`}><Icon name={icon} size={17} />{label}</NavLink>
      ))}
    </nav>
  );
}
