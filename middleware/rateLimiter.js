
const rateLimit = require('express-rate-limit');

// Login: maximum 10 attempts every 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many login attempts. Please try again after 15 minutes.'
    }
});

// Registration: maximum 5 attempts every hour
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many registration attempts. Please try again later.'
    }
});

// OTP verification: maximum 10 requests every 10 minutes
const verifyOTPLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many OTP verification requests. Please try again later.'
    }
});

// OTP resend: maximum 5 requests every hour
const resendOTPLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many OTP resend requests. Please try again later.'
    }
});

module.exports = {
    loginLimiter,
    registerLimiter,
    verifyOTPLimiter,
    resendOTPLimiter
};
