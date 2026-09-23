import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function CarCard({ car, search = '' }) {
  return (
    <Link to={`/cars/${car._id}${search}`} className="car-card group">
      <div className="car-card-image">
        <img src={car.images?.[0] || '/placeholder-car.svg'} alt={`${car.brand} ${car.name}`} loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-car.svg'; }} />
        <span className="car-badge">{car.category}</span>
      </div>
      <div className="car-card-body">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[var(--color-text-muted)]">
          <span className="uppercase tracking-widest">{car.brand} · {car.year}</span>
          {car.rating > 0 && <span className="flex items-center gap-1"><Icon name="star" size={12} className="text-[var(--color-accent)]" />{car.rating.toFixed(1)}</span>}
        </div>
        <h3 className="text-xl font-semibold tracking-tight">{car.brand} {car.name}</h3>
        <div className="car-card-meta">
          <span><Icon name="users" size={14} />{car.seats} seats</span>
          <span><Icon name="settings" size={14} />{car.transmission}</span>
          <span><Icon name="fuel" size={14} />{car.fuelType}</span>
        </div>
        <div className="car-card-bottom">
          <div><p className="text-xl font-semibold tracking-tight">R{car.pricePerDay.toLocaleString('en-ZA')}<span className="ml-1 text-[10px] font-normal tracking-normal text-[var(--color-text-muted)]">/ day</span></p><p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]"><Icon name="pin" size={11} />{car.location}</p></div>
          <span className="card-arrow"><Icon name="arrow-up-right" size={18} /></span>
        </div>
      </div>
    </Link>
  );
}
