const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createApp } = require('../src/app');
const User = require('../models/User');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const { getBusinessToday } = require('../routes/bookingDates');

process.env.JWT_SECRET = 'local-browser-tests-only-not-a-deployment-secret';

async function start() {
    const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ ip: '127.0.0.1' }] });
    const uri = replica.getUri('roadwheels_browser_tests');
    if (new URL(uri).hostname !== '127.0.0.1') throw new Error('Browser tests require a loopback database.');
    await mongoose.connect(uri);
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const password = await bcrypt.hash('TestDrive9!', 10);
    const [customer] = await User.create([
        { name: 'Local Customer', email: 'customer@example.test', password },
        { name: 'Local Administrator', email: 'admin@example.test', role: 'admin', password },
    ]);
    const cars = await Car.create([
        { brand: 'BMW', name: 'M4 Competition', category: 'Luxury', pricePerDay: 1800, location: 'Cape Town', images: ['/collections/sedan.webp'] },
        { brand: 'Toyota', name: 'Fortuner', category: 'SUV', pricePerDay: 1200, location: 'Johannesburg', images: ['/collections/suv.webp'] },
        { brand: 'Tesla', name: 'Model 3', category: 'Sedan', pricePerDay: 1500, location: 'Pretoria', fuelType: 'Electric', images: ['/collections/electric.webp'] },
        { brand: 'Toyota', name: 'Quantum', category: 'Minivan (MPV)', pricePerDay: 950, location: 'Durban', images: ['/collections/suv.webp'] },
    ].map(car => ({ description: 'An isolated test vehicle, not a real listing.', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, year: 2025, color: 'White', mileage: 1000, features: ['Air conditioning', 'Bluetooth'], ...car })));
    const date = (offset) => new Date(getBusinessToday().getTime() + offset * 86400000);
    await Booking.create([
        { user: customer._id, car: cars[0]._id, pickupDate: date(7), returnDate: date(10), totalPrice: 5400, status: 'confirmed' },
        { user: customer._id, car: cars[1]._id, pickupDate: date(-1), returnDate: date(2), totalPrice: 3600, status: 'active' },
        { user: customer._id, car: cars[2]._id, pickupDate: date(-10), returnDate: date(-7), totalPrice: 4500, status: 'completed' },
    ]);
    const app = createApp({ production: false, origins: 'http://127.0.0.1:5174' });
    const server = app.listen(5055, '127.0.0.1', () => console.log('Isolated RoadWheels test API: http://127.0.0.1:5055; customer@example.test / admin@example.test; password TestDrive9!'));
    const stop = () => server.close(async () => { await mongoose.disconnect(); await replica.stop(); });
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}

start().catch(err => { console.error(err); process.exitCode = 1; });
