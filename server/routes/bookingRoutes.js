const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { protectedRoute, adminOnly } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { getBusinessToday, validateBookingDates, effectiveBookingStatus } = require('./bookingDates');

const router = express.Router();
const allowedTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['active', 'cancelled'],
    active: ['completed'],
    completed: [],
    cancelled: [],
};
const validId = (value) => typeof value === 'string' && value.length === 24 && /^[a-f\d]{24}$/i.test(value);
const transactionOptions = {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    readPreference: 'primary',
    maxCommitTimeMS: 5000,
    timeoutMS: 15000,
};

router.post('/', protectedRoute, async (req, res, next) => {
    try {
        if (req.user.role === 'admin') {
            throw new HttpError(403, 'Admin accounts cannot create bookings');
        }
        const { carId, pickupDate, returnDate } = req.body || {};
        if (!validId(carId)) throw new HttpError(400, 'Invalid car ID');
        const { pickup, returnD, error } = validateBookingDates(pickupDate, returnDate);
        if (error) throw new HttpError(400, error);

        const booking = await mongoose.connection.transaction(async (session) => {
            // This MUST be the first transaction operation. The shared car write
            // makes competing snapshots retry before checking availability.
            const car = await Car.findOneAndUpdate(
                { _id: carId, isAvailable: true },
                { $inc: { reservationVersion: 1 } },
                { session, new: true }
            ).lean();
            if (!car) {
                const existing = await Car.findById(carId).session(session).lean();
                if (!existing) throw new HttpError(404, 'Car not found');
                throw new HttpError(400, 'This car is no longer available for booking');
            }

            const overlapping = await Booking.findOne({
                car: carId,
                status: { $in: ['pending', 'confirmed', 'active'] },
                pickupDate: { $lt: returnD },
                returnDate: { $gt: pickup },
            }).session(session).lean();
            if (overlapping) {
                throw new HttpError(409, overlapping.user.toString() === req.user.id
                    ? 'You already have a booking for this car during these dates'
                    : 'This car is already booked for the selected dates', 'BOOKING_CONFLICT');
            }

            const days = (returnD - pickup) / (1000 * 60 * 60 * 24);
            const [created] = await Booking.create([{
                user: req.user.id, car: carId, pickupDate: pickup,
                returnDate: returnD, totalPrice: days * car.pricePerDay,
            }], { session });
            return created;
        }, transactionOptions);
        res.status(201).json(booking);
    } catch (err) {
        next(err);
    }
});

// Lifecycle status is a read-only projection, never a GET-triggered write.
const withEffectiveStatus = (bookings) => {
    const today = getBusinessToday();
    return bookings.map((booking) => ({ ...booking, status: effectiveBookingStatus(booking, today) }));
};

router.get('/mybookings', protectedRoute, async (req, res, next) => {
    try {
        const bookings = await Booking.find({ user: req.user.id })
            .populate('car', 'name images pricePerDay brand location color year').lean();
        res.json(withEffectiveStatus(bookings));
    } catch (err) {
        next(err);
    }
});

router.get('/', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        const bookings = await Booking.find().populate('user', 'name email')
            .populate('car', 'name images pricePerDay brand location color year').lean();
        res.json(withEffectiveStatus(bookings));
    } catch (err) {
        next(err);
    }
});

router.put('/:id/status', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        if (!validId(req.params.id)) throw new HttpError(400, 'Invalid booking ID');
        const { status } = req.body || {};
        if (typeof status !== 'string' || !Object.hasOwn(allowedTransitions, status)) {
            throw new HttpError(400, 'This booking status transition is not allowed');
        }
        const booking = await Booking.findById(req.params.id).lean();
        if (!booking) throw new HttpError(404, 'Booking not found');
        const today = getBusinessToday();
        if (booking.returnDate <= today) {
            throw new HttpError(400, 'The rental period for this booking has already ended — its status can no longer be changed');
        }
        if (!(allowedTransitions[booking.status] || []).includes(status)) {
            throw new HttpError(400, 'This booking status transition is not allowed');
        }
        if (['active', 'completed'].includes(status) && booking.pickupDate > today) {
            throw new HttpError(400, 'This rental cannot start or complete yet — the pickup date is still in the future');
        }

        const predicate = {
            _id: booking._id, user: booking.user, status: booking.status,
            returnDate: { $gt: today },
        };
        if (['active', 'completed'].includes(status)) predicate.pickupDate = { $lte: today };
        const updated = await Booking.findOneAndUpdate(predicate, { $set: { status } }, { new: true, runValidators: true });
        if (!updated) throw new HttpError(409, 'This booking changed; please refresh and try again', 'BOOKING_CHANGED');
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

router.put('/:id/cancel', protectedRoute, async (req, res, next) => {
    try {
        if (!validId(req.params.id)) throw new HttpError(400, 'Invalid booking ID');
        const booking = await Booking.findById(req.params.id).lean();
        if (!booking) throw new HttpError(404, 'Booking not found');
        if (booking.user.toString() !== req.user.id) {
            throw new HttpError(403, 'You can only cancel your own bookings');
        }
        if (!['pending', 'confirmed'].includes(booking.status)) {
            throw new HttpError(400, 'Only pending or confirmed bookings can be cancelled');
        }
        const today = getBusinessToday();
        if (booking.pickupDate <= today || booking.returnDate <= today) {
            throw new HttpError(400, 'Bookings can only be cancelled before the pickup date');
        }
        const updated = await Booking.findOneAndUpdate({
            _id: booking._id, user: req.user.id, status: booking.status,
            pickupDate: { $gt: today }, returnDate: { $gt: today },
        }, { $set: { status: 'cancelled' } }, { new: true, runValidators: true });
        if (!updated) throw new HttpError(409, 'This booking changed; please refresh and try again', 'BOOKING_CHANGED');
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
