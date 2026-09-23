const express = require('express');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { protectedRoute, adminOnly } = require('../middleware/auth');
const { getBusinessToday, validateBookingDates } = require('./bookingDates');

const router = express.Router();
const allowedTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['active', 'cancelled'],
    active: ['completed'],
    completed: [],
    cancelled: [],
};

// Create a booking ( Logged in customers only )
router.post('/', protectedRoute, async (req, res) => {
    try{
        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Admin accounts cannot create bookings' });
        }
        const { carId, pickupDate, returnDate } = req.body || {};
        const { pickup, returnD, error } = validateBookingDates(pickupDate, returnDate);
        if (error) return res.status(400).json({ message: error });

        const car = await Car.findById(carId);
        if (!car) return res.status(404).json({ message: 'Car not found' });

        // Soft-deleted (removed) cars must not be bookable
        if(car.isAvailable === false){
            return res.status(400).json({ message: 'This car is no longer available for booking' });
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

// Auto-settle overdue bookings whenever they are fetched:
// - confirmed/active rentals whose return day has arrived become completed
// - pending requests whose rental window ended unapproved become cancelled
const autoCompleteOverdue = async () => {
    const today = getBusinessToday();
    await Booking.updateMany(
        { status: { $in: ['confirmed', 'active'] }, returnDate: { $lte: today } },
        { $set: { status: 'completed' } }
    );
    await Booking.updateMany(
        { status: 'pending', returnDate: { $lte: today } },
        { $set: { status: 'cancelled' } }
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
        const { status } = req.body || {};
        const booking = await Booking.findById(req.params.id);
        if(!booking) return res.status(404).json({ message: 'Booking not found' });

        const today = getBusinessToday();

        // Once the rental window has ended the status is final —
        // settle the booking to its terminal state and refuse the change
        if(booking.returnDate <= today){
            const terminal = booking.status === 'pending' ? 'cancelled' : 'completed';
            if(['pending', 'confirmed', 'active'].includes(booking.status) && booking.status !== terminal){
                booking.status = terminal;
                await booking.save();
            }
            return res.status(400).json({ message: 'The rental period for this booking has already ended — its status can no longer be changed' });
        }

        if (!(allowedTransitions[booking.status] || []).includes(status)) {
            return res.status(400).json({ message: 'This booking status transition is not allowed' });
        }

        // Neither activation nor an early return may precede the pickup day.
        if (['active', 'completed'].includes(status) && new Date(booking.pickupDate) > today) {
            return res.status(400).json({ message: 'This rental cannot start or complete yet — the pickup date is still in the future' });
        }

        booking.status = status;
        await booking.save();
        res.json(booking);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Cancel own booking (logged-in owner, before pickup)
router.put('/:id/cancel', protectedRoute, async (req, res) => {
    try{
        const booking = await Booking.findById(req.params.id);
        if(!booking) return res.status(404).json({ message: 'Booking not found' });

        if(booking.user.toString() !== req.user.id){
            return res.status(403).json({ message: 'You can only cancel your own bookings' });
        }

        if(!['pending', 'confirmed'].includes(booking.status)){
            return res.status(400).json({ message: 'Only pending or confirmed bookings can be cancelled' });
        }
        if (new Date(booking.pickupDate) <= getBusinessToday()) {
            return res.status(400).json({ message: 'Bookings can only be cancelled before the pickup date' });
        }

        booking.status = 'cancelled';
        await booking.save();
        res.json(booking);
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

module.exports = router;
