
const express = require('express');
const router = express.Router();

const dashboardController = require('../controller/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/location', authMiddleware, dashboardController.getDashboardLocation);

module.exports = router;
