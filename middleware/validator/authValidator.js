
const { body, validationResult } = require('express-validator');

// Registration validation rules
const registerValidation = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required.')
        .bail()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters.')
        .bail()
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores.'),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required.')
        .bail()
        .isEmail()
        .withMessage('Please enter a valid email address.')
        .normalizeEmail(),

    body('phoneNumber')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required.')
        .bail()
        .matches(/^(09\d{9}|\+639\d{9})$/)
        .withMessage('Enter a valid Philippine mobile number.'),

    body('password')
        .notEmpty()
        .withMessage('Password is required.')
        .bail()
        .isLength({ min: 8, max: 72 })
        .withMessage('Password must be between 8 and 72 characters.')
];

// Check validation results
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed.',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg
            }))
        });
    }

    next();
};

module.exports = {
    registerValidation,
    validateRequest
};
