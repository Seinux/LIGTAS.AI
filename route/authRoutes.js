
const express = require('express');
const router = express.Router();

const authController = require('../controller/authController');
const authMiddleware = require('../middleware/authMiddleware');

const {
    loginLimiter,
    registerLimiter,
    verifyOTPLimiter,
    resendOTPLimiter
} = require('../middleware/rateLimiter');

const {
    registerValidation,
    validateRequest
} = require('../middleware/validator/authValidator');

// Registration
router.post(
    '/register',
    registerLimiter,
    registerValidation,
    validateRequest,
    authController.register
);

// OTP verification
router.post(
    '/verify-otp',
    verifyOTPLimiter,
    authController.verifyOTP
);

// Resend OTP
router.post(
    '/resend-otp',
    resendOTPLimiter,
    authController.resendOTP
);

// Login
router.post(
    '/login',
    loginLimiter,
    authController.login
);

// Authenticated user routes
router.get('/me', authMiddleware, authController.getCurrentUser);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
