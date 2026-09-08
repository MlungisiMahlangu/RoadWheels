import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import CarCard from '../components/CarCard';

const Home = () => {
  const [featuredCars, setFeaturedCars] = useState([]);

  useEffect(() => {
    api.getCars().then((data) => setFeaturedCars(data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero — unchanged */}
      <section className="relative overflow-hidden">
        <img
          src="/hero-car.png"
          alt="RoadWheels"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-black/10 opacity-70" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-44 sm:pb-56">
          <p className="text-[var(--color-accent)] font-semibold text-base sm:text-lg mb-3">
            Need a ride? No stress, we got you.
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6 max-w-2xl drop-shadow-sm">
            Your next ride, on your terms.
          </h1>
          <p className="text-base sm:text-lg text-[var(--color-text-muted)] mb-8 max-w-md">
            Browse, book, and hit the road in minutes. No hidden fees, no hassle.
          </p>
          <Link
            to="/browse"
            className="inline-block px-8 py-4 rounded-full bg-[var(--color-accent)] text-white font-semibold text-lg hover:bg-[var(--color-accent-hover)] transition-all hover:scale-105 shadow-lg"
          >
            Browse Cars
          </Link>
        </div>
      </section>

      {/* Trust bar — unchanged */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 sm:-mt-16 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl grid grid-cols-3 divide-x divide-[var(--color-border)] overflow-hidden">
          <div className="text-center py-6 sm:py-8">
            <p className="text-2xl sm:text-3xl font-bold">500+</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Cars available</p>
          </div>
          <div className="text-center py-6 sm:py-8">
            <p className="text-2xl sm:text-3xl font-bold">10k+</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Happy renters</p>
          </div>
          <div className="text-center py-6 sm:py-8">
            <p className="text-2xl sm:text-3xl font-bold">4.8★</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Average rating</p>
          </div>
        </div>
      </section>

      {/* Featured Cars */}
      {featuredCars.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Featured cars</h2>
              <p className="text-[var(--color-text-muted)]">A few of our most popular rides right now</p>
            </div>
            <Link to="/browse" className="text-[var(--color-accent)] font-semibold hover:underline hidden sm:block">
              View all cars →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCars.map((car) => <CarCard key={car._id} car={car} />)}
          </div>
        </section>
      )}

      {/* How it works — unchanged */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-16">How it works</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            { step: '01', title: 'Search', desc: 'Pick your location and dates to see available cars.' },
            { step: '02', title: 'Book', desc: 'Choose your car and confirm your booking in seconds.' },
            { step: '03', title: 'Drive', desc: "Pick up your car and hit the road. It's that simple." },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <span className="text-5xl font-bold text-[var(--color-accent)]/20">{item.step}</span>
              <h3 className="text-xl font-semibold mt-2 mb-2">{item.title}</h3>
              <p className="text-[var(--color-text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>


    {/* FAQ */}
    <section className="bg-white border-t border-[var(--color-border)]">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Frequently asked questions</h2>
        <div className="space-y-3">
        {[
            { q: 'What do I need to rent a car?', a: 'A valid driver\'s license, a form of ID, and a card for the security deposit.' },
            { q: 'Can I cancel a booking?', a: 'Yes, bookings can be cancelled from your My Bookings page before pickup.' },
            { q: 'Is there a mileage limit?', a: 'Most rentals include a generous daily mileage allowance — extra km are billed at checkout.' },
            { q: 'What happens if I return the car late?', a: 'A grace period of one hour applies. After that, a late fee is charged per hour.' },
        ].map((item, i) => (
            <details key={i} className="group bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl px-5 py-4">
            <summary className="flex items-center justify-between font-medium cursor-pointer list-none">
                {item.q}
                <span className="text-[var(--color-accent)] group-open:rotate-45 transition-transform text-xl">+</span>
            </summary>
            <p className="text-sm text-[var(--color-text-muted)] mt-3">{item.a}</p>
            </details>
        ))}
        </div>
    </div>
    </section>

      {/* Why Choose Us */}
      <section className="bg-white border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-16">Why choose RoadWheels</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: '🛡️', title: 'Fully Insured', desc: 'Every rental is covered, so you can drive with peace of mind.' },
              { icon: '⚡', title: 'Instant Booking', desc: 'No waiting for approval — book and go in minutes.' },
              { icon: '💳', title: 'No Hidden Fees', desc: "The price you see is the price you pay. Always." },
              { icon: '📍', title: 'Multiple Locations', desc: 'Pick up and drop off across major cities nationwide.' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center text-2xl mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-16">What renters are saying</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: 'Thabo M.', quote: 'Booking took less than five minutes and the car was spotless. Way smoother than other rental apps I\'ve tried.', rating: 5 },
            { name: 'Aisha K.', quote: 'Loved how transparent the pricing was — no surprise fees at pickup. Will definitely rent again.', rating: 5 },
            { name: 'Sipho D.', quote: 'Great selection of cars and the whole process felt modern and easy to trust.', rating: 4 },
          ].map((t) => (
            <div key={t.name} className="bg-white border border-[var(--color-border)] rounded-2xl p-6">
              <div className="text-[var(--color-accent)] mb-3">{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</div>
              <p className="text-[var(--color-text-muted)] mb-4">"{t.quote}"</p>
              <p className="font-semibold text-sm">{t.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Operating Hours & Locations */}
      <section className="bg-white border-y border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24 grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Operating hours</h2>
            <div className="space-y-3">
              {[
                { day: 'Monday – Friday', hours: '07:00 – 18:00' },
                { day: 'Saturday', hours: '08:00 – 14:00' },
                { day: 'Sunday', hours: 'Closed' },
                { day: 'Public Holidays', hours: '09:00 – 13:00' },
              ].map((row) => (
                <div key={row.day} className="flex justify-between py-2 border-b border-[var(--color-border)] text-sm">
                  <span className="text-[var(--color-text-muted)]">{row.day}</span>
                  <span className="font-medium">{row.hours}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-4">
              After-hours pickup/drop-off available on request for an additional fee.
            </p>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Our locations</h2>
            <div className="space-y-4">
              {['Johannesburg', 'Pretoria', 'Cape Town', 'Durban'].map((city) => (
                <div key={city} className="flex items-center gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  <span className="font-medium">{city}</span>
                  <span className="text-[var(--color-text-muted)]">— TBA</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to hit the road?</h2>
        <p className="text-[var(--color-text-muted)] mb-8 max-w-md mx-auto">
          Browse our full fleet and find the perfect car for your next trip.
        </p>
        <Link
          to="/browse"
          className="inline-block px-8 py-4 rounded-full bg-[var(--color-accent)] text-white font-semibold text-lg hover:bg-[var(--color-accent-hover)] transition-all hover:scale-105 shadow-lg"
        >
          Browse Cars
        </Link>
      </section>
    </div>
  );
};

export default Home;