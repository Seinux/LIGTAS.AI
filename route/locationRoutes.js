
const express = require('express');
const router = express.Router();

const locationController = require('../controller/locationController');
const authMiddleware = require('../middleware/authMiddleware');

// Get user's default location
router.get(
    '/',
    authMiddleware,
    locationController.getLocation
);

// Create or update user's default location
router.put(
    '/',
    authMiddleware,
    locationController.saveLocation
);

// Delete user's default location
router.delete(
    '/',
    authMiddleware,
    locationController.deleteLocation
);

module.exports = router;
