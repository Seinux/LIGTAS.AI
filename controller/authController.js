const pool = require('../config/database')
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const phoneVerificationModel = require('../model/PhoneVerification');
const userModel = require('../model/User');

const register = async (req, res) => {
    try {
        const {
            username,
            email,
            phoneNumber,
            password
        } = req.body;

        // Validate required fields
        if (!username || !email || !phoneNumber || !password) {
            return res.status(400).json({
                message: 'All fields are required.'
            });
        }

        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters.'
            });
        }

        // Check existing email
        const existingEmail = await userModel.findByEmail(email);

        if (existingEmail) {
            return res.status(409).json({
                message: 'Email is already registered.'
            });
        }

        // Check existing phone number
        const existingPhone = await userModel.findByPhone(phoneNumber);

        if (existingPhone) {
            return res.status(409).json({
                message: 'Phone number is already registered.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await userModel.createUser(
            username,
            email,
            phoneNumber,
            hashedPassword
        );

        // Generate a 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Hash the OTP
        const otpHash = await bcrypt.hash(otp, 10);

        // Save OTP in database
        await phoneVerificationModel.createOrUpdateOTP(
            user.id,
            otpHash
        );

        req.session.pendingVerificationUserId = user.id;

        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Development only: display OTP in terminal
        console.log(`OTP for ${phoneNumber}: ${otp}`);

        return res.status(201).json({
            message: 'Account created successfully.',
            user
        });

    } catch (error) {
        console.error('Registration error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};



const verifyOTP = async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        const { otp } = req.body;
        const userId = req.session.pendingVerificationUserId;

        // Check pending verification session
        if (!userId) {
            return res.status(401).json({
                message: 'No pending phone verification session found.'
            });
        }

        // Validate OTP
        if (!otp) {
            return res.status(400).json({
                message: 'OTP is required.'
            });
        }

        if (!/^\d{6}$/.test(String(otp))) {
            return res.status(400).json({
                message: 'OTP must contain exactly 6 digits.'
            });
        }

        // Start database transaction
        await client.query('BEGIN');
        transactionStarted = true;

        // Retrieve OTP record and lock it
        const result = await client.query(
            `SELECT *
             FROM phone_verifications
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );

        const verification = result.rows[0];

        if (!verification) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(400).json({
                message: 'No pending OTP found.'
            });
        }

        // Check expiration
        if (new Date(verification.expires_at) <= new Date()) {
            await client.query(
                'DELETE FROM phone_verifications WHERE user_id = $1',
                [userId]
            );

            await client.query('COMMIT');
            transactionStarted = false;

            return res.status(400).json({
                message: 'OTP has expired. Request a new one.'
            });
        }

        // Check maximum attempts
        if (verification.attempts >= 5) {
            await client.query(
                'DELETE FROM phone_verifications WHERE user_id = $1',
                [userId]
            );

            await client.query('COMMIT');
            transactionStarted = false;

            return res.status(429).json({
                message: 'Too many attempts. Request a new OTP.'
            });
        }

        // Compare submitted OTP with stored hash
        const isValid = await bcrypt.compare(
            String(otp),
            verification.otp_hash
        );

        if (!isValid) {
            await client.query(
                `UPDATE phone_verifications
                 SET attempts = attempts + 1
                 WHERE user_id = $1`,
                [userId]
            );

            await client.query('COMMIT');
            transactionStarted = false;

            return res.status(400).json({
                message: 'Incorrect OTP.'
            });
        }

        // Mark user's phone number as verified
        const userResult = await client.query(
            `UPDATE users
             SET phone_verified = TRUE,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, username, email, phone_number, phone_verified`,
            [userId]
        );

        if (userResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(404).json({
                message: 'User not found.'
            });
        }

        // Delete used OTP
        await client.query(
            'DELETE FROM phone_verifications WHERE user_id = $1',
            [userId]
        );

        // Commit database changes
        await client.query('COMMIT');
        transactionStarted = false;

        // Clear pending verification session
        delete req.session.pendingVerificationUserId;

        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        return res.status(200).json({
            message: 'Phone number verified successfully.',
            user: userResult.rows[0]
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error('OTP verification error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });

    } finally {
        client.release();
    }
};




const resendOTP = async (req, res) => {
    try {
        // Get user ID from the server-side session
        const userId = req.session.pendingVerificationUserId;

        if (!userId) {
            return res.status(401).json({
                message: 'No pending phone verification session found.'
            });
        }

        // Find user
        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        if (user.phone_verified) {
            return res.status(400).json({
                message: 'Phone number is already verified.'
            });
        }

        // Find existing OTP
        const existingOTP =
            await phoneVerificationModel.findOTPByUserId(userId);

        if (!existingOTP) {
            return res.status(400).json({
                message: 'No pending verification found.'
            });
        }

        // Check resend limit
        if (existingOTP.resend_count >= 5) {
            return res.status(429).json({
                message: 'Maximum OTP resend limit reached.'
            });
        }

        // Check 60-second cooldown
        const secondsSinceLastSent =
            (Date.now() - new Date(existingOTP.last_sent_at).getTime()) / 1000;

        if (secondsSinceLastSent < 60) {
            return res.status(429).json({
                message: `Please wait ${Math.ceil(60 - secondsSinceLastSent)} seconds before requesting another OTP.`
            });
        }

        // Check expiration
        if (new Date(existingOTP.expires_at) <= new Date()) {
            return res.status(400).json({
                message: 'OTP has expired. Please restart verification.'
            });
        }

        // Generate new OTP
        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = await bcrypt.hash(otp, 10);

        // Update OTP in database
        const updatedOTP = await phoneVerificationModel.resendOTP(
            userId,
            otpHash
        );

        if (!updatedOTP) {
            return res.status(429).json({
                message: 'OTP could not be resent. Please wait or restart verification.'
            });
        }

        // Development only: display OTP in terminal
        console.log(`New OTP for ${user.phone_number}: ${otp}`);

        return res.status(200).json({
            message: 'A new OTP has been generated.'
        });

    } catch (error) {
        console.error('Resend OTP error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};




const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required.'
            });
        }

        // Find user
        const user = await userModel.findByEmail(
            email.trim().toLowerCase()
        );

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // Check phone verification
        if (!user.phone_verified) {
            return res.status(403).json({
                message: 'Please verify your phone number before logging in.'
            });
        }

        // Successful login
        // Regenerate session to prevent session fixation
        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regeneration error:', err);

                return res.status(500).json({
                    message: 'Could not create session.'
                });
            }

            req.session.userId = user.id;

            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);

                    return res.status(500).json({
                        message: 'Could not save session.'
                    });
                }

                return res.status(200).json({
                    message: 'Login successful.',
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        phone_number: user.phone_number
                    }
                });
            });
});

    } catch (error) {
        console.error('Login error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};


const getCurrentUser = async (req, res) => {
    try {
        const user = await userModel.findById(req.session.userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            message: 'Authenticated user.',
            user
        });

    } catch (error) {
        console.error('Get current user error:', error);

        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
};


const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);

            return res.status(500).json({
                message: 'Could not log out.'
            });
        }

        res.clearCookie('connect.sid');

        return res.status(200).json({
            message: 'Logout successful.'
        });
    });
};




module.exports = {
    register,
    verifyOTP,
    resendOTP,
    login,
    getCurrentUser,
    logout
};
