const express = require('express');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const { protectedRoute } = require('../middleware/auth');

const router = express.Router();

// Recalculate a car's average rating from its reviews
const updateCarRating = async (carId) => {
  const stats = await Review.aggregate([
    { $match: { car: carId } },
    { $group: { _id: '$car', avgRating: { $avg: '$rating' } } },
  ]);
  if (stats.length > 0) {
    await Car.findByIdAndUpdate(carId, { rating: Math.round(stats[0].avgRating * 10) / 10 });
  }
};

// Get reviews for a car (public)
router.get('/car/:carId', async (req, res) => {
  try {
    const reviews = await Review.find({ car: req.params.carId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get the logged-in user's own reviews (used to mark reviewed bookings)
router.get('/mine', protectedRoute, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user.id }).select('booking rating');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create a review (logged-in user, only for their completed bookings, one per booking)
router.post('/', protectedRoute, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ message: 'Booking and rating are required' });
    }
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only review your own bookings' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'You can only review completed rentals' });
    }

    const existing = await Review.findOne({ booking: bookingId });
    if (existing) return res.status(400).json({ message: 'You already reviewed this rental' });

    const review = await Review.create({
      user: req.user.id,
      car: booking.car,
      booking: bookingId,
      rating: Number(rating),
      comment: comment || '',
    });

    await updateCarRating(booking.car);

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
