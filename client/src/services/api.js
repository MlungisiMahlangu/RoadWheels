const API_URL = import.meta.env?.VITE_API_URL || '/api';
const REQUEST_TIMEOUT = 15_000;
export const AUTH_EVENT = 'roadwheels:auth';
let observedToken;
let generation = 0;

export const captureSession = () => {
    const token = localStorage.getItem('token');
    if (token !== observedToken) {
        observedToken = token;
        generation += 1;
    }
    return { token, generation };
};

export const isSessionCurrent = (snapshot) => {
    const current = captureSession();
    return snapshot?.token === current.token && snapshot?.generation === current.generation;
};

export const notifyAuthChange = () => {
    captureSession();
    window.dispatchEvent(new Event(AUTH_EVENT));
};

const requestError = (message, status = 0, code = 'REQUEST_FAILED') =>
    Object.assign(new Error(message), { status, code });
const staleSessionError = () => requestError('Your account session changed. Please try again.', 0, 'STALE_SESSION');

export const isStrongPassword = (password) =>
    password.length >= 8 && new TextEncoder().encode(password).length <= 72
    && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
export const PASSWORD_REQUIREMENTS = 'At least 8 characters, including an uppercase letter, a number, and a special character. Maximum 72 UTF-8 bytes (some characters use more than one byte).';

export const request = async (endpoint, options = {}) => {
    const snapshot = captureSession();
    const credentials = endpoint === '/auth/login' || endpoint === '/auth/signup';
    const { timeoutMs = REQUEST_TIMEOUT, signal, headers: extraHeaders, ...fetchOptions } = options;
    const controller = new AbortController();
    const headers = {
        'Content-Type': 'application/json',
        ...(!credentials && snapshot.token && { Authorization: `Bearer ${snapshot.token}` }),
        ...extraHeaders,
    };
    let timedOut = false;
    let responseStatus = 0;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, Math.min(REQUEST_TIMEOUT, Math.max(1, timeoutMs)));
    let onAbort;
    const aborted = new Promise((_, reject) => {
        onAbort = () => reject(requestError(
            timedOut ? 'RoadWheels took too long to respond. Please try again.' : 'The request was cancelled.',
            responseStatus, timedOut ? 'TIMEOUT' : 'ABORTED',
        ));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        if (controller.signal.aborted) onAbort();
    });

    try {
        const { res, text } = await Promise.race([
            (async () => {
                const res = await fetch(`${API_URL}${endpoint}`, { ...fetchOptions, headers, signal: controller.signal });
                responseStatus = res.status;
                return { res, text: await res.text() };
            })(),
            aborted,
        ]);
        // Check before handling either errors or successful data, including credential requests.
        if (!isSessionCurrent(snapshot)) throw staleSessionError();
        let data;
        try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        const code = typeof data?.code === 'string' ? data.code : `HTTP_${res.status}`;
        if (!credentials && snapshot.token && (res.status === 401 || (res.status === 403 && code === 'ACCOUNT_SUSPENDED'))) {
            if (isSessionCurrent(snapshot)) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                notifyAuthChange();
            }
            throw requestError(code === 'ACCOUNT_SUSPENDED'
                ? 'Your account is suspended. Please contact RoadWheels for help.'
                : 'Your session expired. Please log in again.', res.status, code);
        }
        if (!res.ok) {
            const fallback = res.status >= 500
                ? 'RoadWheels is temporarily unavailable. Please try again shortly.'
                : res.status === 429 ? 'Too many requests. Please wait a moment and try again.'
                    : 'We couldn’t complete your request. Please try again.';
            throw requestError(typeof data?.message === 'string' && data.message.trim() ? data.message : fallback, res.status, code);
        }
        if (res.status === 204) return null;
        if (data === null || typeof data !== 'object') {
            throw requestError('RoadWheels returned an unexpected response. Please try again.', res.status, 'INVALID_RESPONSE');
        }
        return data;
    } catch (error) {
        // Our own invalidation deliberately changes the token; retain its useful HTTP error.
        if (!isSessionCurrent(snapshot) && !(error.status === 401 || error.code === 'ACCOUNT_SUSPENDED')) throw staleSessionError();
        if (error.code) throw error;
        throw requestError('We couldn’t reach RoadWheels. Please check your connection and try again.', responseStatus, 'NETWORK_ERROR');
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        controller.signal.removeEventListener('abort', onAbort);
    }
};

export const api = {
    // Auth
    signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    getMe: (options) => request('/auth/me', options),
    updateProfile: (body) => request('/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
    changePassword: (body) => request('/auth/me/password', { method: 'PUT', body: JSON.stringify(body) }),

    // Cars
    getCars: (query = '') => request(`/cars${query ? `?${query}` : ''}`),
    getCarsAdmin: () => request('/cars?all=true'),
    getCar: (id) => request(`/cars/${id}`),
    createCar: (body) => request('/cars', { method: 'POST', body: JSON.stringify(body) }),
    updateCar: (id, body) => request(`/cars/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteCar: (id) => request(`/cars/${id}`, { method: 'DELETE' }),

    // Bookings
    createBooking: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
    getMyBookings: () => request('/bookings/mybookings'),
    getAllBookings: () => request('/bookings'),
    updateBookingStatus: (id, status) => request(`/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    cancelBooking: (id) => request(`/bookings/${id}/cancel`, { method: 'PUT' }),

    // Availability
    getCarAvailability: (id) => request(`/cars/${id}/availability`),

    // Reviews
    getCarReviews: (carId) => request(`/reviews/car/${carId}`),
    getMyReviews: () => request('/reviews/mine'),
    createReview: (body) => request('/reviews', { method: 'POST', body: JSON.stringify(body) }),

    // Admin — Users
    getUsers: () => request('/auth/users'),
    setUserSuspended: (id, isSuspended) => {
        if (typeof isSuspended !== 'boolean') throw new TypeError('isSuspended must be a boolean');
        return request(`/auth/users/${id}/suspend`, { method: 'PUT', body: JSON.stringify({ isSuspended }) });
    },

    // Contact
    sendContactMessage: (body) => request('/contact', { method: 'POST', body: JSON.stringify(body) }),
    getContactMessages: () => request('/contact'),
    markMessageRead: (id) => request(`/contact/${id}/read`, { method: 'PUT' }),
};
