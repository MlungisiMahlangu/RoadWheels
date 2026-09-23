const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { HttpError, errorHandler } = require('../middleware/errors');
const bookingDates = require('../routes/bookingDates');
const UserModel = require('../models/User');
const CarModel = require('../models/Car');
const ContactModel = require('../models/ContactMessage');

// Schema validation and explicitly allowlisted in-memory model mocks only:
// no application entry point, environment file, HTTP listener or Mongo connection.
const SECRET = 'local-security-tests-only-not-a-deployment-secret';
const USER_ID = '111111111111111111111111';
const ADMIN_ID = '222222222222222222222222';
const CAR_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const MESSAGE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const MISSING_ID = 'ffffffffffffffffffffffff';
const PASSWORD = 'Original1!';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const copy = (value) => value === undefined ? undefined : structuredClone(value);
const token = (id = USER_ID, ver = 0, role = 'user', options = {}) => jwt.sign({ id, role, ver }, SECRET, { algorithm: 'HS256', expiresIn: '1d', ...options });
const headers = (id = USER_ID, ver = 0, role = 'user') => ({ authorization: `Bearer ${token(id, ver, role)}` });
const adminHeaders = () => headers(ADMIN_ID, 0, 'admin');
const carData = (extra = {}) => ({
    name: 'Roadster', brand: 'Road', description: 'A reliable rental', location: 'Cape Town',
    pricePerDay: 500, category: 'Sedan', transmission: 'Automatic', fuelType: 'Petrol',
    seats: 5, color: 'Blue', year: 2025, mileage: 0, images: ['/images/car.jpg'], features: ['Air conditioning'], ...extra,
});

function loadModule(relativePath, dependencies) {
    const filename = path.resolve(__dirname, relativePath);
    const module = { exports: {} };
    const evaluate = vm.runInThisContext(`(function(require, module, exports, process) {\n${readFileSync(filename, 'utf8')}\n})`, { filename });
    evaluate((name) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
    }, module, module.exports, { env: { JWT_SECRET: SECRET } });
    return module.exports;
}

function matches(record, filter = {}) {
    return Object.entries(filter).every(([key, expected]) => {
        if (key === '$or') return expected.some((branch) => matches(record, branch));
        const actual = record[key];
        if (expected instanceof RegExp) return expected.test(actual || '');
        if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
            return Object.entries(expected).every(([operator, value]) => {
                switch (operator) {
                    case '$ne': return actual !== value;
                    case '$in': return value.includes(actual);
                    case '$nin': return !value.includes(actual);
                    case '$exists': return (actual !== undefined) === value;
                    case '$gt': return actual > value;
                    case '$lt': return actual < value;
                    default: assert.fail(`Unexpected predicate: ${operator}`);
                }
            });
        }
        return actual === expected;
    });
}

function query(getValue, hidden = []) {
    const state = { projection: '', order: null, lean: false };
    const project = (record) => {
        if (!record) return record;
        const fields = state.projection.split(/\s+/).filter(Boolean);
        const included = fields.filter((field) => !/^[+-]/.test(field));
        const result = included.length ? Object.fromEntries(Object.entries(record).filter(([key]) => key === '_id' || included.includes(key) || fields.includes(`+${key}`))) : copy(record);
        for (const key of hidden) if (!fields.includes(`+${key}`) && !included.includes(key)) delete result[key];
        for (const field of fields.filter((field) => field.startsWith('-'))) delete result[field.slice(1)];
        return copy(result);
    };
    return {
        state,
        select(value) { state.projection = value; return this; },
        sort(value) { state.order = value; return this; },
        lean() { state.lean = true; return this; },
        then(resolve, reject) {
            return Promise.resolve().then(getValue).then((value) => {
                if (!Array.isArray(value)) return project(value);
                const result = value.map(project);
                if (state.order) result.sort((a, b) => {
                    for (const [key, direction] of Object.entries(state.order)) {
                        if (a[key] < b[key]) return -direction;
                        if (a[key] > b[key]) return direction;
                    }
                    return 0;
                });
                return result;
            }).then(resolve, reject);
        },
    };
}

function mockModel(t, records, defaults = {}, hidden = []) {
    const update = (filter, change) => {
        const record = records.find((item) => matches(item, filter));
        if (!record) return null;
        assert.ok(Object.keys(change).every((key) => ['$set', '$inc'].includes(key)), 'Only explicit update operators are allowed');
        Object.assign(record, copy(change.$set || {}));
        for (const [key, value] of Object.entries(change.$inc || {})) record[key] = (record[key] ?? 0) + value;
        record.updatedAt = new Date((record.updatedAt?.getTime() || 0) + 1000);
        return record;
    };
    return {
        findById: t.mock.fn((id) => query(() => records.find((record) => record._id === id) || null, hidden)),
        findOne: t.mock.fn((filter) => query(() => records.find((record) => matches(record, filter)) || null, hidden)),
        find: t.mock.fn((filter) => query(() => records.filter((record) => matches(record, filter)), hidden)),
        findByIdAndUpdate: t.mock.fn((id, change) => query(() => update({ _id: id }, change), hidden)),
        findOneAndUpdate: t.mock.fn((filter, change) => query(() => update(filter, change), hidden)),
        create: t.mock.fn(async (data) => {
            const record = { _id: MISSING_ID, __v: 0, ...copy(defaults), ...copy(data) };
            records.push(record);
            return copy(record);
        }),
    };
}

function fixture(t) {
    const users = [
        { _id: USER_ID, name: 'Customer', email: 'customer@example.test', password: HASH, role: 'user', tokenVersion: 0, isSuspended: false, phone: '', licenseNumber: '' },
        { _id: ADMIN_ID, name: 'Admin', email: 'admin@example.test', password: HASH, role: 'admin', tokenVersion: 0, isSuspended: false },
    ];
    const cars = [{ _id: CAR_ID, ...carData(), rating: 4, isAvailable: true, reservationVersion: 7 }];
    const messages = [{ _id: MESSAGE_ID, name: 'Customer', email: 'customer@example.test', message: 'Hello', isRead: false }];
    const bookings = [];
    const User = mockModel(t, users, { role: 'user', tokenVersion: 0, isSuspended: false }, ['password', 'tokenVersion']);
    const Car = Object.assign(mockModel(t, cars, { rating: 0, isAvailable: true, reservationVersion: 0 }, ['reservationVersion']), {
        normalizeCategory: CarModel.normalizeCategory, isSafeImageUrl: CarModel.isSafeImageUrl,
    });
    const Contact = mockModel(t, messages, { isRead: false });
    const Booking = {
        find: t.mock.fn((filter) => query(() => bookings.filter((record) => matches(record, filter)))),
        distinct: t.mock.fn(async (field, filter) => [...new Set(bookings.filter((record) => matches(record, filter)).map((record) => record[field]))]),
    };
    const crypto = { hash: t.mock.fn(bcrypt.hash), compare: t.mock.fn(bcrypt.compare) };
    const jwtMock = { sign: t.mock.fn(jwt.sign), verify: t.mock.fn(jwt.verify) };
    const auth = loadModule('../middleware/auth.js', { jsonwebtoken: jwtMock, '../models/User': User, './errors': { HttpError } });
    const express = {
        Router() {
            const router = { routes: [] };
            for (const method of ['get', 'post', 'put', 'delete']) router[method] = (routePath, ...handlers) => router.routes.push({ method, path: routePath, handlers });
            return router;
        },
    };
    const shared = { express, '../middleware/auth': auth, '../middleware/errors': { HttpError } };
    const routers = {
        // Deliberately no Booking dependency: suspension must never load or mutate it.
        auth: loadModule('../routes/authRoutes.js', { ...shared, '../models/User': User, bcryptjs: crypto, jsonwebtoken: jwtMock }),
        cars: loadModule('../routes/carRoutes.js', { ...shared, '../models/Car': Car, '../models/Booking': Booking, './bookingDates': bookingDates }),
        contact: loadModule('../routes/contactRoutes.js', { ...shared, '../models/ContactMessage': Contact }),
    };
    async function request(resource, method, routePath, overrides = {}) {
        const route = routers[resource].routes.find((item) => item.method === method && item.path === routePath);
        assert.ok(route);
        const req = { body: {}, query: {}, params: { id: resource === 'cars' ? CAR_ID : resource === 'contact' ? MESSAGE_ID : USER_ID }, headers: headers(), ...overrides };
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        for (const handler of route.handlers) {
            let advance = false;
            await handler(req, res, (err) => {
                if (err) {
                    res.error = err;
                    errorHandler(err, req, res, (unexpected) => { throw unexpected; });
                } else advance = true;
            });
            if (!advance) break;
        }
        return { ...res, req };
    }
    return { request, users, cars, messages, bookings, User, Car, Contact, Booking, crypto, jwt: jwtMock };
}

function safeUser(user) {
    assert.ok(user.id && user._id);
    for (const key of ['password', 'tokenVersion', '__v']) assert.equal(Object.hasOwn(user, key), false, `${key} must stay private`);
}

const badObjects = [undefined, null, [], 'text', 123, true, new Date(), Object.assign(Object.create({ injected: true }), { name: 'Customer' })];

test('schemas hide credentials/internal versions and enforce bounded car/contact/user fields without a database', () => {
    assert.equal(UserModel.schema.path('password').options.select, false);
    assert.equal(UserModel.schema.path('tokenVersion').options.select, false);
    assert.equal(UserModel.schema.path('tokenVersion').defaultValue, 0);
    assert.equal(CarModel.schema.path('reservationVersion').options.select, false);
    const user = new UserModel({ name: ' Customer ', email: ' PERSON@EXAMPLE.TEST ', password: HASH, tokenVersion: 3 });
    assert.equal(user.validateSync(), undefined);
    assert.equal(user.email, 'person@example.test');
    assert.equal(user.toJSON().password, undefined);
    assert.equal(user.toJSON().tokenVersion, undefined);
    assert.ok(new UserModel({ name: ' ', email: 'bad', password: HASH }).validateSync());
    assert.ok(new UserModel({ name: 'x'.repeat(121), email: 'a@b.test', password: HASH }).validateSync());
    assert.ok(new ContactModel({ name: 'A', email: 'a@b.test', message: 'x'.repeat(5001) }).validateSync());
    for (const input of [
        { pricePerDay: -1 }, { pricePerDay: 0 }, { pricePerDay: Infinity }, { pricePerDay: 100001 },
        { seats: 0 }, { seats: 61 }, { seats: 1.5 }, { year: 1949 }, { year: new Date().getFullYear() + 3 },
        { year: 2025.5 }, { mileage: -1 }, { mileage: 2000001 }, { images: ['javascript:alert(1)'] },
        { features: [' '] }, { images: Array(21).fill('/a.jpg') }, { features: Array(51).fill('A') },
        { description: ' ' }, { name: 'x'.repeat(121) },
    ]) assert.ok(new CarModel(carData(input)).validateSync(), JSON.stringify(input));
    const car = new CarModel(carData({ category: 'Minivan(MPV)', pricePerDay: 100000, seats: 60, year: 1950, mileage: 2000000 }));
    assert.equal(car.validateSync(), undefined);
    assert.equal(car.category, 'Minivan (MPV)');
    assert.equal(car.reservationVersion, 0);
    assert.equal(car.toJSON().reservationVersion, undefined);
    // Cast locally, never execute: schema setters must not erase the legacy query variant.
    const variants = ['Minivan (MPV)', 'Minivan(MPV)'];
    const castFilter = CarModel.find({ category: { $in: variants } }).cast(CarModel);
    assert.deepEqual(castFilter.category.$in, variants);
    assert.ok(CarModel.schema.indexes().length >= 2);
    assert.ok(ContactModel.schema.indexes().length >= 2);
});

test('signup rejects non-objects, mass assignment, operators and malformed fields before querying', async (t) => {
    const base = { name: 'Person', email: 'person@example.test', password: PASSWORD };
    for (const body of [
        ...badObjects, { ...base, role: 'admin' }, { ...base, tokenVersion: 9 }, { ...base, $set: { role: 'admin' } },
        { ...base, email: { $ne: null } }, { ...base, email: ['person@example.test'] }, { ...base, name: ['A'] },
        { ...base, name: ' ' }, { ...base, name: 'x'.repeat(121) }, { ...base, email: 'x'.repeat(255) },
        { ...base, email: 'not-an-email' }, { ...base, password: ['Password1!'] }, { ...base, password: 'weakpass' },
        { ...base, password: 'lowercase1!' }, { ...base, password: 'NoNumbers!' }, { ...base, password: 'NoSpecial1' },
        { ...base, password: 'A1!' }, { ...base, password: 'A1!' + 'é'.repeat(35) },
    ]) {
        const f = fixture(t);
        const res = await f.request('auth', 'post', '/signup', { body });
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(f.User.findOne.mock.callCount(), 0);
        assert.equal(f.User.create.mock.callCount(), 0);
    }
});

test('signup normalizes email before lookup, accepts exactly 72 UTF-8 bytes and signs one-day HS256 tokens', async (t) => {
    const f = fixture(t);
    const password = 'A1!!' + 'é'.repeat(34);
    assert.equal(Buffer.byteLength(password), 72);
    const res = await f.request('auth', 'post', '/signup', { body: { name: ' Person ', email: ' PERSON@EXAMPLE.TEST ', password } });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(f.User.findOne.mock.calls[0].arguments, [{ email: 'person@example.test' }]);
    assert.equal(res.body.user.name, 'Person');
    safeUser(res.body.user);
    assert.equal(await bcrypt.compare(password, f.users.at(-1).password), true);
    const decoded = jwt.verify(res.body.token, SECRET, { algorithms: ['HS256'] });
    assert.equal(decoded.ver, 0);
    assert.equal(decoded.exp - decoded.iat, 86400);
    assert.deepEqual(f.jwt.sign.mock.calls[0].arguments[2], { algorithm: 'HS256', expiresIn: '1d' });
    const duplicate = await f.request('auth', 'post', '/signup', { body: { name: 'Another', email: 'person@example.test', password } });
    assert.equal(duplicate.statusCode, 400);
});

test('login validates input before lookup but permits legacy passwords without signup strength rules', async (t) => {
    const f = fixture(t);
    f.users[0].password = bcrypt.hashSync('legacy88', 4);
    const res = await f.request('auth', 'post', '/login', { body: { email: ' CUSTOMER@EXAMPLE.TEST ', password: 'legacy88' } });
    assert.equal(res.statusCode, 200);
    safeUser(res.body.user);
    assert.match(f.User.findOne.mock.calls[0].result.state.projection, /\+password/);
    assert.match(f.User.findOne.mock.calls[0].result.state.projection, /\+tokenVersion/);
    for (const password of [null, [], {}, 123, '', 'a'.repeat(73), 'é'.repeat(37)]) {
        const invalid = fixture(t);
        assert.equal((await invalid.request('auth', 'post', '/login', { body: { email: 'customer@example.test', password } })).statusCode, 400);
        assert.equal(invalid.User.findOne.mock.callCount(), 0);
    }
    for (const email of [null, [], { $gt: '' }, 'bad']) {
        const invalid = fixture(t);
        assert.equal((await invalid.request('auth', 'post', '/login', { body: { email, password: PASSWORD } })).statusCode, 400);
        assert.equal(invalid.User.findOne.mock.callCount(), 0);
    }
    assert.equal((await f.request('auth', 'post', '/login', { body: { email: 'missing@example.test', password: PASSWORD } })).statusCode, 401);
    f.users[0].isSuspended = true;
    const suspended = await f.request('auth', 'post', '/login', { body: { email: 'customer@example.test', password: 'legacy88' } });
    assert.equal(suspended.statusCode, 403);
    assert.equal(suspended.body.code, 'ACCOUNT_SUSPENDED');
});

test('authentication rejects malformed headers, legacy JWTs, bad identities/versions, expiry and non-HS256 algorithms', async (t) => {
    const invalidTokens = [
        'not-a-jwt', jwt.sign({ id: USER_ID }, SECRET), jwt.sign({ id: USER_ID, ver: 0 }, SECRET, { algorithm: 'HS512' }),
        jwt.sign({ id: USER_ID, ver: 0 }, '', { algorithm: 'none' }), token(USER_ID, 0, 'user', { expiresIn: -1 }),
        ...[null, {}, [], 'short', 'g'.repeat(24)].map((id) => jwt.sign({ id, ver: 0 }, SECRET)),
        ...[null, '0', -1, 0.5, [], {}, Number.MAX_SAFE_INTEGER + 1].map((ver) => jwt.sign({ id: USER_ID, ver }, SECRET)),
    ];
    for (const authorization of [undefined, '', [], 'Basic token', 'Bearer ', 'Bearer token extra', ...invalidTokens.map((value) => `Bearer ${value}`)]) {
        const f = fixture(t);
        const res = await f.request('auth', 'get', '/me', { headers: { authorization } });
        assert.equal(res.statusCode, 401);
        assert.equal(f.User.findById.mock.callCount(), 0);
    }
});

test('protected routes use live role/version/suspension and reject missing or deleted users', async (t) => {
    const f = fixture(t);
    assert.equal((await f.request('auth', 'get', '/users', { headers: headers(USER_ID, 0, 'admin') })).statusCode, 403);
    f.users[0].role = 'admin';
    const promoted = await f.request('auth', 'get', '/users');
    assert.equal(promoted.statusCode, 200);
    assert.equal(promoted.req.user.role, 'admin');
    const projection = f.User.findById.mock.calls[0].result.state.projection;
    for (const field of ['role', 'isSuspended', '+tokenVersion']) assert.ok(projection.includes(field));
    assert.deepEqual(f.jwt.verify.mock.calls[0].arguments[2], { algorithms: ['HS256'] });
    f.users[0].tokenVersion = 1;
    assert.equal((await f.request('auth', 'get', '/me')).statusCode, 401);
    f.users[0].isSuspended = true;
    const suspended = await f.request('auth', 'get', '/me', { headers: headers(USER_ID, 1) });
    assert.equal(suspended.statusCode, 403);
    assert.equal(suspended.body.code, 'ACCOUNT_SUSPENDED');
    f.users.splice(0, 1);
    assert.equal((await f.request('auth', 'get', '/me', { headers: headers(USER_ID, 1) })).statusCode, 401);
    assert.equal((await f.request('auth', 'get', '/me', { headers: headers(MISSING_ID) })).statusCode, 401);
});

test('profile accepts normalized unchanged email, uses validated $set and rejects privilege/email edits', async (t) => {
    const f = fixture(t);
    const res = await f.request('auth', 'put', '/me', { body: { name: ' Renamed ', email: ' CUSTOMER@EXAMPLE.TEST ', phone: ' 123 ', licenseNumber: ' ABC ' } });
    assert.equal(res.statusCode, 200);
    safeUser(res.body);
    assert.deepEqual(f.User.findByIdAndUpdate.mock.calls[0].arguments.slice(1), [
        { $set: { name: 'Renamed', phone: '123', licenseNumber: 'ABC' } }, { new: true, runValidators: true },
    ]);
    for (const body of [
        ...badObjects, { email: 'changed@example.test' }, { role: 'admin' }, { password: 'hacked' }, { tokenVersion: 0 },
        { isSuspended: false }, { $set: { name: 'Hacked' } }, { name: { $gt: '' } }, { phone: [] },
        { name: ' ' }, { phone: 'x'.repeat(33) }, { licenseNumber: 'x'.repeat(65) },
    ]) {
        const invalid = fixture(t);
        assert.equal((await invalid.request('auth', 'put', '/me', { body })).statusCode, 400);
        assert.equal(invalid.User.findByIdAndUpdate.mock.callCount(), 0);
    }
});

test('password change atomically rotates the hash/version, returns safe user/token and revokes other sessions', async (t) => {
    const f = fixture(t);
    const oldToken = token();
    const res = await f.request('auth', 'put', '/me/password', { body: { currentPassword: PASSWORD, newPassword: 'Changed2!' } });
    assert.equal(res.statusCode, 200);
    safeUser(res.body.user);
    assert.equal(f.users[0].tokenVersion, 1);
    assert.equal(await bcrypt.compare('Changed2!', f.users[0].password), true);
    const [filter, update, options] = f.User.findOneAndUpdate.mock.calls[0].arguments;
    assert.equal(filter.password, HASH);
    assert.deepEqual(filter.$or, [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }]);
    assert.deepEqual(filter.isSuspended, { $ne: true });
    assert.deepEqual(update.$inc, { tokenVersion: 1 });
    assert.equal(options.runValidators, true);
    assert.equal((await f.request('auth', 'get', '/me', { headers: { authorization: `Bearer ${oldToken}` } })).statusCode, 401);
    assert.equal((await f.request('auth', 'get', '/me', { headers: { authorization: `Bearer ${res.body.token}` } })).statusCode, 200);
    assert.equal(jwt.verify(res.body.token, SECRET).ver, 1);
});

test('password change rejects bad boundaries and wrong current passwords without updates', async (t) => {
    for (const body of [
        ...badObjects, { currentPassword: PASSWORD, newPassword: 'weakpass' },
        { currentPassword: { $ne: null }, newPassword: 'Changed2!' },
        { currentPassword: PASSWORD, newPassword: 'A1!' + 'é'.repeat(35) },
        { currentPassword: 'x'.repeat(73), newPassword: 'Changed2!' },
        { currentPassword: 'wrong', newPassword: 'Changed2!' },
    ]) {
        const f = fixture(t);
        assert.equal((await f.request('auth', 'put', '/me/password', { body })).statusCode, 400);
        assert.equal(f.User.findOneAndUpdate.mock.callCount(), 0);
    }
});

test('concurrent password changes have one winner; deletion, suspension or changed hash cannot be overwritten', async (t) => {
    const f = fixture(t);
    const results = await Promise.all(['Changed2!', 'Changed3!'].map((newPassword) => f.request('auth', 'put', '/me/password', { body: { currentPassword: PASSWORD, newPassword } })));
    assert.deepEqual(results.map((res) => res.statusCode).sort(), [200, 401]);
    assert.equal(f.users[0].tokenVersion, 1);
    for (const mutate of [
        (state) => state.users.splice(0, 1),
        (state) => { state.users[0].isSuspended = true; state.users[0].tokenVersion += 1; },
        (state) => { state.users[0].password = 'a-different-hash'; },
    ]) {
        const state = fixture(t);
        state.crypto.hash.mock.mockImplementation(async () => { mutate(state); return 'must-not-be-saved'; });
        const res = await state.request('auth', 'put', '/me/password', { body: { currentPassword: PASSWORD, newPassword: 'Changed2!' } });
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.token, undefined);
        assert.equal(state.users.some((user) => user.password === 'must-not-be-saved'), false);
    }
});

test('legacy database records accept version-zero JWTs and rotate missing tokenVersion atomically', async (t) => {
    const f = fixture(t);
    delete f.users[0].tokenVersion;
    assert.equal((await f.request('auth', 'get', '/me')).statusCode, 200);
    const res = await f.request('auth', 'put', '/me/password', { body: { currentPassword: PASSWORD, newPassword: 'Changed2!' } });
    assert.equal(res.statusCode, 200);
    assert.equal(f.users[0].tokenVersion, 1);
});

test('suspension is an idempotent CAS that revokes sessions without changing ANY booking', async (t) => {
    const f = fixture(t);
    f.bookings.push(...['pending', 'confirmed', 'active', 'completed', 'cancelled'].map((status) => ({ user: USER_ID, car: CAR_ID, status })));
    const before = copy(f.bookings);
    const set = (isSuspended) => f.request('auth', 'put', '/users/:id/suspend', { headers: adminHeaders(), body: { isSuspended } });
    const suspended = await Promise.all([set(true), set(true)]);
    for (const res of suspended) { assert.equal(res.statusCode, 200); safeUser(res.body); }
    assert.equal(f.users[0].tokenVersion, 1);
    const modified = f.users[0].updatedAt.getTime();
    assert.equal((await set(true)).statusCode, 200);
    assert.equal(f.users[0].updatedAt.getTime(), modified);
    assert.equal((await f.request('auth', 'get', '/me')).body.code, 'ACCOUNT_SUSPENDED');
    await Promise.all([set(false), set(false)]);
    assert.equal(f.users[0].tokenVersion, 2);
    assert.equal(f.users[0].isSuspended, false);
    assert.equal((await f.request('auth', 'get', '/me')).statusCode, 401);
    assert.deepEqual(f.bookings, before);
    assert.equal(f.Booking.find.mock.callCount(), 0);
    assert.equal(f.Booking.distinct.mock.callCount(), 0);
    delete f.users[0].isSuspended;
    await set(false);
    assert.equal(f.users[0].tokenVersion, 2);
});

test('suspension rejects non-boolean bodies, admin targets, invalid IDs and missing users', async (t) => {
    for (const body of [...badObjects, {}, { isSuspended: 'true' }, { isSuspended: 1 }, { isSuspended: {} }, { isSuspended: true, role: 'admin' }]) {
        const f = fixture(t);
        assert.equal((await f.request('auth', 'put', '/users/:id/suspend', { headers: adminHeaders(), body })).statusCode, 400);
        assert.equal(f.User.findOneAndUpdate.mock.callCount(), 0);
    }
    const f = fixture(t);
    const request = (id) => f.request('auth', 'put', '/users/:id/suspend', { headers: adminHeaders(), params: { id }, body: { isSuspended: true } });
    assert.equal((await request('invalid')).statusCode, 400);
    assert.equal((await request(MISSING_ID)).statusCode, 404);
    assert.equal((await request(ADMIN_ID)).statusCode, 400);
    assert.equal(f.users[1].tokenVersion, 0);
    assert.equal((await f.request('auth', 'put', '/users/:id/suspend', { body: { isSuspended: true } })).statusCode, 403);
});

test('admin user list preserves its array shape with explicit safe projection, lean and stable sort', async (t) => {
    const f = fixture(t);
    const res = await f.request('auth', 'get', '/users', { headers: adminHeaders() });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    res.body.forEach(safeUser);
    const state = f.User.find.mock.calls[0].result.state;
    assert.equal(state.lean, true);
    assert.deepEqual(state.order, { createdAt: -1, _id: -1 });
    assert.equal(/password|tokenVersion/.test(state.projection), false);
});

test('car writes reject numeric boundaries, operators, internal fields and non-plain bodies before writes', async (t) => {
    const patches = [
        { pricePerDay: -1 }, { pricePerDay: 0 }, { pricePerDay: 100001 }, { pricePerDay: Infinity }, { pricePerDay: NaN }, { pricePerDay: '100' },
        { seats: 0 }, { seats: 61 }, { seats: 1.1 }, { year: 1949 }, { year: new Date().getFullYear() + 3 }, { year: 2025.5 },
        { mileage: -1 }, { mileage: 2000001 }, { mileage: null }, { name: {} }, { name: ' ' }, { brand: [] }, { description: 'x'.repeat(5001) },
        { location: 'x'.repeat(121) }, { color: 'x'.repeat(61) }, { transmission: 'Flying' }, { fuelType: {} }, { isAvailable: 'false' },
        { rating: 5 }, { reservationVersion: 0 }, { _id: MISSING_ID }, { createdAt: 'yesterday' }, { __v: 0 }, { $set: { pricePerDay: -1 } }, { 'name.$ne': 'x' },
    ];
    for (const patch of patches) {
        for (const method of ['post', 'put']) {
            const f = fixture(t);
            const res = await f.request('cars', method, method === 'post' ? '/' : '/:id', { headers: adminHeaders(), body: method === 'post' ? carData(patch) : patch });
            assert.equal(res.statusCode, 400, JSON.stringify(patch));
            assert.equal(f.Car.create.mock.callCount(), 0);
            assert.equal(f.Car.findByIdAndUpdate.mock.callCount(), 0);
        }
    }
    for (const body of [...badObjects, {}]) {
        const f = fixture(t);
        assert.equal((await f.request('cars', 'post', '/', { headers: adminHeaders(), body })).statusCode, 400);
        assert.equal(f.Car.create.mock.callCount(), 0);
    }
});

test('car writes normalize Minivan, trim arrays, allow boundary values and never disclose or overwrite internal fields', async (t) => {
    const f = fixture(t);
    const created = await f.request('cars', 'post', '/', { headers: adminHeaders(), body: carData({ category: ' Minivan(MPV) ', images: [' https://example.test/car.jpg ', '/cars/a.jpg'], features: [' Air conditioning '], pricePerDay: 100000, seats: 60, year: 1950, mileage: 2000000 }) });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.category, 'Minivan (MPV)');
    assert.deepEqual(created.body.features, ['Air conditioning']);
    assert.equal(created.body.reservationVersion, undefined);
    assert.equal(created.body.__v, undefined);
    const res = await f.request('cars', 'put', '/:id', { headers: adminHeaders(), body: { name: ' Updated ', category: 'Minivan(MPV)' } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(f.Car.findByIdAndUpdate.mock.calls[0].arguments.slice(1), [
        { $set: { name: 'Updated', category: 'Minivan (MPV)' } }, { new: true, runValidators: true },
    ]);
    assert.equal(f.cars[0].reservationVersion, 7);
    assert.equal(f.cars[0].rating, 4);
    assert.equal(res.body.reservationVersion, undefined);
});

test('car image and feature arrays reject dangerous URLs, objects, empty items and oversized arrays', async (t) => {
    const unsafe = ['javascript:alert(1)', 'data:image/png;base64,abc', '//evil.test/a.jpg', '/\\evil.test/a.jpg', 'https:\\evil.test/a.jpg', '/a\nb.jpg', '\n/a.jpg', '/%2fevil.test/a', '/%5cevil.test/a', 'https://a.test/%0aevil', 'ftp://example.test/a', 'relative.jpg', 'https://', 'https://user:pass@example.test/a'];
    for (const images of [...unsafe.map((value) => [value]), [{ $ne: '' }], [123], [' '], ['x'.repeat(2049)], Array(21).fill('/a'), '/a', null]) {
        const f = fixture(t);
        assert.equal((await f.request('cars', 'put', '/:id', { headers: adminHeaders(), body: { images } })).statusCode, 400);
        assert.equal(f.Car.findByIdAndUpdate.mock.callCount(), 0);
    }
    for (const features of [[{}], [''], ['x'.repeat(101)], Array(51).fill('A'), 'A']) {
        const f = fixture(t);
        assert.equal((await f.request('cars', 'put', '/:id', { headers: adminHeaders(), body: { features } })).statusCode, 400);
    }
    for (const value of ['/a.jpg', 'http://example.test/a.jpg', 'https://example.test/a.jpg?size=2']) assert.equal(CarModel.isSafeImageUrl(value), true);
});

test('all=true requires authentication plus live admin privileges while ordinary lists stay public', async (t) => {
    const f = fixture(t);
    f.cars.push({ _id: MISSING_ID, ...carData(), isAvailable: false, reservationVersion: 8 });
    assert.equal((await f.request('cars', 'get', '/', { headers: {}, query: { all: 'true' } })).statusCode, 401);
    assert.equal((await f.request('cars', 'get', '/', { query: { all: 'true' } })).statusCode, 403);
    assert.equal(f.Car.find.mock.callCount(), 0);
    const publicList = await f.request('cars', 'get', '/', { headers: {} });
    assert.equal(publicList.body.length, 1);
    const all = await f.request('cars', 'get', '/', { headers: adminHeaders(), query: { all: 'true' } });
    assert.equal(all.body.length, 2);
    for (const car of all.body) assert.equal(car.reservationVersion, undefined);
});

test('car query operators/unknown fields and non-string filters are rejected before database queries', async (t) => {
    for (const key of ['location', 'category', 'brand', 'fuelType', 'transmission', 'search', 'sort', 'all', 'pickupDate', 'returnDate']) {
        for (const value of [[], { $ne: null }, null, 5, true]) {
            const f = fixture(t);
            assert.equal((await f.request('cars', 'get', '/', { query: { [key]: value }, headers: {} })).statusCode, 400);
            assert.equal(f.Car.find.mock.callCount(), 0);
            assert.equal(f.Booking.distinct.mock.callCount(), 0);
        }
    }
    for (const query of [{ $where: 'true' }, { 'brand[$ne]': '' }, { reservationVersion: '0' }, { search: 'x'.repeat(121) }, { all: 'yes' }]) {
        const f = fixture(t);
        assert.equal((await f.request('cars', 'get', '/', { query, headers: {} })).statusCode, 400);
        assert.equal(f.Car.find.mock.callCount(), 0);
    }
});

test('car search is literal, Minivan filters match both stored variants without writes, and invalid dates do not query bookings', async (t) => {
    const f = fixture(t);
    f.cars[0].category = 'Minivan(MPV)';
    f.cars.push({ _id: MISSING_ID, ...carData({ category: 'Minivan (MPV)' }), isAvailable: true });
    for (const category of ['Minivan(MPV)', 'Minivan (MPV)']) {
        const res = await f.request('cars', 'get', '/', { query: { category } });
        assert.equal(res.body.length, 2);
        assert.deepEqual(f.Car.find.mock.calls.at(-1).arguments[0].category, { $in: ['Minivan (MPV)', 'Minivan(MPV)'] });
    }
    f.cars[0].name = 'Literal .*+?^${}()|[]\\';
    const literal = await f.request('cars', 'get', '/', { query: { search: '.*+?^${}()|[]\\' } });
    assert.deepEqual(literal.body.map((car) => car._id), [CAR_ID]);
    assert.equal(f.Car.findByIdAndUpdate.mock.callCount(), 0);
    for (const query of [{ pickupDate: '2099-02-29', returnDate: '2099-03-01' }, { pickupDate: '2099-01-01' }, { pickupDate: '2000-01-01', returnDate: '2000-01-02' }]) {
        assert.equal((await f.request('cars', 'get', '/', { query })).statusCode, 400);
    }
    assert.equal(f.Booking.distinct.mock.callCount(), 0);
});

test('unavailable car detail and availability return 404 except to authenticated admins; IDs are strict', async (t) => {
    for (const routePath of ['/:id', '/:id/availability']) {
        const f = fixture(t);
        f.cars[0].isAvailable = false;
        assert.equal((await f.request('cars', 'get', routePath, { headers: {} })).statusCode, 404);
        assert.equal((await f.request('cars', 'get', routePath)).statusCode, 404);
        assert.equal((await f.request('cars', 'get', routePath, { headers: adminHeaders() })).statusCode, 200);
        assert.equal((await f.request('cars', 'get', routePath, { headers: {}, params: { id: MISSING_ID } })).statusCode, 404);
        for (const id of ['abcdefghijkl', 'z'.repeat(24), { $ne: null }]) {
            const before = f.Car.findById.mock.callCount();
            assert.equal((await f.request('cars', 'get', routePath, { headers: {}, params: { id } })).statusCode, 400);
            assert.equal(f.Car.findById.mock.callCount(), before);
        }
    }
});

test('availability returns only future-ending active ranges with the minimal date projection', async (t) => {
    const f = fixture(t);
    const today = bookingDates.getBusinessToday();
    const day = (offset) => new Date(today.getTime() + offset * 86400000);
    f.bookings.push(
        { _id: 'past', car: CAR_ID, user: USER_ID, status: 'confirmed', pickupDate: day(-2), returnDate: today },
        { _id: 'on-road', car: CAR_ID, user: USER_ID, status: 'active', pickupDate: day(-1), returnDate: day(2), totalPrice: 999 },
        { _id: 'future', car: CAR_ID, user: USER_ID, status: 'pending', pickupDate: day(3), returnDate: day(4) },
        { _id: 'cancelled', car: CAR_ID, user: USER_ID, status: 'cancelled', pickupDate: day(3), returnDate: day(4) },
    );
    const res = await f.request('cars', 'get', '/:id/availability', { headers: {} });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 2);
    res.body.forEach((range) => assert.deepEqual(Object.keys(range).sort(), ['pickupDate', 'returnDate']));
    assert.equal(f.Booking.find.mock.calls[0].result.state.projection, 'pickupDate returnDate -_id');
});

test('contact submission strictly validates strings and creates only normalized allowlisted fields', async (t) => {
    const base = { name: 'Person', email: 'person@example.test', message: 'Hello' };
    for (const body of [
        ...badObjects, { ...base, name: [] }, { ...base, name: ' ' }, { ...base, name: 'x'.repeat(121) },
        { ...base, email: { $ne: '' } }, { ...base, email: 'bad' }, { ...base, email: 'x'.repeat(255) },
        { ...base, message: ['Hi'] }, { ...base, message: ' ' }, { ...base, message: 'x'.repeat(5001) },
        { ...base, isRead: true }, { ...base, $set: { isRead: true } },
    ]) {
        const f = fixture(t);
        assert.equal((await f.request('contact', 'post', '/', { body, headers: {} })).statusCode, 400);
        assert.equal(f.Contact.create.mock.callCount(), 0);
    }
    const f = fixture(t);
    const res = await f.request('contact', 'post', '/', { headers: {}, body: { name: ' Person ', email: ' PERSON@EXAMPLE.TEST ', message: ' Hello\nWorld ' } });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(f.Contact.create.mock.calls[0].arguments, [{ name: 'Person', email: 'person@example.test', message: 'Hello\nWorld' }]);
    assert.equal(res.body.isRead, false);
    assert.equal(res.body.__v, undefined);
});

test('contact admin marking is idempotent CAS with validated IDs, and lists remain arrays', async (t) => {
    const f = fixture(t);
    assert.equal((await f.request('contact', 'put', '/:id/read')).statusCode, 403);
    assert.equal((await f.request('contact', 'get', '/', { headers: {} })).statusCode, 401);
    const mark = () => f.request('contact', 'put', '/:id/read', { headers: adminHeaders(), body: undefined });
    const results = await Promise.all([mark(), mark()]);
    results.forEach((res) => assert.equal(res.statusCode, 200));
    const updatedAt = f.messages[0].updatedAt.getTime();
    await mark();
    assert.equal(f.messages[0].isRead, true);
    assert.equal(f.messages[0].updatedAt.getTime(), updatedAt);
    assert.deepEqual(f.Contact.findOneAndUpdate.mock.calls[0].arguments, [
        { _id: MESSAGE_ID, isRead: { $ne: true } }, { $set: { isRead: true } }, { new: true, runValidators: true },
    ]);
    assert.equal((await f.request('contact', 'put', '/:id/read', { headers: adminHeaders(), params: { id: 'bad' } })).statusCode, 400);
    assert.equal((await f.request('contact', 'put', '/:id/read', { headers: adminHeaders(), params: { id: MISSING_ID } })).statusCode, 404);
    const list = await f.request('contact', 'get', '/', { headers: adminHeaders() });
    assert.ok(Array.isArray(list.body));
    assert.equal(f.Contact.find.mock.calls[0].result.state.lean, true);
});

test('account deletion during a protected handler returns 401 rather than leaking or crashing', async (t) => {
    for (const [method, routePath, body] of [
        ['get', '/me', {}], ['put', '/me', { name: 'Person' }], ['put', '/me/password', { currentPassword: PASSWORD, newPassword: 'Changed2!' }],
    ]) {
        const f = fixture(t);
        let calls = 0;
        f.User.findById.mock.mockImplementation(() => query(() => ++calls === 1 ? copy(f.users[0]) : null));
        assert.equal((await f.request('auth', method, routePath, { body })).statusCode, 401);
        assert.equal(f.User.findOneAndUpdate.mock.callCount(), 0);
    }
});

test('unexpected model failures pass to shared error handling without raw error JSON', async (t) => {
    t.mock.method(console, 'error', () => {});
    for (const [resource, model, method, routePath, operation, body] of [
        ['auth', 'User', 'get', '/me', 'findById', {}],
        ['auth', 'User', 'get', '/users', 'find', {}],
        ['cars', 'Car', 'get', '/', 'find', {}],
        ['contact', 'Contact', 'post', '/', 'create', { name: 'Person', email: 'person@example.test', message: 'Hello' }],
    ]) {
        const f = fixture(t);
        const error = new Error('SECRET_DATABASE_CONNECTION_STRING');
        f[model][operation].mock.mockImplementation(() => { throw error; });
        const res = await f.request(resource, method, routePath, { body, headers: adminHeaders() });
        assert.equal(res.statusCode, 500);
        assert.equal(res.error, error);
        assert.equal(JSON.stringify(res.body).includes('SECRET_DATABASE'), false);
        assert.equal(Object.hasOwn(res.body, 'error'), false);
    }
});
