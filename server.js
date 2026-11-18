const express = require('express');
const session = require('express-session')
const path = require('path');
const dotenv = require('dotenv');
const app = express();
dotenv.config();

const PORT = process.env.PORT || 3000;

const authMiddleware = require('./middleware/authMiddleware');



const pool = require('./config/database');

const PgSession = require('connect-pg-simple')(session);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration

app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60
    }
}));

console.log(process.env.PORT)

// Serve CSS files
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));

// Serve JavaScript files
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

const authRoutes = require('./route/authRoutes');
app.use('/auth', authRoutes);

// Frontend pages
// Login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// OTP verification page
app.get('/verify-otp', (req, res) => {
    if (!req.session.pendingVerificationUserId) {
        return res.redirect('/register');
    }

    res.sendFile(path.join(__dirname, 'public', 'verify-otp.html'));
});

// Protected dashboard
app.get('/dashboard', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

async function startServer() {
    try {
        const result = await pool.query('SELECT NOW()');

        console.log('PostgreSQL connected!');
        console.log('Database time:', result.rows[0].now);

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
}

startServer();