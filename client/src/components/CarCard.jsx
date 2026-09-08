import { Link } from 'react-router-dom';

const CarCard = ({ car }) => {
  return (
    <Link
      to={`/cars/${car._id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-[var(--color-border)] hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative overflow-hidden aspect-[4/3]">
        <img
          src={car.images?.[0] || '/placeholder-car.png'}
          alt={car.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
          {car.category}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-lg leading-tight">{car.brand} {car.name}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{car.year} · {car.transmission}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">R{car.pricePerDay}</p>
            <p className="text-xs text-[var(--color-text-muted)]">per day</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-border)]">
          <span>{car.seats} seats</span>
          <span>·</span>
          <span>{car.fuelType}</span>
          <span>·</span>
          <span>{car.location}</span>
        </div>
      </div>
    </Link>
  );
};

export default CarCard;