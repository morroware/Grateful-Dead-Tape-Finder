const express = require('express');
const router = express.Router();
const { getCachedShow, setCachedShow } = require('../services/cacheService');
const { getShowMetadata } = require('../services/archiveProxy');

// GET /api/shows/:identifier
router.get('/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;

        if (!identifier || !/^[a-zA-Z0-9._-]+$/.test(identifier)) {
            return res.status(400).json({ error: 'Invalid identifier' });
        }

        // Check cache
        const cached = await getCachedShow(identifier);
        if (cached) {
            return res.json({
                metadata: cached.metadata,
                files: cached.files,
                cached: true
            });
        }

        // Fetch from Archive.org
        const data = await getShowMetadata(identifier);

        // Cache the results (fire and forget)
        setCachedShow(identifier, data).catch(err => {
            console.error('Show cache write error:', err.message);
        });

        // Return raw Archive.org format for frontend compatibility
        res.json({
            metadata: data.metadata,
            files: data.files,
            cached: false
        });
    } catch (error) {
        console.error('Show fetch error:', error.message);
        res.status(502).json({ error: 'Failed to fetch show metadata' });
    }
});

module.exports = router;
