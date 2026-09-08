const express = require('express');
const ContactMessage = require('../models/ContactMessage');
const { protectedRoute, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Submit a message (public — no login required)
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email and message are required' });
    }
    const contactMessage = await ContactMessage.create({ name, email, message });
    res.status(201).json(contactMessage);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all messages (admin only)
router.get('/', protectedRoute, adminOnly, async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Mark as read (admin only)
router.put('/:id/read', protectedRoute, adminOnly, async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!message) return res.status(404).json({ message: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;