
const CommunityReport = require('../model/CommunityReport');
const pool = require('../config/database');

// ==========================================
// CREATE INCIDENT REPORT
// ==========================================

const createReport = async (req, res) => {
    try {
        const userId = req.session.userId;

        const {
            report_type,
            title,
            description,
            severity,
            latitude,
            longitude,
            address,
            observed_at
        } = req.body;

        // --------------------------------------
        // VALIDATE REQUIRED FIELDS
        // --------------------------------------

        const allowedTypes = [
            'flooding',
            'road_blocked',
            'landslide',
            'strong_wind',
            'heavy_rain',
            'fallen_tree',
            'other'
        ];

        const allowedSeverities = [
            'low',
            'moderate',
            'high',
            'critical'
        ];

        if (
            !report_type ||
            !title ||
            !description ||
            !severity ||
            latitude === undefined ||
            longitude === undefined
        ) {
            return res.status(400).json({
                error: 'All required report fields must be provided.'
            });
        }

        // --------------------------------------
        // VALIDATE INCIDENT TYPE
        // --------------------------------------

        if (!allowedTypes.includes(report_type)) {
            return res.status(400).json({
                error: 'Invalid incident type.'
            });
        }

        // --------------------------------------
        // VALIDATE SEVERITY
        // --------------------------------------

        if (!allowedSeverities.includes(severity)) {
            return res.status(400).json({
                error: 'Invalid incident severity.'
            });
        }

        // --------------------------------------
        // VALIDATE TITLE AND DESCRIPTION
        // --------------------------------------

        if (
            typeof title !== 'string' ||
            title.trim().length < 3 ||
            title.trim().length > 150
        ) {
            return res.status(400).json({
                error: 'Title must contain 3 to 150 characters.'
            });
        }

        if (
            typeof description !== 'string' ||
            description.trim().length < 5 ||
            description.trim().length > 2000
        ) {
            return res.status(400).json({
                error: 'Description must contain 5 to 2000 characters.'
            });
        }

        // --------------------------------------
        // VALIDATE COORDINATES
        // --------------------------------------

        const lat = Number(latitude);
        const lon = Number(longitude);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return res.status(400).json({
                error: 'Invalid incident coordinates.'
            });
        }

        // --------------------------------------
        // GET USER LOCATION ID
        // --------------------------------------

        const locationResult = await pool.query(
            `SELECT id
             FROM user_location_preferences
             WHERE user_id = $1
             LIMIT 1`,
            [userId]
        );

        const locationId = null;

        // --------------------------------------
        // CREATE REPORT
        // --------------------------------------

        const report = await CommunityReport.create({
            user_id: userId,
            location_id: locationId,
            report_type,
            title: title.trim(),
            description: description.trim(),
            severity,
            latitude: lat,
            longitude: lon,
            address: typeof address === 'string'
                ? address.trim().slice(0, 500)
                : null,
            observed_at: observed_at || null
        });

        return res.status(201).json({
            message: 'Incident report submitted successfully.',
            report
        });

    } catch (error) {
        console.error('Create report error:', error);

        return res.status(500).json({
            error: 'Unable to submit incident report.'
        });
    }
};


const getNearbyReports = async (req, res) => {
    try {
        const latitude = Number(req.query.lat);
        const longitude = Number(req.query.lon);
        const radiusKm = req.query.radius === undefined
            ? 5
            : Number(req.query.radius);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                message: 'Valid latitude and longitude are required.'
            });
        }

        if (
            !Number.isFinite(radiusKm) ||
            radiusKm <= 0 ||
            radiusKm > 50
        ) {
            return res.status(400).json({
                message: 'Radius must be greater than 0 and no more than 50 km.'
            });
        }

        const reports = await CommunityReport.findNearby(
            latitude,
            longitude,
            radiusKm
        );

        return res.status(200).json({
            reports
        });

    } catch (error) {
        console.error('Get nearby reports error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve nearby reports.'
        });
    }
};


module.exports = {
    createReport,
    getNearbyReports
};
