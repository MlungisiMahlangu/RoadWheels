import http from 'node:http';
import { today, nextDate } from '../src/services/rentalDates.js';

// Isolated UI fixtures only: never connects to the application's database.
const offsetDate = (offset) => {
  const date = new Date(`${today()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const customer = { _id: '111111111111111111111111', name: 'Alex Test', email: 'alex@example.test', role: 'user', phone: '', licenseNumber: '', createdAt: offsetDate(-60) };
const admin = { _id: '222222222222222222222222', name: 'Test Administrator', email: 'admin@example.test', role: 'admin', createdAt: offsetDate(-60) };
const cars = [
  { name: 'M4 Competition', brand: 'BMW', category: 'Sedan', pricePerDay: 1450, fuelType: 'Petrol', location: 'Cape Town', images: ['/collections/sedan.png'], color: 'Blue' },
  { name: 'Sport', brand: 'Range Rover', category: 'SUV', pricePerDay: 1800, fuelType: 'Diesel', location: 'Johannesburg', images: ['/collections/suv.png'], color: 'Grey' },
  { name: 'e-tron GT', brand: 'Audi', category: 'Luxury', pricePerDay: 2100, fuelType: 'Electric', location: 'Cape Town', images: ['/collections/electric.png'], color: 'White' },
  { name: 'Corolla', brand: 'Toyota', category: 'Economy', pricePerDay: 450, fuelType: 'Petrol', location: 'Durban', images: ['/whiteToyota.png'], color: 'White' },
  { name: 'i20', brand: 'Hyundai', category: 'Hatchback', pricePerDay: 380, fuelType: 'Petrol', location: 'Pretoria', images: ['/Hyundai.png'], color: 'White' },
  { name: '320i', brand: 'BMW', category: 'Sedan', pricePerDay: 950, fuelType: 'Petrol', location: 'Johannesburg', images: ['/whiteBMW.png'], color: 'White' },
].map((car, index) => ({ ...car, _id: String(index + 1).padStart(24, '0'), year: 2025, seats: 5, transmission: 'Automatic', mileage: 12000, rating: 4.8, isAvailable: true, description: 'A comfortable drive for city plans and weekend adventures. This vehicle is synthetic test data for interface verification.', features: ['Air conditioning', 'Bluetooth', 'Reverse camera', 'Cruise control'] }));
let bookings = [
  { status: 'confirmed', pickupDate: offsetDate(8), returnDate: offsetDate(11), car: cars[1] },
  { status: 'completed', pickupDate: offsetDate(-10), returnDate: offsetDate(-7), car: cars[3] },
  { status: 'active', pickupDate: offsetDate(-1), returnDate: offsetDate(2), car: cars[4] },
].map((booking, index) => ({ ...booking, _id: `b${String(index + 1).padStart(23, '0')}`, user: customer, totalPrice: 3 * booking.car.pricePerDay, createdAt: offsetDate(-15) }));
let reviews = [];
let messages = [{ _id: 'c00000000000000000000001', name: customer.name, email: customer.email, message: 'Please confirm the pickup arrangements for my test booking.', isRead: false, createdAt: today() }];
let failure = '';
let empty = false;
const requests = [];

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  const send = (data, status = 200) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') return send({});
  const url = new URL(req.url, 'http://127.0.0.1:5055');
  const path = url.pathname.replace(/^\/api/, '');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  if (path === '/__test') {
    if (req.method === 'POST') { failure = body.failure || ''; empty = Boolean(body.empty); }
    return send({ failure, empty, dates: { pickup: offsetDate(3), return: offsetDate(6), today: today(), tomorrow: nextDate(today()) }, requests, bookings });
  }
  requests.push({ method: req.method, path: req.url });
  if (failure && path.includes(failure)) return send({ message: 'Simulated service interruption. Please try again.' }, 503);
  const signedIn = req.headers.authorization?.includes('admin') ? admin : customer;
  if (path === '/auth/login' || path === '/auth/signup') {
    if (body.password === 'incorrect') return send({ message: 'Invalid email or password' }, 401);
    const user = body.email === admin.email ? admin : { ...customer, ...(body.name ? { name: body.name } : {}) };
    return send({ user, token: user.role === 'admin' ? 'fixture-admin' : 'fixture-customer' });
  }
  if (path === '/auth/me/password') return send({ message: 'Password changed.' });
  if (path === '/auth/me') { if (req.method === 'PUT') Object.assign(signedIn, body); return send(signedIn); }
  if (path === '/auth/users') return send([customer, admin]);
  if (path.includes('/suspend')) { customer.isSuspended = !customer.isSuspended; return send(customer); }
  if (path === '/cars' && req.method === 'GET') {
    let list = empty ? [] : [...cars];
    for (const key of ['category', 'transmission', 'fuelType', 'location']) { if (url.searchParams.get(key)) list = list.filter((car) => car[key] === url.searchParams.get(key)); }
    if (url.searchParams.get('search')) list = list.filter((car) => `${car.brand} ${car.name}`.toLowerCase().includes(url.searchParams.get('search').toLowerCase()));
    const pickup = url.searchParams.get('pickupDate');
    const end = url.searchParams.get('returnDate');
    if (pickup && end) list = list.filter((car) => !bookings.some((b) => b.car._id === car._id && ['pending', 'confirmed', 'active'].includes(b.status) && pickup < b.returnDate && end > b.pickupDate));
    if (url.searchParams.get('sort') === 'price-asc') list.sort((a, b) => a.pricePerDay - b.pricePerDay);
    if (url.searchParams.get('sort') === 'price-desc') list.sort((a, b) => b.pricePerDay - a.pricePerDay);
    return send(list);
  }
  if (path.endsWith('/availability')) return send(bookings.filter((b) => b.car._id === path.split('/')[2] && ['pending', 'confirmed', 'active'].includes(b.status)));
  if (path.startsWith('/cars/')) {
    const car = cars.find((c) => c._id === path.split('/')[2]);
    if (!car) return send({ message: 'Car not found' }, 404);
    if (req.method === 'PUT') Object.assign(car, body);
    if (req.method === 'DELETE') car.isAvailable = false;
    return send(car);
  }
  if (path === '/cars' && req.method === 'POST') { const car = { ...body, _id: String(cars.length + 1).padStart(24, '0'), rating: 0 }; cars.push(car); return send(car, 201); }
  if (path === '/bookings' && req.method === 'POST') {
    const car = cars.find((c) => c._id === body.carId);
    const booking = { ...body, _id: `b${String(bookings.length + 1).padStart(23, '0')}`, car, user: customer, status: 'pending', totalPrice: ((new Date(body.returnDate) - new Date(body.pickupDate)) / 86400000) * car.pricePerDay, createdAt: today() };
    bookings.push(booking);
    return send(booking, 201);
  }
  if (path === '/bookings' || path === '/bookings/mybookings') return send(empty ? [] : bookings);
  if (path.startsWith('/bookings/')) {
    const booking = bookings.find((b) => b._id === path.split('/')[2]);
    if (!booking) return send({ message: 'Booking not found' }, 404);
    booking.status = path.endsWith('/cancel') ? 'cancelled' : body.status;
    return send(booking);
  }
  if (path === '/reviews/mine') return send(reviews);
  if (path.startsWith('/reviews/car/')) return send(reviews.filter((review) => review.car === path.split('/')[3]));
  if (path === '/reviews' && req.method === 'POST') { const booking = bookings.find((b) => b._id === body.bookingId); const review = { ...body, _id: String(reviews.length + 1), booking: body.bookingId, car: booking.car._id, user: customer, createdAt: today() }; reviews.push(review); return send(review, 201); }
  if (path === '/contact' && req.method === 'GET') return send(messages);
  if (path === '/contact' && req.method === 'POST') { messages.push({ ...body, _id: String(messages.length + 1), isRead: false, createdAt: today() }); return send({ message: 'Message sent' }, 201); }
  if (path.startsWith('/contact/') && path.endsWith('/read')) { const message = messages.find((m) => m._id === path.split('/')[2]); if (message) message.isRead = true; return send(message || {}); }
  send({ message: 'No fixture for this endpoint' }, 404);
}).listen(5055, '127.0.0.1', () => console.log('Synthetic UI fixture API listening on 127.0.0.1:5055 — no real database'));
