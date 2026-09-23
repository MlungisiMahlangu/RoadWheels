const express = require('express');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const { protectedRoute, adminOnly } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');
const { validateBookingDates, getBusinessToday } = require('./bookingDates');
const router = express.Router();

const TEXT_LIMITS = { name: 120, brand: 80, description: 5000, category: 60, color: 60, location: 120 };
const EDITABLE = [...Object.keys(TEXT_LIMITS), 'images', 'pricePerDay', 'transmission', 'fuelType', 'seats', 'year', 'mileage', 'features', 'isAvailable'];
const CAR_FIELDS = ['_id', ...EDITABLE, 'rating', 'createdAt', 'updatedAt'];
const FILTER_LIMITS = { location: 120, category: 60, transmission: 20, brand: 80, fuelType: 20, search: 120, sort: 30, all: 5, pickupDate: 10, returnDate: 10 };

function plainObject(value, allowed) {
    if (!value || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
        Object.keys(value).some((key) => !allowed.includes(key))) {
        throw new HttpError(400, 'Only supported fields in a plain object are allowed');
    }
}

function text(value, field, max, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
        (!allowEmpty && !value.trim())) throw new HttpError(400, `${field} must be ${allowEmpty ? 'a' : 'a nonblank'} string of at most ${max} characters`);
    return value.trim();
}

function validateId(id) {
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, 'Invalid car ID');
}

function carDTO(car) {
    return Object.fromEntries(CAR_FIELDS.filter((field) => car[field] !== undefined).map((field) => [field, car[field]]));
}

function carInput(body, creating = false) {
    plainObject(body, EDITABLE);
    if (!Object.keys(body).length) throw new HttpError(400, 'At least one editable field is required');
    const result = {};
    for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
        if (creating || Object.hasOwn(body, field)) result[field] = text(body[field], field, limit);
    }
    if (result.category !== undefined) result.category = Car.normalizeCategory(result.category);
    const ranges = { pricePerDay: [0, 100000], seats: [1, 60], year: [1950, new Date().getFullYear() + 2], mileage: [0, 2000000] };
    for (const [field, [min, max]] of Object.entries(ranges)) {
        if (!Object.hasOwn(body, field) && !(creating && field !== 'mileage')) continue;
        const value = body[field];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
            (field === 'pricePerDay' && value === 0) || (['seats', 'year'].includes(field) && !Number.isInteger(value))) {
            throw new HttpError(400, `${field} is outside its permitted numeric range`);
        }
        result[field] = value;
    }
    for (const [field, choices] of Object.entries({ transmission: ['Manual', 'Automatic'], fuelType: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] })) {
        if (!creating && !Object.hasOwn(body, field)) continue;
        const value = text(body[field], field, 20);
        if (!choices.includes(value)) throw new HttpError(400, `Invalid ${field}`);
        result[field] = value;
    }
    for (const [field, maxItems, maxLength] of [['images', 20, 2048], ['features', 50, 100]]) {
        if (!Object.hasOwn(body, field)) continue;
        if (!Array.isArray(body[field]) || body[field].length > maxItems) throw new HttpError(400, `${field} must be an array of at most ${maxItems} strings`);
        result[field] = body[field].map((item) => {
            const value = text(item, field, maxLength);
            if (field === 'images' && (/[\u0000-\u001f\u007f]/.test(item) || !Car.isSafeImageUrl(value))) {
                throw new HttpError(400, 'Images must use HTTP(S) URLs or safe root-relative paths');
            }
            return value;
        });
    }
    if (Object.hasOwn(body, 'isAvailable')) {
        if (typeof body.isAvailable !== 'boolean') throw new HttpError(400, 'isAvailable must be a boolean');
        result.isAvailable = body.isAvailable;
    }
    return result;
}

function validateFilters(req, res, next) {
    try {
        plainObject(req.query, Object.keys(FILTER_LIMITS));
        req.carFilters = {};
        for (const [key, value] of Object.entries(req.query)) req.carFilters[key] = text(value, key, FILTER_LIMITS[key], true);
        if (req.carFilters.all !== undefined && !['true', 'false'].includes(req.carFilters.all)) throw new HttpError(400, 'all must be true or false');
        next();
    } catch (err) {
        next(err);
    }
}

const requireListingAdmin = (req, res, next) => {
    if (req.carFilters.all !== 'true') return next();
    return protectedRoute(req, res, (err) => err ? next(err) : adminOnly(req, res, next));
};
const optionalAuth = (req, res, next) => req.headers.authorization === undefined ? next() : protectedRoute(req, res, next);

async function visibleCar(req) {
    validateId(req.params.id);
    const car = await Car.findById(req.params.id).select(CAR_FIELDS.join(' '));
    if (!car || (car.isAvailable === false && req.user?.role !== 'admin')) throw new HttpError(404, 'Car not found');
    return car;
}

router.get('/', validateFilters, requireListingAdmin, async (req, res, next) => {
    try {
        const { location, category, transmission, brand, fuelType, search, sort, all, pickupDate, returnDate } = req.carFilters;
        const filter = all === 'true' ? {} : { isAvailable: { $ne: false } };
        if (pickupDate !== undefined || returnDate !== undefined) {
            const { pickup, returnD, error } = validateBookingDates(pickupDate, returnDate);
            if (error) throw new HttpError(400, error);
            const bookedCarIds = await Booking.distinct('car', {
                status: { $in: ['pending', 'confirmed', 'active'] },
                pickupDate: { $lt: returnD }, returnDate: { $gt: pickup },
            });
            filter._id = { $nin: bookedCarIds };
        }
        if (location) filter.location = location;
        if (category) filter.category = Car.normalizeCategory(category) === 'Minivan (MPV)' ? { $in: ['Minivan (MPV)', 'Minivan(MPV)'] } : category;
        if (transmission) filter.transmission = transmission;
        if (brand) filter.brand = brand;
        if (fuelType) filter.fuelType = fuelType;
        if (search) {
            const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ brand: pattern }, { name: pattern }];
        }
        const sortOptions = {
            'price-asc': { pricePerDay: 1 }, 'price-desc': { pricePerDay: -1 },
            rating: { rating: -1 }, newest: { createdAt: -1 },
        };
        const sortBy = Object.hasOwn(sortOptions, sort) ? sortOptions[sort] : { createdAt: -1 };
        const cars = await Car.find(filter).select(CAR_FIELDS.join(' ')).sort(sortBy).lean();
        res.json(cars.map(carDTO));
    } catch (err) {
        next(err);
    }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        res.json(carDTO(await visibleCar(req)));
    } catch (err) {
        next(err);
    }
});

router.get('/:id/availability', optionalAuth, async (req, res, next) => {
    try {
        await visibleCar(req);
        // Include on-road rentals until their return day, but never past bookings,
        // customer identifiers, booking IDs, prices or statuses.
        const bookings = await Booking.find({
            car: req.params.id, status: { $in: ['pending', 'confirmed', 'active'] },
            returnDate: { $gt: getBusinessToday() },
        }).select('pickupDate returnDate -_id').sort({ pickupDate: 1 }).lean();
        res.json(bookings.map(({ pickupDate, returnDate }) => ({ pickupDate, returnDate })));
    } catch (err) {
        next(err);
    }
});

router.post('/', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        const car = await Car.create(carInput(req.body, true));
        res.status(201).json(carDTO(car));
    } catch (err) {
        next(err);
    }
});

router.put('/:id', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        validateId(req.params.id);
        const update = carInput(req.body);
        const car = await Car.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).select(CAR_FIELDS.join(' '));
        if (!car) throw new HttpError(404, 'Car not found');
        res.json(carDTO(car));
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', protectedRoute, adminOnly, async (req, res, next) => {
    try {
        validateId(req.params.id);
        const car = await Car.findByIdAndUpdate(req.params.id, { $set: { isAvailable: false } }, { new: true, runValidators: true }).select('_id');
        if (!car) throw new HttpError(404, 'Car not found');
        res.json({ message: 'Car removed from listings' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
