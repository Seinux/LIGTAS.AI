
const pool = require('../config/database');

class CommunityReport {

    // ==========================================
    // CREATE COMMUNITY REPORT
    // ==========================================

    static async create(report) {
        const query = `
            INSERT INTO community_reports (
                user_id,
                location_id,
                report_type,
                title,
                description,
                severity,
                latitude,
                longitude,
                address,
                status,
                observed_at
            )
            VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, 'pending',
                COALESCE($10, NOW())
            )
            RETURNING
                id,
                user_id,
                location_id,
                report_type,
                title,
                description,
                severity,
                latitude,
                longitude,
                address,
                status,
                observed_at,
                created_at
        `;

        const values = [
            report.user_id,
            report.location_id || null,
            report.report_type,
            report.title,
            report.description,
            report.severity,
            report.latitude,
            report.longitude,
            report.address,
            report.observed_at || null
        ];

        const result = await pool.query(query, values);

        return result.rows[0];
    }


    // ==========================================
    // FIND NEARBY VERIFIED REPORTS
    // ==========================================

    
    static async findNearby(latitude, longitude, radiusKm = 5) {
        const query = `
            SELECT *
            FROM (
                SELECT
                    id,
                    user_id,
                    location_id,
                    report_type,
                    title,
                    description,
                    severity,
                    latitude,
                    longitude,
                    address,
                    status,
                    observed_at,
                    created_at,
                    (
                        6371 * ACOS(
                            LEAST(1, GREATEST(-1,
                                COS(RADIANS($1))
                                * COS(RADIANS(latitude))
                                * COS(RADIANS(longitude) - RADIANS($2))
                                + SIN(RADIANS($1))
                                * SIN(RADIANS(latitude))
                            ))
                        )
                    ) AS distance_km
                FROM community_reports
                WHERE status = 'verified'
                AND created_at >= NOW() - INTERVAL '24 hours'
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
            ) AS nearby_reports
            WHERE distance_km <= $3
            ORDER BY distance_km ASC;
        `;

        const result = await pool.query(query, [
            latitude,
            longitude,
            radiusKm
        ]);

        return result.rows;
    }



    // ==========================================
    // FIND REPORT BY ID
    // ==========================================

    static async findById(id) {
        const query = `
            SELECT *
            FROM community_reports
            WHERE id = $1
            LIMIT 1
        `;

        const result = await pool.query(query, [id]);

        return result.rows[0] || null;
    }

}

module.exports = CommunityReport;
