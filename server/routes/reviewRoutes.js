const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { protectedRoute } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { getBusinessToday, effectiveBookingStatus } = require('./bookingDates');

const router = express.Router();
const validId = (value) => typeof value === 'string' && value.length === 24 && /^[a-f\d]{24}$/i.test(value);
const transactionOptions = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
  maxCommitTimeMS: 5000,
  timeoutMS: 15000,
};

const requireEligibleBooking = (booking, userId) => {
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.user.toString() !== userId) {
    throw new HttpError(403, 'You can only review your own bookings');
  }
  if (effectiveBookingStatus(booking, getBusinessToday()) !== 'completed') {
    throw new HttpError(400, 'You can only review completed rentals');
  }
};

router.get('/car/:carId', async (req, res, next) => {
  try {
    if (!validId(req.params.carId)) throw new HttpError(400, 'Invalid car ID');
    const reviews = await Review.find({ car: req.params.carId })
      .select('_id rating comment createdAt user')
      .populate('user', 'name -_id')
      .sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

router.get('/mine', protectedRoute, async (req, res, next) => {
  try {
    const reviews = await Review.find({ user: req.user.id }).select('_id booking rating').lean();
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

router.post('/', protectedRoute, async (req, res, next) => {
  try {
    const { bookingId, rating, comment = '' } = req.body || {};
    if (!validId(bookingId)) throw new HttpError(400, 'Invalid booking ID');
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, 'Rating must be an integer between 1 and 5');
    }
    if (typeof comment !== 'string' || comment.trim().length > 500) {
      throw new HttpError(400, 'Comment must be a string of at most 500 characters');
    }

    // Locate the car before starting the transaction so its version write can
    // be the first operation. Recheck eligibility within the locked snapshot.
    const booking = await Booking.findById(bookingId).lean();
    requireEligibleBooking(booking, req.user.id);
    const review = await mongoose.connection.transaction(async (session) => {
      const car = await Car.findOneAndUpdate(
        { _id: booking.car }, { $inc: { reservationVersion: 1 } }, { session, new: true }
      ).lean();
      if (!car) throw new HttpError(404, 'Car not found');
      const current = await Booking.findById(bookingId).session(session).lean();
      requireEligibleBooking(current, req.user.id);
      if (current.car.toString() !== booking.car.toString()) {
        throw new HttpError(409, 'This booking changed; please refresh and try again', 'BOOKING_CHANGED');
      }
      const existing = await Review.findOne({ booking: bookingId }).session(session).lean();
      if (existing) throw new HttpError(409, 'You already reviewed this rental', 'REVIEW_EXISTS');

      const [created] = await Review.create([{
        user: req.user.id, car: current.car, booking: bookingId,
        rating, comment: comment.trim(),
      }], { session });
      const stats = await Review.aggregate([
        { $match: { car: current.car } },
        { $group: { _id: '$car', avgRating: { $avg: '$rating' } } },
      ]).session(session);
      await Car.findOneAndUpdate(
        { _id: current.car },
        { $set: { rating: Math.round(stats[0].avgRating * 10) / 10 } },
        { session, new: true, runValidators: true }
      );
      return created;
    }, transactionOptions);
    res.status(201).json(review);
  } catch (err) {
    next(err.code === 11000
      ? new HttpError(409, 'You already reviewed this rental', 'REVIEW_EXISTS')
      : err);
  }
});

module.exports = router;
