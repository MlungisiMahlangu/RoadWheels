const express = require('express');
const ContactMessage = require('../models/ContactMessage');
const { protectedRoute, adminOnly } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');

const router = express.Router();
const FIELDS = '_id name email message isRead createdAt updatedAt';

function validateBody(body, allowed) {
    if (!body || (Object.getPrototypeOf(body) !== Object.prototype && Object.getPrototypeOf(body) !== null) ||
        Object.keys(body).some((key) => !allowed.includes(key))) throw new HttpError(400, 'Only supported fields in a plain object are allowed');
}

function text(value, field, max) {
    if (typeof value !== 'string' || value.length > max || !value.trim() ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
        throw new HttpError(400, `${field} must be a nonblank string of at most ${max} characters`);
    }
    return value.trim();
}

function messageDTO(message) {
    return Object.fromEntries(FIELDS.split(' ').filter((field) => message[field] !== undefined).map((field) => [field, message[field]]));
}

router.post('/', async (req, res, next) => {
    try {
        validateBody(req.body, ['name', 'email', 'message']);
        const name = text(req.body.name, 'Name', 120);
        const email = text(req.body.email, 'Email', 254).toLowerCase();
        const message = text(req.body.message, 'Message', 5000);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'A valid email is required');
        const contactMessage = await ContactMessage.create({ name, email, message });
        res.status(201).json(messageDTO(contactMessage));
    } catch (err) {
        next(err);
    }
});

router.get('/', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        const messages = await ContactMessage.find().select(FIELDS).sort({ createdAt: -1, _id: -1 }).lean();
        res.json(messages.map(messageDTO));
    } catch (err) {
        next(err);
    }
});

router.put('/:id/read', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        if (typeof req.params.id !== 'string' || !/^[a-f\d]{24}$/i.test(req.params.id)) throw new HttpError(400, 'Invalid message ID');
        if (req.body !== undefined) validateBody(req.body, []);
        const changed = await ContactMessage.findOneAndUpdate(
            { _id: req.params.id, isRead: { $ne: true } },
            { $set: { isRead: true } }, { new: true, runValidators: true }
        ).select(FIELDS);
        const message = changed || await ContactMessage.findById(req.params.id).select(FIELDS);
        if (!message) throw new HttpError(404, 'Message not found');
        res.json(messageDTO(message));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
