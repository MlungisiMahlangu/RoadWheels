const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';



const request = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    let res;
    try {
        res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    } catch {
        throw new Error('We couldn’t reach RoadWheels. Please check your connection and try again.');
    }

    // Login/signup must keep credential errors on the form.
    if (res.status === 401 && token && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/signup')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Session expired — please log in again');
    }

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
};

export const api = {
    // Auth
    signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    getMe: () => request('/auth/me'),
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
    toggleUserSuspend: (id) => request(`/auth/users/${id}/suspend`, { method: 'PUT' }),

    // Contact
    sendContactMessage: (body) => request('/contact', { method: 'POST', body: JSON.stringify(body) }),
    getContactMessages: () => request('/contact'),
    markMessageRead: (id) => request(`/contact/${id}/read`, { method: 'PUT' }),
};
