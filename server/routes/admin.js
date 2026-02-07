const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { getCacheStats, cleanExpiredCache } = require('../services/cacheService');

// All admin routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/stats - dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const cacheStats = await getCacheStats();
        const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
        const favCount = await queryOne('SELECT COUNT(*) as count FROM favorites');
        const collectionCount = await queryOne('SELECT COUNT(*) as count FROM collections');

        // Recent registrations
        const recentUsers = await query(
            'SELECT id, username, email, display_name, is_admin, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 10'
        );

        // Top favorited shows
        const topFavorited = await query(
            `SELECT identifier, title, creator, COUNT(*) as fav_count
             FROM favorites
             GROUP BY identifier
             ORDER BY fav_count DESC
             LIMIT 10`
        );

        res.json({
            cache: cacheStats,
            users: {
                total: userCount.count,
                recent: recentUsers
            },
            favorites: {
                total: favCount.count,
                topShows: topFavorited
            },
            collections: {
                total: collectionCount.count
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// POST /api/admin/cache/clear - clear expired cache entries
router.post('/cache/clear', async (req, res) => {
    try {
        const result = await cleanExpiredCache();
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Cache clear error:', error.message);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// POST /api/admin/cache/purge - purge all cache
router.post('/cache/purge', async (req, res) => {
    try {
        await query('DELETE FROM show_tracks');
        await query('DELETE FROM shows');
        await query('DELETE FROM search_cache');
        res.json({ success: true, message: 'All cache purged' });
    } catch (error) {
        console.error('Cache purge error:', error.message);
        res.status(500).json({ error: 'Failed to purge cache' });
    }
});

// GET /api/admin/users - list all users
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page || '1', 10);
        const limit = 25;
        const offset = (page - 1) * limit;

        const users = await query(
            `SELECT id, username, email, display_name, is_admin, created_at, last_login_at,
                    (SELECT COUNT(*) FROM favorites WHERE user_id = users.id) as fav_count,
                    (SELECT COUNT(*) FROM collections WHERE user_id = users.id) as collection_count
             FROM users
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const total = await queryOne('SELECT COUNT(*) as count FROM users');

        res.json({
            users,
            total: total.count,
            page,
            totalPages: Math.ceil(total.count / limit)
        });
    } catch (error) {
        console.error('Admin users error:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// PUT /api/admin/users/:id - update user (toggle admin, etc.)
router.put('/users/:id', [
    body('is_admin').optional().isBoolean(),
    body('display_name').optional().trim()
], async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { is_admin, display_name } = req.body;

        // Prevent self-demotion
        if (userId === req.session.userId && is_admin === false) {
            return res.status(400).json({ error: 'Cannot remove your own admin access' });
        }

        if (is_admin !== undefined) {
            await query('UPDATE users SET is_admin = ? WHERE id = ?', [is_admin, userId]);
        }
        if (display_name !== undefined) {
            await query('UPDATE users SET display_name = ? WHERE id = ?', [display_name, userId]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Admin user update error:', error.message);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/admin/users/:id - delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        // Prevent self-deletion
        if (userId === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Admin user delete error:', error.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// POST /api/admin/users - create user (admin)
router.post('/users', [
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('is_admin').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { username, email, password, is_admin } = req.body;
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await query(
            'INSERT INTO users (username, email, password_hash, display_name, is_admin) VALUES (?, ?, ?, ?, ?)',
            [username, email, passwordHash, username, is_admin || false]
        );

        res.status(201).json({
            user: { id: result.insertId, username, email, is_admin: is_admin || false }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        console.error('Admin create user error:', error.message);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

module.exports = router;
