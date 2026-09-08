const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { protectedRoute, adminOnly } = require('../middleware/auth');

const router = express.Router();

//Signup Route
router.post('/signup', async (req, res) => {
    try{
        const { name, email ,password } = req.body;

        const existingUser = await User.findOne({ email });
        if(existingUser){
            return res.status(400).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, email, password: hashedPassword });

        const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }})
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});


//Login Route
router.post('/login', async (req, res) => {
    try{
        const { email , password } = req.body;

        const user= await User.findOne({ email });
        if(!user){
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        if (user.isSuspended) {
            return res.status(403).json({ message: 'This account has been suspended' });
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if(!isPasswordMatch){
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role }})
    } catch(err){
        res.status(500).json({ message: 'Server error' , error: err.message });
    }
});

// Get current user (protected)
router.get('/me', protectedRoute, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Update profile (name/phone/licenseNumber; email kept only if provided)
router.put('/me', protectedRoute, async (req, res) => {
  try {
    const { name, email, phone, licenseNumber } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (licenseNumber !== undefined) update.licenseNumber = licenseNumber;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Change password
router.put('/me/password', protectedRoute, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all users (admin only)
router.get('/users', protectedRoute, adminOnly, async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

// Toggle suspend (admin only)
router.put('/users/:id/suspend', protectedRoute, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: "Can't suspend an admin" });
    user.isSuspended = !user.isSuspended;
    await user.save();

    // When suspending, auto-cancel all active/pending/confirmed bookings for this user
    if (user.isSuspended) {
      await Booking.updateMany(
        { user: user._id, status: { $in: ['pending', 'confirmed', 'active'] } },
        { status: 'cancelled' }
      );
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
