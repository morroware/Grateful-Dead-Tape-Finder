const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const BCRYPT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .trim()
        .isEmail().withMessage('Invalid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { username, email, password } = req.body;

        // Check for existing user
        const existing = await queryOne(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing) {
            return res.status(409).json({ error: 'Username or email already taken' });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const result = await query(
            'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
            [username, email, passwordHash, username]
        );

        const userId = result.insertId;

        // Set session
        req.session.userId = userId;
        req.session.username = username;
        req.session.isAdmin = false;

        res.status(201).json({
            user: {
                id: userId,
                username,
                email,
                display_name: username,
                is_admin: false
            }
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', [
    body('email').trim().notEmpty().withMessage('Email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { email, password } = req.body;

        const user = await queryOne(
            'SELECT id, username, email, password_hash, display_name, is_admin FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = !!user.is_admin;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                is_admin: !!user.is_admin
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('tapefinder_sid');
        res.json({ success: true });
    });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.json({ user: null });
    }

    try {
        const user = await queryOne(
            'SELECT id, username, email, display_name, is_admin, created_at FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (!user) {
            req.session.destroy(() => {});
            return res.json({ user: null });
        }

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                is_admin: !!user.is_admin,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Auth check error:', error.message);
        res.json({ user: null });
    }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, [
    body('display_name').optional().trim().isLength({ max: 100 }),
    body('email').optional().trim().isEmail().normalizeEmail(),
    body('current_password').optional(),
    body('new_password').optional().isLength({ min: 8 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const userId = req.session.userId;
        const { display_name, email, current_password, new_password } = req.body;

        const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Update display name
        if (display_name !== undefined) {
            await query('UPDATE users SET display_name = ? WHERE id = ?', [display_name, userId]);
        }

        // Update email
        if (email && email !== user.email) {
            const emailExists = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (emailExists) {
                return res.status(409).json({ error: 'Email already in use' });
            }
            await query('UPDATE users SET email = ? WHERE id = ?', [email, userId]);
        }

        // Update password
        if (current_password && new_password) {
            const valid = await bcrypt.compare(current_password, user.password_hash);
            if (!valid) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
            const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
            await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
        }

        const updated = await queryOne(
            'SELECT id, username, email, display_name, is_admin FROM users WHERE id = ?',
            [userId]
        );

        res.json({
            user: {
                id: updated.id,
                username: updated.username,
                email: updated.email,
                display_name: updated.display_name,
                is_admin: !!updated.is_admin
            }
        });
    } catch (error) {
        console.error('Profile update error:', error.message);
        res.status(500).json({ error: 'Profile update failed' });
    }
});

module.exports = router;
