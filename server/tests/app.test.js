const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApp } = require('../src/app');
const { HttpError, errorHandler } = require('../middleware/errors');

async function serve(t, app) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}

test('health is private-cache-safe and sends security headers without exposing Express', async t => {
    const base = await serve(t, createApp({ production: true, origins: 'https://client.example.test' }));
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.match(response.headers.get('strict-transport-security'), /max-age=31536000/);
});

test('CORS grants only explicitly allowed origins', async t => {
    const base = await serve(t, createApp({ production: true, origins: 'https://client.example.test' }));
    for (const [origin, allowed] of [['https://client.example.test', true], ['https://other.example.test', false]]) {
        const response = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
        assert.equal(response.headers.get('access-control-allow-origin'), allowed ? origin : null);
        assert.equal(response.headers.get('access-control-allow-credentials'), null);
    }
});

test('invalid JSON and oversized requests have safe client errors', async t => {
    const base = await serve(t, createApp());
    for (const [body, status] of [['{invalid', 400], [JSON.stringify({ text: 'x'.repeat(33000) }), 413]]) {
        const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        assert.equal(response.status, status);
        const data = await response.json();
        assert.deepEqual(Object.keys(data), ['message']);
        assert.ok(data.message.length < 100);
    }
});

test('API 404 stays JSON rather than serving the application shell', async t => {
    const base = await serve(t, createApp());
    const response = await fetch(`${base}/api/unknown`, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
});

test('repeated invalid login requests are throttled with Retry-After', async t => {
    const base = await serve(t, createApp());
    let response;
    for (let i = 0; i < 21; i++) response = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get('retry-after')) > 0);
    assert.equal((await response.json()).code, 'RATE_LIMITED');
});

test('error handler preserves safe application errors and hides database details', async t => {
    const app = express();
    app.get('/known', (_req, _res, next) => next(new HttpError(409, 'Already reviewed.', 'REVIEW_EXISTS')));
    app.get('/duplicate', (_req, _res, next) => next(Object.assign(new Error('secret field value'), { code: 11000 })));
    app.get('/cast', (_req, _res, next) => next(Object.assign(new Error('private database details'), { name: 'CastError' })));
    app.use(errorHandler);
    const base = await serve(t, app);
    const known = await fetch(`${base}/known`);
    assert.equal(known.status, 409);
    assert.deepEqual(await known.json(), { message: 'Already reviewed.', code: 'REVIEW_EXISTS' });
    for (const [route, status] of [['duplicate', 409], ['cast', 400]]) {
        const response = await fetch(`${base}/${route}`);
        assert.equal(response.status, status);
        assert.doesNotMatch(await response.text(), /secret|private|database/);
    }
});
