const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bookingDates = require('../routes/bookingDates');

const USER_ID = '111111111111111111111111';
const OTHER_USER_ID = '222222222222222222222222';
const CAR_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
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
        _id: 'booking-1', user: USER_ID, car: CAR_ID, status: 'pending',
        pickupDate: date(TODAY), returnDate: date('2026-09-22'),
        save: t.mock.fn(async function () { return this; }),
        ...overrides,
    };
}

function fixture(t, options = {}) {
    const cars = options.cars || [{ _id: CAR_ID, name: 'Hatch [Sport]', brand: 'Road', pricePerDay: 350, isAvailable: true }];
    const bookings = options.bookings || [];
    const user = Object.hasOwn(options, 'user') ? options.user : { _id: USER_ID, role: 'user', isSuspended: false };
    const decoded = Object.hasOwn(options, 'decoded') ? options.decoded : { id: USER_ID, role: 'user' };
    const User = {
        findById: t.mock.fn(() => ({ select: t.mock.fn(async () => user) })),
    };
    const jwt = { verify: t.mock.fn(() => decoded) };
    const auth = loadModule('../middleware/auth.js', { jsonwebtoken: jwt, '../models/User': User });
    const Car = {
        findById: t.mock.fn(async (id) => cars.find((car) => car._id === id)),
        find: t.mock.fn((filter) => ({
            sort: t.mock.fn(async (order) => {
                const [key, direction] = Object.entries(order)[0];
                return cars.filter((car) => matches(car, filter)).sort((a, b) => {
                    return a[key] < b[key] ? -direction : a[key] > b[key] ? direction : 0;
                });
            }),
        })),
    };
    const Booking = {
        distinct: t.mock.fn(async (field, filter) => [...new Set(bookings.filter((item) => matches(item, filter)).map((item) => item[field]))]),
        findOne: t.mock.fn(async (filter) => bookings.find((item) => matches(item, filter))),
        findById: t.mock.fn(async (id) => bookings.find((item) => item._id === id)),
        create: t.mock.fn(async (data) => {
            const created = booking(t, data);
            bookings.push(created);
            return created;
        }),
        updateMany: t.mock.fn(async (filter, update) => {
            bookings.filter((item) => matches(item, filter)).forEach((item) => Object.assign(item, update.$set));
        }),
        find: t.mock.fn((filter) => {
            const result = Promise.resolve(bookings.filter((item) => matches(item, filter)));
            result.populate = () => result;
            return result;
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
        express, '../models/Car': Car, '../models/Booking': Booking,
        '../middleware/auth': auth, './bookingDates': bookingDates,
    };
    const routers = {
        cars: loadModule('../routes/carRoutes.js', dependencies),
        bookings: loadModule('../routes/bookingRoutes.js', dependencies),
    };
    async function request(resource, method, routePath, overrides = {}) {
        const route = routers[resource].routes.find((item) => item.method === method && item.path === routePath);
        assert.ok(route, 'Route must exist');
        const req = { headers: { authorization: 'Bearer valid-token' }, query: {}, body: {}, params: { id: 'booking-1' }, ...overrides };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
        };
        for (const handler of route.handlers) {
            let next = false;
            await handler(req, res, () => { next = true; });
            if (!next) break;
        }
        return { ...res, req };
    }
    return { request, Car, Booking, User, jwt, user, cars, bookings };
}

const admin = () => ({ _id: USER_ID, role: 'admin', isSuspended: false });
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
                assert.equal(res.statusCode, 400);
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
    assert.deepEqual(f.Booking.create.mock.calls[0].arguments[0], {
        user: USER_ID, car: CAR_ID, pickupDate: date(TODAY), returnDate: date('2026-09-22'), totalPrice: 1050,
    });
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
            assert.equal(item.save.mock.callCount(), allowed ? 1 : 0);
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

test('overdue status requests preserve automatic settlement without reopening terminal bookings', async (t) => {
    for (const returnDate of [date('2026-09-18'), date(TODAY)]) {
        for (const status of Object.keys(transitions)) {
            const item = booking(t, { status, pickupDate: date('2026-09-17'), returnDate });
            const f = fixture(t, { user: admin(), bookings: [item] });
            const res = await f.request('bookings', 'put', '/:id/status', { body: { status: 'confirmed' } });
            assert.equal(res.statusCode, 400);
            assert.equal(item.status, status === 'pending' ? 'cancelled' : status === 'confirmed' || status === 'active' ? 'completed' : status);
            assert.equal(item.save.mock.callCount(), ['pending', 'confirmed', 'active'].includes(status) ? 1 : 0);
        }
    }
});

test('both booking lists still settle overdue rentals and unapproved requests', async (t) => {
    for (const routePath of ['/', '/mybookings']) {
        const expired = Object.keys(transitions).map((status) => booking(t, { status, returnDate: date(TODAY) }));
        const future = booking(t, { status: 'confirmed', returnDate: date(TOMORROW) });
        const f = fixture(t, { bookings: [...expired, future], ...(routePath === '/' ? { user: admin() } : {}) });
        const res = await f.request('bookings', 'get', routePath);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(expired.map((item) => item.status), ['cancelled', 'completed', 'completed', 'completed', 'cancelled']);
        assert.equal(future.status, 'confirmed');
        assert.equal(f.Booking.updateMany.mock.callCount(), 2);
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
            assert.equal(item.save.mock.callCount(), allowed ? 1 : 0);
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
    const f = fixture(t, { decoded: { id: USER_ID, role: 'admin' } });
    assert.equal((await f.request('bookings', 'get', '/')).statusCode, 403);
    assert.equal(f.Booking.find.mock.callCount(), 0);
    f.user.role = 'admin';
    const promoted = await f.request('bookings', 'get', '/');
    assert.equal(promoted.statusCode, 200);
    assert.deepEqual(promoted.req.user, { id: USER_ID, role: 'admin' });
    f.user.isSuspended = true;
    assert.equal((await f.request('bookings', 'get', '/')).statusCode, 403);
    assert.equal(f.User.findById.mock.callCount(), 3);
});

test('account lookup failures fail closed without masquerading as invalid JWTs', async (t) => {
    const f = fixture(t);
    f.User.findById.mock.mockImplementation(() => ({ select: async () => { throw new Error('Database unavailable'); } }));
    const res = await f.request('bookings', 'get', '/mybookings');
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: 'Unable to verify account' });
    assert.equal(f.Booking.find.mock.callCount(), 0);
});
