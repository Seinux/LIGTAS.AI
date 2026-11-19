
const searchLocations = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                message: 'Please enter at least 2 characters.'
            });
        }

        const url = new URL(
            'https://geocoding-api.open-meteo.com/v1/search'
        );

        url.searchParams.set('name', q.trim());
        url.searchParams.set('count', '10');
        url.searchParams.set('language', 'en');
        url.searchParams.set('format', 'json');
        url.searchParams.set('countryCode', 'PH');

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Geocoding service unavailable.');
        }

        const data = await response.json();

        const locations = (data.results || []).map(location => ({
            name: location.name,
            barangay: null,
            city: location.admin2 || location.name,
            province: location.admin1 || null,
            region: null,
            country: location.country,
            countryCode: location.country_code,
            latitude: location.latitude,
            longitude: location.longitude,
            timezone: location.timezone
        }));

        return res.status(200).json({
            locations
        });

    } catch (error) {
        console.error('Location search error:', error);

        return res.status(500).json({
            message: 'Unable to search for locations.'
        });
    }
};


const reverseGeocode = async (req, res) => {
    try {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return res.status(400).json({
                message: 'Valid coordinates are required.'
            });
        }

        const url = new URL(
            'https://nominatim.openstreetmap.org/reverse'
        );

        url.searchParams.set('lat', latitude);
        url.searchParams.set('lon', longitude);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('addressdetails', '1');

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'LIGTAS.AI/1.0 (location lookup)'
            }
        });

        if (!response.ok) {
            throw new Error('Reverse geocoding service unavailable.');
        }

        const data = await response.json();
        const address = data.address || {};

        const location = {
            name: data.name || address.suburb || address.city || address.town || address.village || 'Current Location',
            barangay: address.suburb || address.village || address.neighbourhood || null,
            city: address.city || address.town || address.municipality || address.county || null,
            province: address.province || null,
            region: address.state || null,
            country: address.country || 'Philippines',
            countryCode: (address.country_code || 'ph').toUpperCase()
        };

        return res.status(200).json({ location });

    } catch (error) {
        console.error('Reverse geocoding error:', error);

        return res.status(500).json({
            message: 'Unable to identify your current address.'
        });
    }
};


module.exports = {
    searchLocations,
    reverseGeocode
};
