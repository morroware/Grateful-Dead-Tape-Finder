const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// All favorites routes require authentication
router.use(requireAuth);

// GET /api/favorites
router.get('/', async (req, res) => {
    try {
        const favorites = await query(
            'SELECT id, identifier, title, creator, date, notes, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
            [req.session.userId]
        );
        res.json({ favorites });
    } catch (error) {
        console.error('Favorites fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// GET /api/favorites/check/:identifier
router.get('/check/:identifier', async (req, res) => {
    try {
        const fav = await queryOne(
            'SELECT id FROM favorites WHERE user_id = ? AND identifier = ?',
            [req.session.userId, req.params.identifier]
        );
        res.json({ favorited: !!fav, id: fav ? fav.id : null });
    } catch (error) {
        res.json({ favorited: false, id: null });
    }
});

// POST /api/favorites
router.post('/', [
    body('identifier').trim().notEmpty().withMessage('Show identifier is required'),
    body('title').optional().trim(),
    body('creator').optional().trim(),
    body('date').optional().trim(),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { identifier, title, creator, date, notes } = req.body;

        // Check if already favorited
        const existing = await queryOne(
            'SELECT id FROM favorites WHERE user_id = ? AND identifier = ?',
            [req.session.userId, identifier]
        );
        if (existing) {
            return res.status(409).json({ error: 'Already in favorites' });
        }

        const result = await query(
            'INSERT INTO favorites (user_id, identifier, title, creator, date, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [req.session.userId, identifier, title || null, creator || null, date || null, notes || null]
        );

        res.status(201).json({
            favorite: {
                id: result.insertId,
                identifier,
                title,
                creator,
                date,
                notes
            }
        });
    } catch (error) {
        console.error('Favorite add error:', error.message);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// PUT /api/favorites/:identifier
router.put('/:identifier', [
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const { identifier } = req.params;
        const { notes } = req.body;

        await query(
            'UPDATE favorites SET notes = ? WHERE user_id = ? AND identifier = ?',
            [notes || null, req.session.userId, identifier]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Favorite update error:', error.message);
        res.status(500).json({ error: 'Failed to update favorite' });
    }
});

// DELETE /api/favorites/:identifier
router.delete('/:identifier', async (req, res) => {
    try {
        await query(
            'DELETE FROM favorites WHERE user_id = ? AND identifier = ?',
            [req.session.userId, req.params.identifier]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Favorite delete error:', error.message);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

module.exports = router;
