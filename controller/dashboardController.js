
const userLocationModel = require('../model/UserLocation');

const getDashboardLocation = async (req, res) => {
    try {
        const userId = req.session.userId;

        const location = await userLocationModel.findByUserId(userId);

        if (!location) {
            return res.status(200).json({
                hasLocation: false,
                message: 'Please set your default location.'
            });
        }

        return res.status(200).json({
            hasLocation: true,
            location: {
                id: location.id,
                barangay: location.barangay,
                city: location.city,
                province: location.province,
                region: location.region,
                countryCode: location.country_code,
                latitude: Number(location.latitude),
                longitude: Number(location.longitude),
                locationSource: location.location_source
            }
        });

    } catch (error) {
        console.error('Dashboard location error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve dashboard location.'
        });
    }
};

module.exports = {
    getDashboardLocation
};
