
const userLocationModel = require('../model/UserLocation');

// Get user's default location
const getLocation = async (req, res) => {
    try {
        const userId = req.session.userId;

        const location = await userLocationModel.findByUserId(userId);

        if (!location) {
            return res.status(404).json({
                message: 'No default location has been set.'
            });
        }

        return res.status(200).json({
            message: 'Location retrieved successfully.',
            location
        });

    } catch (error) {
        console.error('Get location error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};


// Create or update user's default location
const saveLocation = async (req, res) => {
    try {
        const userId = req.session.userId;

        const {
            barangay,
            city,
            province,
            region,
            latitude,
            longitude,
            locationSource
        } = req.body;

        // Validate coordinates
        const lat = Number(latitude);
        const lon = Number(longitude);

        if (
            latitude === undefined ||
            longitude === undefined ||
            latitude === null ||
            longitude === null ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return res.status(400).json({
                message: 'Valid latitude and longitude are required.'
            });
        }

        // Validate location source
        const source = locationSource || 'manual';

        if (!['manual', 'gps'].includes(source)) {
            return res.status(400).json({
                message: 'Invalid location source.'
            });
        }

        // Validate text fields
        const textFields = {
            barangay,
            city,
            province,
            region
        };

        for (const [field, value] of Object.entries(textFields)) {
            if (
                value !== undefined &&
                value !== null &&
                (typeof value !== 'string' || value.trim().length > 150)
            ) {
                return res.status(400).json({
                    message: `Invalid ${field} value.`
                });
            }
        }

        // Save location
        const location = await userLocationModel.save(userId, {
            barangay: barangay?.trim(),
            city: city?.trim(),
            province: province?.trim(),
            region: region?.trim(),
            latitude: lat,
            longitude: lon,
            locationSource: source
        });

        return res.status(200).json({
            message: 'Default location saved successfully.',
            location
        });

    } catch (error) {
        console.error('Save location error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};


// Delete user's default location
const deleteLocation = async (req, res) => {
    try {
        const userId = req.session.userId;

        const deleted = await userLocationModel.deleteByUserId(userId);

        if (!deleted) {
            return res.status(404).json({
                message: 'No default location found.'
            });
        }

        return res.status(200).json({
            message: 'Default location removed successfully.'
        });

    } catch (error) {
        console.error('Delete location error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};


module.exports = {
    getLocation,
    saveLocation,
    deleteLocation
};
