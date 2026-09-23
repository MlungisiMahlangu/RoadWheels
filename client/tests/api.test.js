import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, request, AUTH_EVENT, captureSession, isSessionCurrent, notifyAuthChange, isStrongPassword } from '../src/services/api.js';

const originals = Object.fromEntries(['localStorage', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let authEvents;
beforeEach(() => {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  authEvents = 0;
  window.addEventListener(AUTH_EVENT, () => { authEvents += 1; });
  captureSession();
});
after(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const signIn = (token = 'token-a') => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify({ _id: token, name: token }));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('uses relative /api and the captured authorization token', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/auth/me');
    assert.equal(options.headers.Authorization, 'Bearer token-a');
    assert.ok(options.signal instanceof AbortSignal);
    return json({ _id: 'a' });
  });
  assert.deepEqual(await api.getMe(), { _id: 'a' });
});

test('credential errors remain on the form without invalidating an existing session', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    return json({ message: 'Incorrect credentials', code: 'INVALID_CREDENTIALS' }, 401);
  });
  await assert.rejects(api.login({ email: 'a@example.test', password: 'wrong' }), { status: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect credentials' });
  assert.equal(localStorage.getItem('token'), 'token-a');
  assert.equal(authEvents, 0);
});

test('malformed successful JSON produces a friendly structured error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Proxy page</html>'));
  await assert.rejects(api.getCars(), (error) => {
    assert.equal(error.status, 200);
    assert.equal(error.code, 'INVALID_RESPONSE');
    assert.doesNotMatch(error.message, /html|Unexpected token/);
    return true;
  });
});

test('non-JSON 503 preserves the session for retry', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Unavailable</html>', { status: 503 }));
  await assert.rejects(api.getMe(), { status: 503, code: 'HTTP_503', message: 'RoadWheels is temporarily unavailable. Please try again shortly.' });
  assert.equal(localStorage.getItem('token'), 'token-a');
  assert.equal(authEvents, 0);
});

test('empty 204 response is accepted', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api.deleteCar('car-a'), null);
});

test('network failure exposes a friendly error without logging out', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(api.getMe(), { status: 0, code: 'NETWORK_ERROR' });
  assert.equal(localStorage.getItem('token'), 'token-a');
});

test('current-token non-JSON 401 clears storage and dispatches a same-tab event', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async () => new Response('Unauthorized', { status: 401 }));
  await assert.rejects(api.getMe(), { status: 401, code: 'HTTP_401' });
  assert.equal(localStorage.getItem('token'), null);
  assert.equal(localStorage.getItem('user'), null);
  assert.equal(authEvents, 1);
});

test('ACCOUNT_SUSPENDED 403 invalidates access', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async () => json({ code: 'ACCOUNT_SUSPENDED' }, 403));
  await assert.rejects(api.getMe(), { status: 403, code: 'ACCOUNT_SUSPENDED' });
  assert.equal(localStorage.getItem('token'), null);
  assert.equal(authEvents, 1);
});

test('ordinary role-based 403 does not invalidate the session', async (t) => {
  signIn();
  t.mock.method(globalThis, 'fetch', async () => json({ message: 'Admin access required', code: 'FORBIDDEN' }, 403));
  await assert.rejects(api.getUsers(), { status: 403, code: 'FORBIDDEN' });
  assert.equal(localStorage.getItem('token'), 'token-a');
  assert.equal(authEvents, 0);
});

for (const status of [200, 401, 403, 503]) {
  test(`late ${status} response from token A cannot affect token B`, async (t) => {
    signIn();
    const response = deferred();
    t.mock.method(globalThis, 'fetch', () => response.promise);
    const pending = api.getMe();
    signIn('token-b');
    response.resolve(json({ _id: 'a', code: status === 403 ? 'ACCOUNT_SUSPENDED' : 'OLD_SESSION' }, status));
    await assert.rejects(pending, { status: 0, code: 'STALE_SESSION' });
    assert.equal(localStorage.getItem('token'), 'token-b');
    assert.equal(JSON.parse(localStorage.getItem('user'))._id, 'token-b');
    assert.equal(authEvents, 0);
  });
}

test('checks identity again after the response body finishes', async (t) => {
  signIn();
  const body = deferred();
  t.mock.method(globalThis, 'fetch', async () => ({ status: 200, ok: true, text: () => body.promise }));
  const pending = api.getMyBookings();
  await Promise.resolve();
  signIn('token-b');
  body.resolve(JSON.stringify([{ user: 'a', private: true }]));
  await assert.rejects(pending, { code: 'STALE_SESSION' });
});

test('late anonymous login response cannot replace a session established elsewhere', async (t) => {
  const response = deferred();
  t.mock.method(globalThis, 'fetch', () => response.promise);
  const pending = api.login({ email: 'a@example.test', password: 'password' });
  signIn('token-b');
  response.resolve(json({ token: 'token-a', user: { _id: 'a' } }));
  await assert.rejects(pending, { code: 'STALE_SESSION' });
  assert.equal(localStorage.getItem('token'), 'token-b');
});

test('logout rejects pending authenticated data', async (t) => {
  signIn();
  const response = deferred();
  t.mock.method(globalThis, 'fetch', () => response.promise);
  const pending = api.getMyBookings();
  localStorage.removeItem('token');
  notifyAuthChange();
  response.resolve(json([{ user: 'a' }]));
  await assert.rejects(pending, { code: 'STALE_SESSION' });
});

test('session snapshots reject an observed switch away and back', () => {
  signIn();
  const snapshot = captureSession();
  signIn('token-b');
  notifyAuthChange();
  signIn();
  notifyAuthChange();
  assert.equal(isSessionCurrent(snapshot), false);
});

test('request timeout aborts the transport and never retries a mutation', async (t) => {
  signIn();
  let signal;
  const fetchMock = t.mock.method(globalThis, 'fetch', (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  });
  await assert.rejects(request('/bookings', { method: 'POST', body: '{}', timeoutMs: 5 }), { status: 0, code: 'TIMEOUT' });
  assert.equal(signal.aborted, true);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(localStorage.getItem('token'), 'token-a');
});

test('timeout also bounds a stalled response body', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ status: 200, ok: true, text: () => new Promise(() => {}) }));
  await assert.rejects(request('/cars', { timeoutMs: 5 }), { status: 200, code: 'TIMEOUT' });
});

test('caller can abort obsolete session validation', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', () => new Promise(() => {}));
  const pending = api.getMe({ signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { code: 'ABORTED' });
});

test('suspension sends an explicit boolean, never a toggle', async (t) => {
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/auth/users/user-a/suspend');
    assert.equal(options.method, 'PUT');
    bodies.push(JSON.parse(options.body));
    return json({ message: 'Updated' });
  });
  await api.setUserSuspended('user-a', true);
  await api.setUserSuspended('user-a', false);
  assert.deepEqual(bodies, [{ isSuspended: true }, { isSuspended: false }]);
  assert.throws(() => api.setUserSuspended('user-a', 'false'), TypeError);
});

test('review conflict preserves status/code for the distinct parent callback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ message: 'Already reviewed', code: 'REVIEW_EXISTS' }, 409));
  await assert.rejects(api.createReview({ bookingId: 'booking-a' }), { status: 409, code: 'REVIEW_EXISTS' });
});

test('password change exposes the replacement token and user', async (t) => {
  signIn();
  const data = { message: 'Password changed', token: 'token-new', user: { _id: 'a' } };
  t.mock.method(globalThis, 'fetch', async () => json(data));
  assert.deepEqual(await api.changePassword({ currentPassword: 'old', newPassword: 'NewPass1!' }), data);
  // Only AuthProvider.login commits the returned session, with its caller's snapshot guard.
  assert.equal(localStorage.getItem('token'), 'token-a');
});

test('passwords enforce the 72 UTF-8 byte limit, including multibyte Unicode', () => {
  assert.equal(isStrongPassword(`Aa1!${'a'.repeat(68)}`), true);
  assert.equal(isStrongPassword(`Aa1!${'a'.repeat(69)}`), false);
  assert.equal(isStrongPassword(`Aa1!${'é'.repeat(34)}`), true);
  assert.equal(isStrongPassword(`Aa1!${'é'.repeat(35)}`), false);
  assert.equal(isStrongPassword(`Aa1!${'\u{1F680}'.repeat(17)}`), true);
  assert.equal(isStrongPassword(`Aa1!${'\u{1F680}'.repeat(18)}`), false);
  assert.equal(isStrongPassword('weakpass'), false);
});
