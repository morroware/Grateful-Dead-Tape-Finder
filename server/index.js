require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const rateLimit = require('express-rate-limit');
const path = require('path');
const { getPool, testConnection } = require('./config/database');
const { cleanExpiredCache } = require('./services/cacheService');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Middleware ──

// CORS
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
app.use(cors({
    origin: frontendOrigin === '*' ? true : frontendOrigin.split(','),
    credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session store
const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 min
    expiration: 2592000000, // 30 days
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
}, getPool());

app.use(session({
    key: 'tapefinder_sid',
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Static files (serve the frontend) ──
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ──
app.use('/api/search', require('./routes/search'));
app.use('/api/shows', require('./routes/shows'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await testConnection();
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'disconnected', message: error.message });
    }
});

// SPA fallback — serve index.html for non-API, non-file routes
app.get('*', (req, res) => {
    // If it looks like a file request, let it 404
    if (req.path.includes('.')) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Error handler ──
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Cache cleanup interval ──
setInterval(async () => {
    try {
        const result = await cleanExpiredCache();
        if (result.searchDeleted > 0 || result.showsDeleted > 0) {
            console.log(`Cache cleanup: ${result.searchDeleted} search entries, ${result.showsDeleted} shows removed`);
        }
    } catch (error) {
        console.error('Cache cleanup error:', error.message);
    }
}, 60 * 60 * 1000); // Every hour

// ── Start server ──
async function start() {
    try {
        await testConnection();
        console.log('Database connected');
    } catch (error) {
        console.error('Database connection failed:', error.message);
        console.error('Make sure MySQL is running and .env is configured correctly.');
        console.error('Run "node install.js" to set up the database.');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Tape Finder server running on port ${PORT}`);
        console.log(`Frontend origin: ${frontendOrigin}`);
        console.log(`API: http://localhost:${PORT}/api/health`);
    });
}

start();
