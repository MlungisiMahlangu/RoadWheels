const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bookingDates = require('../routes/bookingDates');
const errors = require('../middleware/errors');

const USER_ID = '111111111111111111111111';
const OTHER_USER_ID = '222222222222222222222222';
const CAR_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const BOOKING_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TODAY = '2026-09-19';
const TOMORROW = '2026-09-20';
const date = (value) => new Date(`${value}T00:00:00.000Z`);

beforeEach((t) => {
    // It is already September 19 in Johannesburg, but still September 18 in UTC.
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-18T22:30:00.000Z') });
});

// Evaluate CommonJS modules with an explicit dependency allowlist. No model,
// Express server, JWT secret, application entry point or database is loaded.
function loadModule(relativePath, dependencies) {
    const filename = path.resolve(__dirname, relativePath);
    const module = { exports: {} };
    const evaluate = vm.runInThisContext(
        `(function(require, module, exports) {\n${readFileSync(filename, 'utf8')}\n})`,
        { filename }
    );
    evaluate((name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
    }, module, module.exports);
    return module.exports;
}

// Implement only the Mongo predicates exercised by these routes, in memory.
function matches(record, filter = {}) {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === '$or') return expected.some((branch) => matches(record, branch));
        const actual = record[key];
        if (expected instanceof RegExp) return expected.test(actual || '');
        if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
            return Object.entries(expected).every(([operator, value]) => {
                switch (operator) {
                    case '$in': return value.includes(actual);
                    case '$nin': return !value.includes(actual);
                    case '$ne': return actual !== value;
                    case '$lt': return actual < value;
                    case '$lte': return actual <= value;
                    case '$gt': return actual > value;
                    default: assert.fail(`Unexpected operator: ${operator}`);
                }
            });
        }
        return actual === expected;
    });
}

function booking(t, overrides = {}) {
    return {
        _id: BOOKING_ID, user: USER_ID, car: CAR_ID, status: 'pending',
        pickupDate: date(TODAY), returnDate: date('2026-09-22'),
        save: t.mock.fn(async function () { return this; }),
        ...overrides,
    };
}

function fixture(t, options = {}) {
    const cars = options.cars || [{ _id: CAR_ID, name: 'Hatch [Sport]', brand: 'Road', pricePerDay: 350, isAvailable: true }];
    const bookings = options.bookings || [];
    const reviews = options.reviews || [];
    const user = Object.hasOwn(options, 'user') ? options.user : { _id: USER_ID, role: 'user', isSuspended: false, tokenVersion: 0 };
    const decoded = Object.hasOwn(options, 'decoded') ? options.decoded : { id: USER_ID, role: 'user', ver: 0 };
    const session = { testSession: true };
    const operations = [];
    const clone = (value) => Array.isArray(value) ? value.map(clone) : value ? { ...value } : value;
    const query = (value) => {
        const result = Promise.resolve(value);
        for (const method of ['populate', 'select', 'sort']) result[method] = t.mock.fn(() => result);
        result.session = t.mock.fn((actual) => { assert.equal(actual, session); return result; });
        result.lean = t.mock.fn(async () => clone(value));
        return result;
    };
    const mongoose = { connection: { transaction: t.mock.fn(async (callback, opts) => {
        assert.deepEqual(opts.readConcern, { level: 'snapshot' });
        assert.deepEqual(opts.writeConcern, { w: 'majority' });
        assert.equal(opts.readPreference, 'primary');
        assert.ok(opts.timeoutMS > 0 && opts.timeoutMS <= 30000);
        return callback(session);
    }) } };
    const User = {
        findById: t.mock.fn(() => ({ select: t.mock.fn(async () => user) })),
    };
    const jwt = { verify: t.mock.fn(() => decoded) };
    const auth = loadModule('../middleware/auth.js', { jsonwebtoken: jwt, '../models/User': User, './errors': errors });
    const Car = {
        findById: t.mock.fn((id) => query(cars.find((car) => car._id === id))),
        findOneAndUpdate: t.mock.fn((filter, update, opts) => {
            assert.equal(opts.session, session);
            operations.push(update.$inc ? 'car-lock' : 'car-rating');
            const car = cars.find((item) => matches(item, filter));
            if (car && update.$inc) car.reservationVersion = (car.reservationVersion || 0) + update.$inc.reservationVersion;
            if (car && update.$set) Object.assign(car, update.$set);
            return query(car);
        }),
        normalizeCategory: (value) => value === 'Minivan(MPV)' ? 'Minivan (MPV)' : value,
        find: t.mock.fn((filter) => {
            const selected = cars.filter((car) => matches(car, filter));
            const result = query(selected);
            result.sort.mock.mockImplementation((order) => {
                const [key, direction] = Object.entries(order)[0];
                selected.sort((a, b) => a[key] < b[key] ? -direction : a[key] > b[key] ? direction : 0);
                return result;
            });
            return result;
        }),
    };
    const Booking = {
        distinct: t.mock.fn(async (field, filter) => [...new Set(bookings.filter((item) => matches(item, filter)).map((item) => item[field]))]),
        findOne: t.mock.fn((filter) => {
            operations.push('booking-overlap');
            return query(bookings.find((item) => matches(item, filter)));
        }),
        findById: t.mock.fn((id) => query(bookings.find((item) => item._id === id))),
        create: t.mock.fn(async (data, opts) => {
            assert.equal(opts.session, session);
            assert.ok(Array.isArray(data));
            operations.push('booking-create');
            const created = data.map((item) => booking(t, item));
            bookings.push(...created);
            return created;
        }),
        findOneAndUpdate: t.mock.fn(async (filter, update) => {
            if (options.beforeBookingUpdate) await options.beforeBookingUpdate();
            const item = bookings.find((record) => matches(record, filter));
            if (!item) return null;
            Object.assign(item, update.$set);
            return clone(item);
        }),
        updateMany: t.mock.fn(async () => assert.fail('GET must never write lifecycle status')),
        find: t.mock.fn((filter) => query(bookings.filter((item) => matches(item, filter)))),
    };
    const Review = {
        findById: t.mock.fn((id) => query(reviews.find((item) => item._id === id))),
        findOne: t.mock.fn((filter) => query(reviews.find((item) => matches(item, filter)))),
        find: t.mock.fn((filter) => query(reviews.filter((item) => matches(item, filter)))),
        create: t.mock.fn(async (data, opts) => {
            assert.equal(opts.session, session);
            assert.ok(Array.isArray(data));
            operations.push('review-create');
            const created = data.map((item) => ({ _id: 'cccccccccccccccccccccccc', ...item }));
            reviews.push(...created);
            return created;
        }),
        aggregate: t.mock.fn((pipeline) => {
            operations.push('review-aggregate');
            const selected = reviews.filter((item) => matches(item, pipeline[0].$match));
            return query([{ avgRating: selected.reduce((sum, item) => sum + item.rating, 0) / selected.length }]);
        }),
    };
    const express = {
        Router() {
            const routes = [];
            const router = { routes };
            for (const method of ['get', 'post', 'put', 'delete']) {
                router[method] = (routePath, ...handlers) => routes.push({ method, path: routePath, handlers });
            }
            return router;
        },
    };
    const dependencies = {
        express, mongoose, '../models/Car': Car, '../models/Booking': Booking, '../models/Review': Review,
        '../middleware/auth': auth, '../middleware/errors': errors, './bookingDates': bookingDates,
    };
    const routers = {
        cars: loadModule('../routes/carRoutes.js', dependencies),
        bookings: loadModule('../routes/bookingRoutes.js', dependencies),
        reviews: loadModule('../routes/reviewRoutes.js', dependencies),
    };
    async function request(resource, method, routePath, overrides = {}) {
        const route = routers[resource].routes.find((item) => item.method === method && item.path === routePath);
        assert.ok(route, 'Route must exist');
        const req = { headers: { authorization: 'Bearer valid-token' }, query: {}, body: {}, params: { id: BOOKING_ID }, ...overrides };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
        };
        for (const handler of route.handlers) {
            let next = false;
            let failure;
            await handler(req, res, (err) => { next = true; failure = err; });
            if (failure) { errors.errorHandler(failure, req, res, () => {}); break; }
            if (!next) break;
        }
        return { ...res, req };
    }
    return { request, Car, Booking, Review, User, jwt, user, cars, bookings, reviews, session, operations, mongoose };
}

const admin = () => ({ _id: USER_ID, role: 'admin', isSuspended: false, tokenVersion: 0 });
const dates = { pickupDate: TODAY, returnDate: TOMORROW };
const invalidDatePairs = [
    ['missing both', {}],
    ['missing return', { pickupDate: TODAY }],
    ['missing pickup', { returnDate: TOMORROW }],
    ['empty strings', { pickupDate: '', returnDate: '' }],
    ['nonsense', { pickupDate: 'nonsense', returnDate: TOMORROW }],
    ['invalid return', { pickupDate: TODAY, returnDate: 'nonsense' }],
    ['non-leap February', { pickupDate: '2027-02-29', returnDate: '2027-03-02' }],
    ['invalid month length', { pickupDate: '2026-10-01', returnDate: '2026-11-31' }],
    ['invalid month', { pickupDate: '2026-13-01', returnDate: '2027-01-03' }],
    ['non-padded date', { pickupDate: '2026-9-19', returnDate: TOMORROW }],
    ['pickup timestamp', { pickupDate: '2026-09-19T00:00:00.000Z', returnDate: TOMORROW }],
    ['return timestamp', { pickupDate: TODAY, returnDate: '2026-09-20T00:00:00+02:00' }],
    ['numeric date', { pickupDate: 1790000000000, returnDate: TOMORROW }],
    ['null date', { pickupDate: TODAY, returnDate: null }],
    ['array date', { pickupDate: [TODAY], returnDate: TOMORROW }],
    ['object date', { pickupDate: TODAY, returnDate: { $gt: TODAY } }],
    ['equal bounds', { pickupDate: TODAY, returnDate: TODAY }],
    ['reversed bounds', { pickupDate: TOMORROW, returnDate: TODAY }],
    ['past in South Africa but today in UTC', { pickupDate: '2026-09-18', returnDate: TOMORROW }],
];

for (const [label, input] of invalidDatePairs) {
    test(`booking rejects ${label} before querying cars or bookings`, async (t) => {
        const f = fixture(t);
        const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, ...input } });
        assert.equal(res.statusCode, 400);
        assert.equal(f.Car.findById.mock.callCount(), 0);
        assert.equal(f.Car.findOneAndUpdate.mock.callCount(), 0);
        assert.equal(f.mongoose.connection.transaction.mock.callCount(), 0);
        assert.equal(f.Booking.findOne.mock.callCount(), 0);
        assert.equal(f.Booking.create.mock.callCount(), 0);
    });
    if (Object.keys(input).length) {
        test(`car date filter rejects ${label} before querying models`, async (t) => {
            const f = fixture(t);
            const res = await f.request('cars', 'get', '/', { query: input });
            assert.equal(res.statusCode, 400);
            assert.equal(f.Car.find.mock.callCount(), 0);
            assert.equal(f.Booking.distinct.mock.callCount(), 0);
        });
    }
}

test('car search treats brackets and every regex metacharacter literally', async (t) => {
    for (const search of ['[', '.*+?^${}()|[]\\', '(Sport)', 'road']) {
        const f = fixture(t, { cars: [{ _id: CAR_ID, name: `A ${search} car` }, { _id: 'other', name: 'Unrelated' }] });
        const res = await f.request('cars', 'get', '/', { query: { search: ` ${search} ` } });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.map((car) => car._id), [CAR_ID]);
        const pattern = f.Car.find.mock.calls[0].arguments[0].$or[0].brand;
        assert.ok(pattern.test(search.toUpperCase()));
        assert.equal(pattern.test('Unrelated'), false);
    }
});

test('all known car filters reject arrays, objects and other non-string values', async (t) => {
    const keys = ['location', 'category', 'transmission', 'brand', 'fuelType', 'search', 'sort', 'all', 'pickupDate', 'returnDate'];
    for (const key of keys) {
        for (const value of [['one', 'two'], { $ne: '' }, null, 1, true]) {
            const f = fixture(t);
            const res = await f.request('cars', 'get', '/', { query: { [key]: value } });
            assert.equal(res.statusCode, 400, key);
            assert.equal(f.Car.find.mock.callCount(), 0);
            assert.equal(f.Booking.distinct.mock.callCount(), 0);
        }
    }
});

test('car list preserves scalar filters, availability and sort choices', async (t) => {
    const query = { location: 'Cape Town', category: 'SUV', transmission: 'Automatic', brand: 'Road', fuelType: 'Petrol' };
    for (const [sort, expected] of [
        ['price-asc', { pricePerDay: 1 }], ['price-desc', { pricePerDay: -1 }],
        ['rating', { rating: -1 }], ['newest', { createdAt: -1 }],
        ['unknown', { createdAt: -1 }], ['toString', { createdAt: -1 }], ['__proto__', { createdAt: -1 }],
    ]) {
        const f = fixture(t);
        const res = await f.request('cars', 'get', '/', { query: { ...query, sort } });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(f.Car.find.mock.calls[0].arguments[0], { isAvailable: { $ne: false }, ...query });
        const sortMock = f.Car.find.mock.calls[0].result.sort;
        assert.deepEqual(sortMock.mock.calls[0].arguments[0], expected);
        assert.equal(f.Booking.distinct.mock.callCount(), 0);
    }
    const f = fixture(t, { cars: [{ _id: 'removed', isAvailable: false }, { _id: 'listed', isAvailable: true }] });
    assert.deepEqual((await f.request('cars', 'get', '/')).body.map((car) => car._id), ['listed']);
    assert.equal((await f.request('cars', 'get', '/', { query: { all: 'true' } })).statusCode, 403);
    f.user.role = 'admin';
    assert.equal((await f.request('cars', 'get', '/', { query: { all: 'true' } })).body.length, 2);
});

test('date-filtered car list excludes only overlapping pending/confirmed/active bookings', async (t) => {
    const bookings = ['pending', 'confirmed', 'active', 'cancelled', 'completed'].map((status) => booking(t, { car: status, status }));
    bookings.push(
        booking(t, { car: 'ends-at-pickup', pickupDate: date('2026-09-17'), returnDate: date(TODAY) }),
        booking(t, { car: 'starts-at-return', pickupDate: date(TOMORROW), returnDate: date('2026-09-22') }),
    );
    const cars = [...bookings.map((item) => ({ _id: item.car, isAvailable: true })), { _id: 'free' }, { _id: 'removed', isAvailable: false }];
    const f = fixture(t, { bookings, cars });
    const res = await f.request('cars', 'get', '/', { query: dates });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.map((car) => car._id), ['cancelled', 'completed', 'ends-at-pickup', 'starts-at-return', 'free']);
    assert.deepEqual(f.Booking.distinct.mock.calls[0].arguments, ['car', {
        status: { $in: ['pending', 'confirmed', 'active'] },
        pickupDate: { $lt: date(TOMORROW) }, returnDate: { $gt: date(TODAY) },
    }]);
    f.user.role = 'admin';
    const all = await f.request('cars', 'get', '/', { query: { ...dates, all: 'true' } });
    assert.deepEqual(all.body.map((car) => car._id), ['cancelled', 'completed', 'ends-at-pickup', 'starts-at-return', 'free', 'removed']);
});

test('booking rejects current admins even with a stale customer token', async (t) => {
    const f = fixture(t, { user: admin() });
    const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, ...dates } });
    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Admin/);
    assert.equal(f.Car.findById.mock.callCount(), 0);
    assert.equal(f.Booking.create.mock.callCount(), 0);
});

test('booking rejects missing and unavailable cars', async (t) => {
    for (const [cars, expectedStatus] of [ [[], 404], [[{ _id: CAR_ID, isAvailable: false }], 400] ]) {
        const f = fixture(t, { cars });
        const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, ...dates } });
        assert.equal(res.statusCode, expectedStatus);
        assert.equal(f.Booking.findOne.mock.callCount(), 0);
        assert.equal(f.Booking.create.mock.callCount(), 0);
    }
});

for (const status of ['pending', 'confirmed', 'active']) {
    test(`booking rejects ${status} overlaps, including partial intersections and containment`, async (t) => {
        for (const [pickupDate, returnDate] of [
            ['2026-09-20', '2026-09-22'], ['2026-09-19', '2026-09-21'],
            ['2026-09-21', '2026-09-23'], ['2026-09-19', '2026-09-23'],
            ['2026-09-21', '2026-09-22'],
        ]) {
            for (const user of [USER_ID, OTHER_USER_ID]) {
                const f = fixture(t, { bookings: [booking(t, { status, user, pickupDate: date(pickupDate), returnDate: date(returnDate) })] });
                const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, pickupDate: '2026-09-20', returnDate: '2026-09-22' } });
                assert.equal(res.statusCode, 409);
                assert.equal(res.body.code, 'BOOKING_CONFLICT');
                assert.match(res.body.message, user === USER_ID ? /already have a booking/ : /already booked/);
                assert.equal(f.Booking.create.mock.callCount(), 0);
            }
        }
    });
}

test('valid booking accepts adjacent ranges, other cars and terminal bookings; calculates day price', async (t) => {
    const f = fixture(t, { bookings: [
        booking(t, { pickupDate: date('2026-09-17'), returnDate: date(TODAY) }),
        booking(t, { pickupDate: date('2026-09-22'), returnDate: date('2026-09-23') }),
        booking(t, { car: 'another-car' }),
        booking(t, { status: 'completed' }), booking(t, { status: 'cancelled' }),
    ] });
    const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, pickupDate: TODAY, returnDate: '2026-09-22', totalPrice: 1, status: 'active' } });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.status, 'pending');
    assert.deepEqual(f.Booking.create.mock.calls[0].arguments, [[{
        user: USER_ID, car: CAR_ID, pickupDate: date(TODAY), returnDate: date('2026-09-22'), totalPrice: 1050,
    }], { session: f.session }]);
    assert.deepEqual(f.operations, ['car-lock', 'booking-overlap', 'booking-create']);
    assert.equal(f.Booking.findOne.mock.calls[0].result.session.mock.calls[0].arguments[0], f.session);
    assert.deepEqual(f.Car.findOneAndUpdate.mock.calls[0].arguments, [
        { _id: CAR_ID, isAvailable: true }, { $inc: { reservationVersion: 1 } }, { session: f.session, new: true },
    ]);
    assert.deepEqual(f.Booking.findOne.mock.calls[0].arguments[0], {
        car: CAR_ID, status: { $in: ['pending', 'confirmed', 'active'] },
        pickupDate: { $lt: date('2026-09-22') }, returnDate: { $gt: date(TODAY) },
    });
});

test('valid leap day is accepted by booking and car availability routes', async (t) => {
    const f = fixture(t);
    const query = { pickupDate: '2028-02-29', returnDate: '2028-03-01' };
    assert.equal((await f.request('cars', 'get', '/', { query })).statusCode, 200);
    const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, ...query } });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.totalPrice, 350);
});

const transitions = {
    pending: ['confirmed', 'cancelled'], confirmed: ['active', 'cancelled'],
    active: ['completed'], completed: [], cancelled: [],
};
for (const from of Object.keys(transitions)) {
    test(`status transitions from ${from} follow the whitelist`, async (t) => {
        for (const to of [...Object.keys(transitions), 'unknown', '', null, undefined, ['confirmed'], { status: 'confirmed' }]) {
            const item = booking(t, { status: from });
            const f = fixture(t, { user: admin(), bookings: [item] });
            const res = await f.request('bookings', 'put', '/:id/status', { body: { status: to } });
            const allowed = transitions[from].includes(to);
            assert.equal(res.statusCode, allowed ? 200 : 400, `${from} -> ${JSON.stringify(to)}`);
            assert.equal(item.status, allowed ? to : from);
            assert.equal(item.save.mock.callCount(), 0);
            assert.equal(f.Booking.findOneAndUpdate.mock.callCount(), allowed ? 1 : 0);
        }
    });
}

test('activation and completion cannot precede the South African pickup day', async (t) => {
    for (const [status, target] of [['confirmed', 'active'], ['active', 'completed']]) {
        const item = booking(t, { status, pickupDate: date(TOMORROW) });
        const f = fixture(t, { user: admin(), bookings: [item] });
        const res = await f.request('bookings', 'put', '/:id/status', { body: { status: target } });
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /future/);
        assert.equal(item.status, status);
        assert.equal(item.save.mock.callCount(), 0);
    }
});

test('overdue status requests return 400 without writing or reopening terminal bookings', async (t) => {
    for (const returnDate of [date('2026-09-18'), date(TODAY)]) {
        for (const status of Object.keys(transitions)) {
            const item = booking(t, { status, pickupDate: date('2026-09-17'), returnDate });
            const f = fixture(t, { user: admin(), bookings: [item] });
            const res = await f.request('bookings', 'put', '/:id/status', { body: { status: 'confirmed' } });
            assert.equal(res.statusCode, 400);
            assert.equal(item.status, status);
            assert.equal(item.save.mock.callCount(), 0);
            assert.equal(f.Booking.findOneAndUpdate.mock.callCount(), 0);
        }
    }
});

test('both booking lists project effective statuses without changing stored rentals', async (t) => {
    for (const routePath of ['/', '/mybookings']) {
        const expired = Object.keys(transitions).map((status) => booking(t, { status, returnDate: date(TODAY) }));
        const future = booking(t, { status: 'confirmed', returnDate: date(TOMORROW) });
        const f = fixture(t, { bookings: [...expired, future], ...(routePath === '/' ? { user: admin() } : {}) });
        const res = await f.request('bookings', 'get', routePath);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.map((item) => item.status), ['cancelled', 'completed', 'completed', 'completed', 'cancelled', 'confirmed']);
        assert.deepEqual(expired.map((item) => item.status), Object.keys(transitions));
        assert.equal(future.status, 'confirmed');
        assert.equal(f.Booking.updateMany.mock.callCount(), 0);
        assert.equal(f.Booking.findOneAndUpdate.mock.callCount(), 0);
        assert.equal(f.Booking.find.mock.calls[0].result.lean.mock.callCount(), 1);
    }
});

test('owners may cancel pending/confirmed bookings only before pickup', async (t) => {
    for (const status of ['pending', 'confirmed']) {
        for (const pickupDate of [date('2026-09-18'), date(TODAY), date(TOMORROW)]) {
            const item = booking(t, { status, pickupDate });
            const f = fixture(t, { bookings: [item] });
            const res = await f.request('bookings', 'put', '/:id/cancel');
            const allowed = pickupDate > date(TODAY);
            assert.equal(res.statusCode, allowed ? 200 : 400);
            assert.equal(item.status, allowed ? 'cancelled' : status);
            assert.equal(item.save.mock.callCount(), 0);
            assert.equal(f.Booking.findOneAndUpdate.mock.callCount(), allowed ? 1 : 0);
        }
    }
});

test('owner cancellation rejects active/terminal rentals and other owners', async (t) => {
    for (const status of ['active', 'completed', 'cancelled']) {
        const item = booking(t, { status, pickupDate: date(TOMORROW) });
        const f = fixture(t, { bookings: [item] });
        assert.equal((await f.request('bookings', 'put', '/:id/cancel')).statusCode, 400);
        assert.equal(item.save.mock.callCount(), 0);
    }
    const item = booking(t, { user: OTHER_USER_ID, pickupDate: date(TOMORROW) });
    const f = fixture(t, { bookings: [item] });
    assert.equal((await f.request('bookings', 'put', '/:id/cancel')).statusCode, 403);
    assert.equal(item.save.mock.callCount(), 0);
});

test('missing bookings still return 404 for status and cancellation routes', async (t) => {
    const f = fixture(t, { user: admin() });
    assert.equal((await f.request('bookings', 'put', '/:id/status', { body: { status: 'confirmed' } })).statusCode, 404);
    assert.equal((await f.request('bookings', 'put', '/:id/cancel')).statusCode, 404);
});

test('business calendar switches exactly at Johannesburg midnight, not host midnight', (t) => {
    t.mock.timers.setTime(new Date('2026-09-18T21:59:59.999Z').getTime());
    assert.equal(bookingDates.getBusinessToday().toISOString(), '2026-09-18T00:00:00.000Z');
    assert.ok(!bookingDates.validateBookingDates('2026-09-18', TODAY).error);
    t.mock.timers.setTime(new Date('2026-09-18T22:00:00.000Z').getTime());
    assert.equal(bookingDates.getBusinessToday().toISOString(), '2026-09-19T00:00:00.000Z');
    assert.match(bookingDates.validateBookingDates('2026-09-18', TODAY).error, /past/);
    assert.ok(!bookingDates.validateBookingDates(TODAY, TOMORROW).error);
});

test('auth rejects missing/malformed headers and invalid tokens before loading users', async (t) => {
    for (const authorization of [undefined, '', 'Basic value', ['Bearer token']]) {
        const f = fixture(t);
        const res = await f.request('bookings', 'get', '/mybookings', { headers: { authorization } });
        assert.equal(res.statusCode, 401);
        assert.equal(f.jwt.verify.mock.callCount(), 0);
        assert.equal(f.User.findById.mock.callCount(), 0);
    }
    const f = fixture(t);
    f.jwt.verify.mock.mockImplementation(() => { throw new Error('Invalid signature'); });
    assert.equal((await f.request('bookings', 'get', '/mybookings')).statusCode, 401);
    assert.equal(f.User.findById.mock.callCount(), 0);
});

test('auth rejects malformed verified identities without a database query', async (t) => {
    for (const decoded of [null, 'payload', {}, { id: 'invalid' }, { id: { $ne: null } }]) {
        const f = fixture(t, { decoded });
        assert.equal((await f.request('bookings', 'get', '/mybookings')).statusCode, 401);
        assert.equal(f.User.findById.mock.callCount(), 0);
    }
});

test('valid tokens cannot access protected routes after account deletion or suspension', async (t) => {
    for (const [user, status] of [[null, 401], [{ _id: USER_ID, role: 'user', isSuspended: true }, 403], [{ ...admin(), isSuspended: true }, 403]]) {
        const f = fixture(t, { user });
        const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, ...dates } });
        assert.equal(res.statusCode, status);
        assert.equal(f.User.findById.mock.callCount(), 1);
        assert.equal(f.Car.findById.mock.callCount(), 0);
        assert.equal(f.Booking.create.mock.callCount(), 0);
    }
});

test('auth refreshes role and suspension on every request', async (t) => {
    const f = fixture(t, { decoded: { id: USER_ID, role: 'admin', ver: 0 } });
    assert.equal((await f.request('bookings', 'get', '/')).statusCode, 403);
    assert.equal(f.Booking.find.mock.callCount(), 0);
    f.user.role = 'admin';
    const promoted = await f.request('bookings', 'get', '/');
    assert.equal(promoted.statusCode, 200);
    assert.deepEqual(promoted.req.user, { id: USER_ID, role: 'admin', tokenVersion: 0 });
    f.user.isSuspended = true;
    assert.equal((await f.request('bookings', 'get', '/')).statusCode, 403);
    assert.equal(f.User.findById.mock.callCount(), 3);
});

test('account lookup failures fail closed without masquerading as invalid JWTs', async (t) => {
    const f = fixture(t);
    f.User.findById.mock.mockImplementation(() => ({ select: async () => { throw new Error('Database unavailable'); } }));
    const res = await f.request('bookings', 'get', '/mybookings');
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: 'Something went wrong. Please try again.' });
    assert.equal(f.Booking.find.mock.callCount(), 0);
});

test('auth rejects absent, malformed and stale token versions', async (t) => {
    for (const ver of [undefined, null, '0', -1, 0.5, [], {}, 1]) {
        const f = fixture(t, { decoded: { id: USER_ID, ver } });
        assert.equal((await f.request('bookings', 'get', '/mybookings')).statusCode, 401);
        assert.equal(f.Booking.find.mock.callCount(), 0);
        assert.equal(f.User.findById.mock.callCount(), ver === 1 ? 1 : 0);
    }
});

test('strict IDs reject malformed strings, arrays and objects before any rental query', async (t) => {
    for (const id of [undefined, '', 'abcdefghijkl', 'z'.repeat(24), 'a'.repeat(23), 'a'.repeat(25), `${CAR_ID}\n`, `${CAR_ID}\r`, 123, [CAR_ID], { $ne: null }]) {
        const f = fixture(t, { user: admin() });
        for (const routePath of ['/:id/status', '/:id/cancel']) {
            assert.equal((await f.request('bookings', 'put', routePath, { params: { id }, body: { status: 'confirmed' } })).statusCode, 400);
        }
        assert.equal((await f.request('reviews', 'get', '/car/:carId', { params: { carId: id } })).statusCode, 400);
        assert.equal((await f.request('reviews', 'post', '/', { body: { bookingId: id, rating: 5 } })).statusCode, 400);
        const customer = fixture(t);
        assert.equal((await customer.request('bookings', 'post', '/', { body: { carId: id, ...dates } })).statusCode, 400);
        assert.equal(customer.mongoose.connection.transaction.mock.callCount(), 0);
        assert.equal(f.Booking.findById.mock.callCount(), 0);
        assert.equal(f.Review.find.mock.callCount(), 0);
    }
});

test('compare-and-set predicates protect against status, ownership and date changes', async (t) => {
    for (const routePath of ['/:id/status', '/:id/cancel']) {
        for (const change of [{ status: 'cancelled' }, { user: OTHER_USER_ID }, { returnDate: date(TODAY) }]) {
            const item = booking(t, { pickupDate: date(TOMORROW) });
            const f = fixture(t, { ...(routePath.endsWith('status') ? { user: admin() } : {}), bookings: [item],
                beforeBookingUpdate: () => Object.assign(item, change) });
            const res = await f.request('bookings', 'put', routePath, { body: { status: 'confirmed' } });
            assert.equal(res.statusCode, 409);
            assert.equal(res.body.code, 'BOOKING_CHANGED');
            assert.equal(item.save.mock.callCount(), 0);
            for (const [key, value] of Object.entries(change)) assert.deepEqual(item[key], value);
        }
    }
});

test('compare-and-set rechecks pickup restrictions on activation, completion and cancellation', async (t) => {
    for (const [routePath, status, target, pickup, changedPickup] of [
        ['/:id/status', 'confirmed', 'active', TODAY, TOMORROW],
        ['/:id/status', 'active', 'completed', TODAY, TOMORROW],
        ['/:id/cancel', 'pending', 'cancelled', TOMORROW, TODAY],
    ]) {
        const item = booking(t, { status, pickupDate: date(pickup) });
        const f = fixture(t, { ...(routePath.endsWith('status') ? { user: admin() } : {}), bookings: [item],
            beforeBookingUpdate: () => { item.pickupDate = date(changedPickup); } });
        const res = await f.request('bookings', 'put', routePath, { body: { status: target } });
        assert.equal(res.statusCode, 409);
        assert.equal(item.status, status);
        assert.equal(item.save.mock.callCount(), 0);
    }
});

test('booking transaction errors are delegated without database detail leakage', async (t) => {
    const f = fixture(t);
    f.mongoose.connection.transaction.mock.mockImplementation(async () => { throw new Error('private database credentials'); });
    const res = await f.request('bookings', 'post', '/', { body: { carId: CAR_ID, ...dates } });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: 'Something went wrong. Please try again.' });
});

test('review rating and comment types are strict and validated before booking lookup', async (t) => {
    for (const rating of [undefined, null, '5', true, 0, 6, 1.2, NaN, Infinity, [5], { valueOf: () => 5 }]) {
        const f = fixture(t);
        assert.equal((await f.request('reviews', 'post', '/', { body: { bookingId: BOOKING_ID, rating } })).statusCode, 400);
        assert.equal(f.Booking.findById.mock.callCount(), 0);
    }
    for (const comment of [null, 7, [], {}, 'x'.repeat(501)]) {
        const f = fixture(t);
        assert.equal((await f.request('reviews', 'post', '/', { body: { bookingId: BOOKING_ID, rating: 5, comment } })).statusCode, 400);
        assert.equal(f.Booking.findById.mock.callCount(), 0);
    }
});

test('review eligibility uses effective completion without settling the stored booking', async (t) => {
    for (const status of Object.keys(transitions)) {
        for (const returnDate of [date(TODAY), date(TOMORROW)]) {
            const item = booking(t, { status, returnDate });
            const f = fixture(t, { bookings: [item] });
            const res = await f.request('reviews', 'post', '/', { body: { bookingId: BOOKING_ID, rating: 4, comment: '  Great rental  ' } });
            const eligible = status === 'completed' || (returnDate <= date(TODAY) && ['confirmed', 'active'].includes(status));
            assert.equal(res.statusCode, eligible ? 201 : 400);
            assert.equal(item.status, status);
            assert.equal(item.save.mock.callCount(), 0);
            if (eligible) {
                assert.equal(res.body.comment, 'Great rental');
                assert.deepEqual(f.operations, ['car-lock', 'review-create', 'review-aggregate', 'car-rating']);
                assert.equal(f.Review.aggregate.mock.calls[0].result.session.mock.calls[0].arguments[0], f.session);
                assert.equal(f.cars[0].rating, 4);
            }
        }
    }
});

test('reviews reject missing bookings, other owners, missing cars and duplicates', async (t) => {
    for (const [options, expected] of [
        [{}, 404],
        [{ bookings: [booking(t, { status: 'completed', user: OTHER_USER_ID })] }, 403],
        [{ bookings: [booking(t, { status: 'completed' })], cars: [] }, 404],
        [{ bookings: [booking(t, { status: 'completed' })], reviews: [{ booking: BOOKING_ID }] }, 409],
    ]) {
        const f = fixture(t, options);
        const res = await f.request('reviews', 'post', '/', { body: { bookingId: BOOKING_ID, rating: 5 } });
        assert.equal(res.statusCode, expected);
        if (expected === 409) assert.equal(res.body.code, 'REVIEW_EXISTS');
        assert.equal(f.Review.create.mock.callCount(), 0);
    }
});

test('review unique-index races are stable conflicts; database details never escape', async (t) => {
    for (const code of [11000, 999]) {
        const f = fixture(t, { bookings: [booking(t, { status: 'completed' })] });
        f.Review.create.mock.mockImplementation(async () => { throw Object.assign(new Error('private database credentials'), { code }); });
        const res = await f.request('reviews', 'post', '/', { body: { bookingId: BOOKING_ID, rating: 5 } });
        assert.equal(res.statusCode, code === 11000 ? 409 : 500);
        if (code === 11000) assert.equal(res.body.code, 'REVIEW_EXISTS');
        assert.doesNotMatch(JSON.stringify(res.body), /credentials|private|999|11000/);
    }
});

test('review lists request explicit minimal projections and lean responses', async (t) => {
    const f = fixture(t);
    assert.equal((await f.request('reviews', 'get', '/car/:carId', { params: { carId: CAR_ID } })).statusCode, 200);
    const publicQuery = f.Review.find.mock.calls[0].result;
    assert.deepEqual(publicQuery.select.mock.calls[0].arguments, ['_id rating comment createdAt user']);
    assert.deepEqual(publicQuery.populate.mock.calls[0].arguments, ['user', 'name -_id']);
    assert.equal(publicQuery.lean.mock.callCount(), 1);
    assert.equal((await f.request('reviews', 'get', '/mine')).statusCode, 200);
    assert.deepEqual(f.Review.find.mock.calls[1].arguments, [{ user: USER_ID }]);
    assert.deepEqual(f.Review.find.mock.calls[1].result.select.mock.calls[0].arguments, ['_id booking rating']);
});

test('effective status is pure across the return-day boundary', (t) => {
    for (const status of Object.keys(transitions)) {
        const item = Object.freeze(booking(t, { status, returnDate: date(TODAY) }));
        assert.equal(bookingDates.effectiveBookingStatus(item, date('2026-09-18')), status);
        const terminal = status === 'pending' ? 'cancelled' : ['confirmed', 'active'].includes(status) ? 'completed' : status;
        assert.equal(bookingDates.effectiveBookingStatus(item, date(TODAY)), terminal);
        assert.equal(bookingDates.effectiveBookingStatus(item, date(TOMORROW)), terminal);
        assert.equal(item.status, status);
    }
});
