const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('node:path');
const fs = require('node:fs');
const { HttpError, errorHandler } = require('../middleware/errors');
const authRoutes = require('../routes/authRoutes');
const carRoutes = require('../routes/carRoutes');
const bookingRoutes = require('../routes/bookingRoutes');
const contactRoutes = require('../routes/contactRoutes');
const reviewRoutes = require('../routes/reviewRoutes');

function createApp({ production = process.env.NODE_ENV === 'production', origins = process.env.CLIENT_ORIGINS || '', trustProxy = process.env.TRUST_PROXY || '' } = {}) {
    const app = express();
    app.disable('x-powered-by');
    if (trustProxy) {
        if (!/^\d+$/.test(trustProxy)) throw new Error('TRUST_PROXY must be an explicit proxy hop count.');
        app.set('trust proxy', Number(trustProxy));
    }
    const allowedOrigins = new Set(origins.split(',').map(value => value.trim()).filter(Boolean));
    if (!production) {
        allowedOrigins.add('http://localhost:5173');
        allowedOrigins.add('http://127.0.0.1:5173');
    }
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: production ? [] : null,
            },
        },
        strictTransportSecurity: production ? { maxAge: 31536000, includeSubDomains: true } : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
    app.use(cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) return callback(null, Boolean(origin));
            // Same-origin requests need no CORS headers, including behind a trusted proxy.
            return callback(null, false);
        },
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
    }));
    app.use('/api', (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    const limiter = (limit, windowMs, skipSuccessfulRequests = false) => rateLimit({
        windowMs, limit, skipSuccessfulRequests,
        standardHeaders: 'draft-8', legacyHeaders: false,
        message: { message: 'Too many requests. Please wait a little before trying again.', code: 'RATE_LIMITED' },
    });
    app.use('/api', limiter(600, 15 * 60 * 1000));
    app.use('/api/auth/login', limiter(20, 15 * 60 * 1000, true));
    app.use('/api/auth/signup', limiter(5, 60 * 60 * 1000));
    app.use('/api/auth/me/password', limiter(10, 15 * 60 * 1000));
    const contactLimit = limiter(5, 60 * 60 * 1000);
    app.use('/api/contact', (req, res, next) => req.method === 'POST' ? contactLimit(req, res, next) : next());
    const writeLimit = limiter(120, 15 * 60 * 1000);
    app.use('/api', (req, res, next) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : writeLimit(req, res, next));
    app.use(express.json({ limit: '32kb', strict: true }));
    app.use('/api/auth', authRoutes);
    app.use('/api/cars', carRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/contact', contactRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route not found.')));

    const clientPath = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(path.join(clientPath, 'index.html'))) {
        app.use('/assets', express.static(path.join(clientPath, 'assets'), { maxAge: '1y', immutable: true }));
        app.use(express.static(clientPath, { index: false, maxAge: '1h' }));
        app.get('/{*path}', (req, res, next) => {
            if (!req.accepts('html') || path.extname(req.path)) return next();
            res.set('Cache-Control', 'no-cache');
            res.sendFile(path.join(clientPath, 'index.html'));
        });
    }
    app.use((_req, _res, next) => next(new HttpError(404, 'Route not found.')));
    app.use(errorHandler);
    return app;
}

module.exports = { createApp };
