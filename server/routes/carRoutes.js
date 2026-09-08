const express = require('express');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const { protectedRoute, adminOnly } = require('../middleware/auth');
const router = express.Router();

//Get all cars (public , with optional filters; ?all=true for admin)
router.get('/', async (req, res) => {
    try{
        const { location, category, transmission, brand, fuelType, search, sort, all } = req.query;
        const filter = all === 'true' ? {} : { isAvailable: { $ne: false } };
        if (location) filter.location = location;
        if (category) filter.category = category;
        if (transmission) filter.transmission = transmission;
        if (brand) filter.brand = brand;
        if (fuelType) filter.fuelType = fuelType;
        if (search) {
            const pattern = new RegExp(search.trim(), 'i');
            filter.$or = [{ brand: pattern }, { name: pattern }];
        }

        const sortOptions = {
            'price-asc': { pricePerDay: 1 },
            'price-desc': { pricePerDay: -1 },
            'rating': { rating: -1 },
            'newest': { createdAt: -1 },
        };
        const sortBy = sortOptions[sort] || { createdAt: -1 };

        const cars = await Car.find(filter).sort(sortBy);
        res.json(cars);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Get single car by ID (public)
router.get('/:id', async (req, res) => {
    try{
        const car = await Car.findById(req.params.id);
        if(!car) return res.status(404).json({ message: 'Car not found' });
        res.json(car);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Get booked date ranges for a car (public — lets the booking page warn about taken dates)
router.get('/:id/availability', async (req, res) => {
    try{
        const bookings = await Booking.find(
            { car: req.params.id, status: { $in: ['pending', 'confirmed', 'active'] } },
            'pickupDate returnDate'
        );
        res.json(bookings);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Add a new car (protected, only for admins)
router.post('/', protectedRoute, adminOnly, async (req, res) => {
    try{
        const car = await Car.create(req.body);
        res.status(201).json(car);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Update a car (protected, only for admins)
router.put('/:id', protectedRoute, adminOnly, async (req, res) => {
    try{
        const car = await Car.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if(!car) return res.status(404).json({ message: 'Car not found' });
        res.json(car);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Soft-delete a car — mark unavailable, keep in DB for booking history
router.delete('/:id', protectedRoute, adminOnly, async (req, res) => {
    try{
        const car = await Car.findByIdAndUpdate(req.params.id, { isAvailable: false }, { new: true });
        if(!car) return res.status(404).json({ message: 'Car not found' });
        res.json({ message: 'Car removed from listings' });
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

module.exports = router;
