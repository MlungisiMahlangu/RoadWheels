const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, test } = require('node:test');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Car = require('../models/Car');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { errorHandler } = require('../middleware/errors');
const { getBusinessToday } = require('../routes/bookingDates');

const USER_ID = '111111111111111111111111';
const OTHER_USER_ID = '222222222222222222222222';
const ADMIN_ID = '333333333333333333333333';
const CAR_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_SECRET = 'local-rental-integrity-test-only-secret';
const DAY_MS = 86400000;
let today;
const day = (offset) => new Date(today.getTime() + offset * DAY_MS);
const dateString = (offset) => day(offset).toISOString().slice(0, 10);

// Real routes and authentication, but never the production app/config/bootstrap.
// The only database URI is generated here by an ephemeral local replica set.
describe('rental integrity on an isolated local replica set', { timeout: 240000, concurrency: false }, () => {
    let replSet;
    let server;
    let baseUrl;
    let previousSecret;
    const commands = [];
    const tokens = {};

    before(async () => {
        previousSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = TEST_SECRET;
        replSet = await MongoMemoryReplSet.create({
            replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
            instanceOpts: [{ ip: '127.0.0.1' }],
        });
        const uri = replSet.getUri('roadwheels_rental_integrity');
        // Fail closed before connecting or deleting anything. No credentials,
        // hostnames, SRV URIs or externally supplied database locations allowed.
        assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/roadwheels_rental_integrity(?:\?|$)/);
        assert.equal(new URL(uri).hostname, '127.0.0.1');
        assert.equal(mongoose.connection.readyState, 0);
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, monitorCommands: true });
        await Promise.all([User.init(), Car.init(), Booking.init(), Review.init()]);
        mongoose.connection.getClient().on('commandStarted', (event) => commands.push(event));
        for (const id of [USER_ID, OTHER_USER_ID, ADMIN_ID]) {
            tokens[id] = jwt.sign({ id, ver: 0 }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
        }
        const app = express();
        app.use(express.json());
        app.use('/bookings', require('../routes/bookingRoutes'));
        app.use('/reviews', require('../routes/reviewRoutes'));
        app.use(errorHandler);
        server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        try {
            if (server) await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
        } finally {
            try {
                await mongoose.disconnect();
            } finally {
                if (replSet) await replSet.stop();
                if (previousSecret === undefined) delete process.env.JWT_SECRET;
                else process.env.JWT_SECRET = previousSecret;
            }
        }
    });

    beforeEach(async () => {
        today = getBusinessToday();
        await Promise.all([Booking.deleteMany({}), Review.deleteMany({}), Car.deleteMany({}), User.deleteMany({})]);
        await User.create([
            { _id: USER_ID, name: 'Rental Customer', email: 'rental@example.test', password: 'test-only-hash', tokenVersion: 0 },
            { _id: OTHER_USER_ID, name: 'Other Customer', email: 'other@example.test', password: 'test-only-hash', tokenVersion: 0 },
            { _id: ADMIN_ID, name: 'Rental Admin', email: 'admin@example.test', password: 'test-only-hash', role: 'admin', tokenVersion: 0 },
        ]);
        await Car.create({
            _id: CAR_ID, name: 'Integrity Test Car', brand: 'Road', description: 'Local test fixture',
            pricePerDay: 350, category: 'SUV', transmission: 'Automatic', fuelType: 'Petrol',
            seats: 5, color: 'Blue', year: 2025, location: 'Cape Town', isAvailable: true,
        });
        commands.length = 0;
    });

    async function request(method, path, body, userId = USER_ID) {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${tokens[userId]}` } : {}) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: AbortSignal.timeout(25000),
        });
        return { status: response.status, body: await response.json() };
    }

    function reserve(start = 1, end = 4, userId = USER_ID) {
        return request('POST', '/bookings', {
            carId: CAR_ID, pickupDate: dateString(start), returnDate: dateString(end),
            totalPrice: 1, status: 'active', user: ADMIN_ID,
        }, userId);
    }

    function rental(overrides = {}) {
        return Booking.create({
            user: USER_ID, car: CAR_ID, pickupDate: day(-3), returnDate: day(-1),
            status: 'completed', totalPrice: 700, ...overrides,
        });
    }

    const postReview = (bookingId, rating = 5, userId = USER_ID, comment = '  Good rental  ') =>
        request('POST', '/reviews', { bookingId: String(bookingId), rating, comment }, userId);

    const carState = () => Car.findById(CAR_ID).select('+reservationVersion').lean();

    // Make both HTTP handlers observe the same old state, then let their real
    // MongoDB compare-and-set updates race. No sleeps or fake database writes.
    function synchronizeBookingReads(t) {
        const original = Booking.findById;
        let count = 0;
        let release;
        let timer;
        const gate = new Promise((resolve, reject) => {
            release = resolve;
            timer = setTimeout(() => reject(new Error('Both competing booking reads must arrive')), 10000);
        });
        gate.catch(() => {});
        t.after(() => clearTimeout(timer));
        t.mock.method(Booking, 'findById', function (...args) {
            const query = original.apply(this, args);
            const lean = query.lean.bind(query);
            query.lean = async (...leanArgs) => {
                const value = await lean(...leanArgs);
                count += 1;
                if (count === 2) { clearTimeout(timer); release(); }
                if (count <= 2) await gate;
                return value;
            };
            return query;
        });
    }

    function assertTransactionProtocol(collection) {
        const starts = commands.filter(({ command }) => command.startTransaction === true);
        assert.ok(starts.length > 0);
        for (const { command } of starts) {
            assert.equal(command.findAndModify, 'cars');
            assert.deepEqual(command.update.$inc, { reservationVersion: 1 });
            assert.deepEqual(command.readConcern, { level: 'snapshot' });
            assert.equal(command.autocommit, false);
        }
        const inserts = commands.filter(({ command }) => command.insert === collection);
        assert.ok(inserts.length > 0);
        for (const { command } of inserts) {
            assert.equal(command.autocommit, false);
            assert.ok(command.lsid && command.txnNumber);
        }
        const commits = commands.filter(({ commandName }) => commandName === 'commitTransaction');
        assert.ok(commits.length > 0);
        for (const { command } of commits) assert.equal(command.writeConcern.w, 'majority');
    }

    test('query indexes are initialized, including one review per booking', async () => {
        const reviews = await Review.collection.indexes();
        assert.ok(reviews.some((index) => index.key.booking === 1 && index.unique));
        assert.ok(reviews.some((index) => index.key.car === 1 && index.key.createdAt === -1));
        const bookings = await Booking.collection.indexes();
        assert.ok(bookings.some((index) => index.key.car === 1 && index.key.status === 1 && index.key.pickupDate === 1));
        assert.ok(bookings.some((index) => index.key.user === 1));
    });

    test('simultaneous overlapping bookings create exactly one reservation', async () => {
        const responses = await Promise.all([reserve(1, 4), reserve(2, 5, OTHER_USER_ID)]);
        assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
        assert.equal(responses.find((res) => res.status === 409).body.code, 'BOOKING_CONFLICT');
        const stored = await Booking.find().lean();
        assert.equal(stored.length, 1);
        assert.equal(stored[0].status, 'pending');
        assert.equal(stored[0].totalPrice, 1050);
        assert.notEqual(String(stored[0].user), ADMIN_ID);
        assert.equal((await carState()).reservationVersion, 1);
        assertTransactionProtocol('bookings');
    });

    test('adjacent half-open reservations both succeed concurrently', async () => {
        const responses = await Promise.all([reserve(1, 3), reserve(3, 5, OTHER_USER_ID)]);
        assert.deepEqual(responses.map((res) => res.status), [201, 201]);
        assert.equal(await Booking.countDocuments(), 2);
        assert.equal((await carState()).reservationVersion, 2);
        assert.ok(responses.every((res) => res.body.totalPrice === 700));
    });

    test('unavailable and missing cars cannot acquire reservations', async () => {
        await Car.updateOne({ _id: CAR_ID }, { $set: { isAvailable: false } });
        assert.equal((await reserve()).status, 400);
        assert.equal((await carState()).reservationVersion, 0);
        await Car.deleteOne({ _id: CAR_ID });
        assert.equal((await reserve()).status, 404);
        assert.equal(await Booking.countDocuments(), 0);
    });

    test('racing admin status changes cannot overwrite each other', async (t) => {
        const booking = await rental({ status: 'pending', pickupDate: day(1), returnDate: day(4) });
        synchronizeBookingReads(t);
        const responses = await Promise.all([
            request('PUT', `/bookings/${booking.id}/status`, { status: 'confirmed' }, ADMIN_ID),
            request('PUT', `/bookings/${booking.id}/status`, { status: 'cancelled' }, ADMIN_ID),
        ]);
        assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409]);
        const winner = responses.find((res) => res.status === 200);
        assert.equal((await Booking.findById(booking.id).lean()).status, winner.body.status);
    });

    test('status versus owner cancellation uses the expected old status atomically', async (t) => {
        const booking = await rental({ status: 'pending', pickupDate: day(1), returnDate: day(4) });
        synchronizeBookingReads(t);
        const responses = await Promise.all([
            request('PUT', `/bookings/${booking.id}/status`, { status: 'confirmed' }, ADMIN_ID),
            request('PUT', `/bookings/${booking.id}/cancel`),
        ]);
        assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409]);
        assert.equal(responses.find((res) => res.status === 409).body.code, 'BOOKING_CHANGED');
        const winner = responses.find((res) => res.status === 200).body.status;
        assert.equal((await Booking.findById(booking.id).lean()).status, winner);
        if (winner === 'confirmed') assert.equal((await request('PUT', `/bookings/${booking.id}/cancel`)).status, 200);
        assert.equal((await request('PUT', `/bookings/${booking.id}/status`, { status: 'confirmed' }, ADMIN_ID)).status, 400);
        assert.equal((await Booking.findById(booking.id).lean()).status, 'cancelled');
    });

    test('two simultaneous owner cancellations have only one successful write', async (t) => {
        const booking = await rental({ status: 'confirmed', pickupDate: day(1), returnDate: day(4) });
        synchronizeBookingReads(t);
        const responses = await Promise.all([
            request('PUT', `/bookings/${booking.id}/cancel`),
            request('PUT', `/bookings/${booking.id}/cancel`),
        ]);
        assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409]);
        assert.equal((await Booking.findById(booking.id).lean()).status, 'cancelled');
    });

    test('GET projections and ended status actions never write lifecycle state', async () => {
        const stored = await Booking.create(['pending', 'confirmed', 'active', 'completed', 'cancelled'].map((status) => ({
            user: USER_ID, car: CAR_ID, status, pickupDate: day(-2), returnDate: day(0), totalPrice: 700,
        })));
        const before = await Booking.collection.find().sort({ _id: 1 }).toArray();
        commands.length = 0;
        for (const [path, userId] of [['/bookings/mybookings', USER_ID], ['/bookings', ADMIN_ID]]) {
            const res = await request('GET', path, undefined, userId);
            assert.equal(res.status, 200);
            const statuses = Object.fromEntries(res.body.map((item) => [item._id, item.status]));
            assert.deepEqual(stored.map((item) => statuses[item.id]), ['cancelled', 'completed', 'completed', 'completed', 'cancelled']);
        }
        for (const item of stored) {
            assert.equal((await request('PUT', `/bookings/${item.id}/status`, { status: 'confirmed' }, ADMIN_ID)).status, 400);
        }
        assert.equal(commands.some(({ commandName }) => ['update', 'findAndModify', 'insert', 'delete'].includes(commandName)), false);
        assert.deepEqual(await Booking.collection.find().sort({ _id: 1 }).toArray(), before);
    });

    test('concurrent duplicate reviews return REVIEW_EXISTS without double counting', async () => {
        const booking = await rental();
        const responses = await Promise.all([postReview(booking.id), postReview(booking.id)]);
        assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
        assert.equal(responses.find((res) => res.status === 409).body.code, 'REVIEW_EXISTS');
        assert.equal(await Review.countDocuments(), 1);
        assert.equal((await carState()).rating, 5);
        assert.equal((await carState()).reservationVersion, 1);
        assertTransactionProtocol('reviews');
    });

    test('concurrent independent reviews aggregate every committed rating', async () => {
        const ratings = [1, 2, 5, 5, 4, 2];
        const bookings = await Promise.all(ratings.map(() => rental()));
        const responses = await Promise.all(bookings.map((booking, index) => postReview(booking.id, ratings[index])));
        assert.deepEqual(responses.map((res) => res.status), ratings.map(() => 201));
        assert.equal(await Review.countDocuments(), ratings.length);
        assert.equal((await carState()).rating, Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length * 10) / 10);
        assert.equal((await carState()).reservationVersion, ratings.length);
        const aggregates = commands.filter(({ command }) => command.aggregate === 'reviews');
        assert.ok(aggregates.length >= ratings.length);
        assert.ok(aggregates.every(({ command }) => command.autocommit === false && command.lsid && command.txnNumber));
    });

    test('reviews honor effective completion, ownership and minimal public/private DTOs', async () => {
        const booking = await rental({ status: 'confirmed', returnDate: day(0) });
        assert.equal((await postReview(booking.id, 5, OTHER_USER_ID)).status, 403);
        assert.equal((await postReview(booking.id, 5, USER_ID, `  ${'x'.repeat(500)}  `)).status, 201);
        assert.equal((await Booking.findById(booking.id).lean()).status, 'confirmed');
        const pending = await rental({ status: 'pending', returnDate: day(0) });
        assert.equal((await postReview(pending.id)).status, 400);
        const publicResponse = await request('GET', `/reviews/car/${CAR_ID}`, undefined, null);
        assert.equal(publicResponse.status, 200);
        assert.equal(publicResponse.body.length, 1);
        const [review] = publicResponse.body;
        assert.deepEqual(Object.keys(review).sort(), ['_id', 'comment', 'createdAt', 'rating', 'user']);
        assert.deepEqual(review.user, { name: 'Rental Customer' });
        assert.equal(review.comment.length, 500);
        const mine = await request('GET', '/reviews/mine');
        assert.deepEqual(Object.keys(mine.body[0]).sort(), ['_id', 'booking', 'rating']);
        assert.equal(mine.body[0].booking, booking.id);
        assert.deepEqual((await request('GET', '/reviews/mine', undefined, OTHER_USER_ID)).body, []);
        await Car.deleteOne({ _id: CAR_ID });
        const missingCarRental = await rental();
        assert.equal((await postReview(missingCarRental.id)).status, 404);
        assert.equal(await Review.countDocuments(), 1);
    });

    test('an injected failure after booking insertion rolls back booking and car version', async (t) => {
        const original = Booking.create;
        const mock = t.mock.method(Booking, 'create', async function (...args) {
            await original.apply(this, args);
            throw new Error('injected booking failure: private database detail');
        });
        const res = await reserve();
        mock.mock.restore();
        assert.equal(res.status, 500);
        assert.doesNotMatch(JSON.stringify(res.body), /injected|private|database/);
        assert.equal(await Booking.countDocuments(), 0);
        assert.equal((await carState()).reservationVersion, 0);
        assert.equal((await reserve()).status, 201);
    });

    test('failure after rating update rolls back review, aggregate and car version together', async (t) => {
        const first = await rental();
        assert.equal((await postReview(first.id, 2)).status, 201);
        const second = await rental();
        const before = await carState();
        const original = Car.findOneAndUpdate;
        const mock = t.mock.method(Car, 'findOneAndUpdate', function (filter, update, options) {
            const query = original.call(this, filter, update, options);
            if (!update.$set || update.$set.rating === undefined) return query;
            return query.exec().then(() => { throw new Error('injected aggregate failure: private database detail'); });
        });
        const res = await postReview(second.id, 5);
        mock.mock.restore();
        assert.equal(res.status, 500);
        assert.doesNotMatch(JSON.stringify(res.body), /injected|private|database/);
        assert.equal(await Review.countDocuments(), 1);
        assert.equal(await Review.countDocuments({ booking: second.id }), 0);
        assert.deepEqual(await carState(), before);
        assert.equal((await postReview(second.id, 5)).status, 201);
        assert.equal((await carState()).rating, 3.5);
    });
});
