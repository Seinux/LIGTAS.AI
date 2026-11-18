const pool = require('../config/database')


const findByEmail = async (email) => {
    const query = `
        SELECT
            id,
            username,
            email,
            phone_number,
            phone_verified,
            password
        FROM users
        WHERE LOWER(email) = LOWER($1)
    `;

    const result = await pool.query(query, [email.trim()]);

    return result.rows[0] || null;
};

const findByPhone = async (phoneNumber) => {
    const query = `
        SELECT id
        FROM users
        WHERE phone_number = $1
    `;

    const result = await pool.query(query, [phoneNumber]);

    return result.rows[0] || null;
};

const findById = async (id) => {
    const query = `
        SELECT id, username, email, phone_number, phone_verified, created_at
        FROM users
        WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    return result.rows[0] || null;
};

const createUser = async (username, email, phoneNumber, password) => {
    const query = `
        INSERT INTO users (username, email, phone_number, password)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, phone_number, created_at
    `;

    const result = await pool.query(query, [
        username,
        email,
        phoneNumber,
        password
    ]);

    return result.rows[0];
};

const verifyPhone = async (userId) => {
    const query = `
        UPDATE users
        SET phone_verified = TRUE
        WHERE id = $1
        RETURNING id, username, email, phone_number, phone_verified
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
};

module.exports = {
    findByEmail,
    findByPhone,
    findById,
    createUser,
    verifyPhone
};