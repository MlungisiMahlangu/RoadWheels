class HttpError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function errorHandler(err, _req, res, next) {
    if (res.headersSent) return next(err);

    let status = 500;
    let message = 'Something went wrong. Please try again.';
    let code;
    if (err instanceof HttpError) {
        status = err.status;
        message = err.message;
        code = err.code;
    } else if (err.type === 'entity.parse.failed') {
        status = 400;
        message = 'Please send valid JSON.';
    } else if (err.type === 'entity.too.large') {
        status = 413;
        message = 'This request is too large.';
    } else if (err.name === 'CastError' || err.name === 'ValidationError') {
        status = 400;
        message = 'Please check the values you entered.';
    } else if (err.code === 11000) {
        status = 409;
        message = 'This record already exists.';
    }

    if (status >= 500) console.error('Request failed:', err.name || 'Error', code || 'INTERNAL_ERROR');
    res.status(status).json({ message, ...(code && { code }) });
}

module.exports = { HttpError, errorHandler };
