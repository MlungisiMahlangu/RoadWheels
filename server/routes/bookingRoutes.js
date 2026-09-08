const express = require('express');
const Booking = require('../models/Booking');
const  Car = require('../models/Car');
const { protectedRoute, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Create a booking ( Logged in users only )
router.post('/', protectedRoute, async (req, res) => {
    try{
        const { carId, pickupDate , returnDate } = req.body;
        const car = await Car.findById(carId);

        if (!car) return res.status(404).json({ message: 'Car not found' });

        const pickup = new Date(pickupDate);
        const returnD = new Date(returnDate);

        if( pickup >= returnD){
            return res.status(400).json({ message: 'Return date must be after pickup date' });
        }

        // Check for overlapping booking on this car (pending, confirmed or active)
        const overlapping = await Booking.findOne({
            car: carId,
            status: { $in: ['pending', 'confirmed', 'active'] },
            pickupDate: { $lt: returnD },
            returnDate: { $gt: pickup }
        });

        if (overlapping) {
            if (overlapping.user.toString() === req.user.id) {
                return res.status(400).json({ message: 'You already have a booking for this car during these dates' });
            }
            return res.status(400).json({ message: 'This car is already booked for the selected dates' });
        }

        const days = Math.ceil(Math.abs(returnD - pickup) / (1000 * 60 * 60 * 24));
        const totalPrice = days * car.pricePerDay;
        const booking = await Booking.create({ user: req.user.id, car: carId, pickupDate: pickup, returnDate: returnD, totalPrice});
        res.status(201).json(booking);

    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Auto-complete: mark overdue confirmed/active bookings as completed
const autoCompleteOverdue = async () => {
    const now = new Date();
    await Booking.updateMany(
        { status: { $in: ['confirmed', 'active'] }, returnDate: { $lt: now } },
        { $set: { status: 'completed' } }
    );
};

// get Loggedin user's own bookings
router.get('/mybookings', protectedRoute, async (req, res) => {
    try{
        await autoCompleteOverdue();
        const bookings = await Booking.find({ user: req.user.id }).populate('car', 'name images pricePerDay brand location color year');
        res.json(bookings);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Get all bookings (for admin only)
router.get('/', protectedRoute, adminOnly, async (req, res) => {
    try{
        await autoCompleteOverdue();
        const bookings = await Booking.find().populate('user', 'name email').populate('car', 'name images pricePerDay brand location color year');
        res.json(bookings);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Update a booking status (for admin only)
router.put('/:id/status', protectedRoute, adminOnly, async (req, res) => {
    try{
        const { status } = req.body;
        const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if(!booking) return res.status(404).json({ message: 'Booking not found' });
        res.json(booking);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

module.exports = router;
