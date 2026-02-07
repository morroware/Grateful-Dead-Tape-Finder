const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { query, queryOne } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}

async function uniqueSlug(base) {
    let slug = slugify(base);
    let suffix = 0;
    while (true) {
        const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
        const exists = await queryOne('SELECT id FROM collections WHERE slug = ?', [candidate]);
        if (!exists) return candidate;
        suffix++;
    }
}

// GET /api/collections - list user's collections
router.get('/', requireAuth, async (req, res) => {
    try {
        const collections = await query(
            `SELECT c.*, COUNT(ci.id) as item_count
             FROM collections c
             LEFT JOIN collection_items ci ON ci.collection_id = c.id
             WHERE c.user_id = ?
             GROUP BY c.id
             ORDER BY c.updated_at DESC`,
            [req.session.userId]
        );
        res.json({ collections });
    } catch (error) {
        console.error('Collections fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

// POST /api/collections - create collection
router.post('/', requireAuth, [
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Collection name is required'),
    body('description').optional().trim(),
    body('is_public').optional().isBoolean()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { name, description, is_public } = req.body;
        const slug = await uniqueSlug(name);

        const result = await query(
            'INSERT INTO collections (user_id, name, description, slug, is_public) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId, name, description || null, slug, is_public !== false]
        );

        res.status(201).json({
            collection: {
                id: result.insertId,
                name,
                description,
                slug,
                is_public: is_public !== false
            }
        });
    } catch (error) {
        console.error('Collection create error:', error.message);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

// GET /api/collections/:slug - view collection
router.get('/:slug', async (req, res) => {
    try {
        const collection = await queryOne(
            `SELECT c.*, u.username, u.display_name
             FROM collections c
             JOIN users u ON u.id = c.user_id
             WHERE c.slug = ?`,
            [req.params.slug]
        );

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Check access
        const isOwner = req.session && req.session.userId === collection.user_id;
        if (!collection.is_public && !isOwner) {
            return res.status(403).json({ error: 'This collection is private' });
        }

        const items = await query(
            'SELECT identifier, title, creator, position, added_at FROM collection_items WHERE collection_id = ? ORDER BY position, added_at',
            [collection.id]
        );

        res.json({
            collection: {
                id: collection.id,
                name: collection.name,
                description: collection.description,
                slug: collection.slug,
                is_public: !!collection.is_public,
                owner: {
                    username: collection.username,
                    display_name: collection.display_name
                },
                created_at: collection.created_at,
                updated_at: collection.updated_at,
                is_owner: isOwner
            },
            items
        });
    } catch (error) {
        console.error('Collection view error:', error.message);
        res.status(500).json({ error: 'Failed to fetch collection' });
    }
});

// PUT /api/collections/:slug - update collection
router.put('/:slug', requireAuth, [
    body('name').optional().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim(),
    body('is_public').optional().isBoolean()
], async (req, res) => {
    try {
        const collection = await queryOne(
            'SELECT * FROM collections WHERE slug = ? AND user_id = ?',
            [req.params.slug, req.session.userId]
        );
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const { name, description, is_public } = req.body;

        if (name !== undefined) {
            await query('UPDATE collections SET name = ? WHERE id = ?', [name, collection.id]);
        }
        if (description !== undefined) {
            await query('UPDATE collections SET description = ? WHERE id = ?', [description, collection.id]);
        }
        if (is_public !== undefined) {
            await query('UPDATE collections SET is_public = ? WHERE id = ?', [is_public, collection.id]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Collection update error:', error.message);
        res.status(500).json({ error: 'Failed to update collection' });
    }
});

// DELETE /api/collections/:slug
router.delete('/:slug', requireAuth, async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM collections WHERE slug = ? AND user_id = ?',
            [req.params.slug, req.session.userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Collection delete error:', error.message);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

// POST /api/collections/:slug/items - add item
router.post('/:slug/items', requireAuth, [
    body('identifier').trim().notEmpty(),
    body('title').optional().trim(),
    body('creator').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const collection = await queryOne(
            'SELECT id FROM collections WHERE slug = ? AND user_id = ?',
            [req.params.slug, req.session.userId]
        );
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        const { identifier, title, creator } = req.body;

        // Get next position
        const maxPos = await queryOne(
            'SELECT MAX(position) as max_pos FROM collection_items WHERE collection_id = ?',
            [collection.id]
        );
        const position = (maxPos && maxPos.max_pos !== null) ? maxPos.max_pos + 1 : 0;

        const result = await query(
            'INSERT INTO collection_items (collection_id, identifier, title, creator, position) VALUES (?, ?, ?, ?, ?)',
            [collection.id, identifier, title || null, creator || null, position]
        );

        // Update collection timestamp
        await query('UPDATE collections SET updated_at = NOW() WHERE id = ?', [collection.id]);

        res.status(201).json({
            item: {
                id: result.insertId,
                identifier,
                title,
                creator,
                position
            }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Show already in this collection' });
        }
        console.error('Collection item add error:', error.message);
        res.status(500).json({ error: 'Failed to add item' });
    }
});

// DELETE /api/collections/:slug/items/:identifier
router.delete('/:slug/items/:identifier', requireAuth, async (req, res) => {
    try {
        const collection = await queryOne(
            'SELECT id FROM collections WHERE slug = ? AND user_id = ?',
            [req.params.slug, req.session.userId]
        );
        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        await query(
            'DELETE FROM collection_items WHERE collection_id = ? AND identifier = ?',
            [collection.id, req.params.identifier]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Collection item remove error:', error.message);
        res.status(500).json({ error: 'Failed to remove item' });
    }
});

module.exports = router;
