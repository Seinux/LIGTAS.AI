
const express = require('express');
const router = express.Router();

const weatherController = require('../controller/weatherController');
const authMiddleware = require('../middleware/authMiddleware');

// Get weather information.
router.get('/', authMiddleware, weatherController.getWeather);

module.exports = router;
