
const express = require('express');
const router = express.Router();

const geocodingController = require('../controller/geocodingController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/search', authMiddleware, geocodingController.searchLocations);
router.get('/reverse', authMiddleware, geocodingController.reverseGeocode);

module.exports = router;
