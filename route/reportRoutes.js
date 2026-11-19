
const express = require('express');
const router = express.Router();

const reportController = require('../controller/reportController');
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// COMMUNITY INCIDENT REPORT ROUTES
// ==========================================

// Submit a new incident report
router.post('/', authMiddleware, reportController.createReport);
router.get('/nearby', authMiddleware, reportController.getNearbyReports);

module.exports = router;
