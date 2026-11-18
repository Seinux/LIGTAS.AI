
const pool = require('../config/database');

// Create the initial OTP for a new verification session.
const createOrUpdateOTP = async (userId, otpHash, queryable = pool) => {
    const query = `
        INSERT INTO phone_verifications (
            user_id,
            otp_hash,
            expires_at,
            attempts,
            resend_count,
            last_sent_at
        )
        VALUES (
            $1,
            $2,
            NOW() + INTERVAL '5 minutes',
            0,
            0,
            NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
            otp_hash = EXCLUDED.otp_hash,
            expires_at = EXCLUDED.expires_at,
            attempts = 0,
            resend_count = 0,
            last_sent_at = NOW()
        RETURNING id, user_id, expires_at
    `;

    const result = await queryable.query(query, [userId, otpHash]);
    return result.rows[0];
};

// Find a pending OTP.
const findOTPByUserId = async (userId) => {
    const query = `
        SELECT *
        FROM phone_verifications
        WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
};

// Atomically increment incorrect attempts.
const incrementAttempts = async (userId) => {
    const query = `
        UPDATE phone_verifications
        SET attempts = attempts + 1
        WHERE user_id = $1
          AND attempts < 5
          AND expires_at > NOW()
        RETURNING attempts
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
};

// Atomically consume a valid OTP.
// Only one simultaneous request can successfully delete it.
const consumeOTP = async (userId, otpHash) => {
    const query = `
        DELETE FROM phone_verifications
        WHERE user_id = $1
          AND otp_hash = $2
          AND attempts < 5
          AND expires_at > NOW()
        RETURNING user_id
    `;

    const result = await pool.query(query, [userId, otpHash]);
    return result.rows[0] || null;
};

// Atomically resend an OTP if cooldown and resend limit allow it.
const resendOTP = async (userId, otpHash) => {
    const query = `
        UPDATE phone_verifications
        SET
            otp_hash = $2,
            expires_at = NOW() + INTERVAL '5 minutes',
            attempts = 0,
            resend_count = resend_count + 1,
            last_sent_at = NOW()
        WHERE user_id = $1
          AND last_sent_at <= NOW() - INTERVAL '60 seconds'
          AND resend_count < 5
        RETURNING id, user_id, expires_at, resend_count
    `;

    const result = await pool.query(query, [userId, otpHash]);
    return result.rows[0] || null;
};

// Delete a pending OTP.
const deleteOTP = async (userId) => {
    await pool.query(
        'DELETE FROM phone_verifications WHERE user_id = $1',
        [userId]
    );
};

module.exports = {
    createOrUpdateOTP,
    findOTPByUserId,
    incrementAttempts,
    consumeOTP,
    resendOTP,
    deleteOTP
};
