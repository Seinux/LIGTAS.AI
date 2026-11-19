
const pool = require('../config/database');

// Get a user's default location
const findByUserId = async (userId) => {
    const query = `
        SELECT
            id,
            user_id,
            barangay,
            city,
            province,
            region,
            country_code,
            latitude,
            longitude,
            location_source,
            updated_at
        FROM user_location_preferences
        WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);

    return result.rows[0] || null;
};

// Create or update a user's default location
const save = async (userId, location) => {
    const {
        barangay,
        city,
        province,
        region,
        latitude,
        longitude,
        locationSource
    } = location;

    const query = `
        INSERT INTO user_location_preferences (
            user_id,
            barangay,
            city,
            province,
            region,
            latitude,
            longitude,
            location_source,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())

        ON CONFLICT (user_id)
        DO UPDATE SET
            barangay = EXCLUDED.barangay,
            city = EXCLUDED.city,
            province = EXCLUDED.province,
            region = EXCLUDED.region,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            location_source = EXCLUDED.location_source,
            updated_at = NOW()

        RETURNING *
    `;

    const values = [
        userId,
        barangay || null,
        city || null,
        province || null,
        region || null,
        latitude,
        longitude,
        locationSource
    ];

    const result = await pool.query(query, values);

    return result.rows[0];
};

// Delete a user's default location
const deleteByUserId = async (userId) => {
    const query = `
        DELETE FROM user_location_preferences
        WHERE user_id = $1
        RETURNING id
    `;

    const result = await pool.query(query, [userId]);

    return result.rowCount > 0;
};

module.exports = {
    findByUserId,
    save,
    deleteByUserId
};
