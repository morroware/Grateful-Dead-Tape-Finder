const express = require('express');
const router = express.Router();
const { getCachedSearch, setCachedSearch } = require('../services/cacheService');
const { searchArchive } = require('../services/archiveProxy');

// GET /api/search
router.get('/', async (req, res) => {
    try {
        const q = req.query.q || '';
        const page = parseInt(req.query.page || '1', 10);
        const rows = Math.min(parseInt(req.query.rows || '10', 10), 50);

        if (!q) {
            return res.json({ results: [], total: 0, page, cached: false });
        }

        // Check cache
        const cached = await getCachedSearch(q, page);
        if (cached) {
            return res.json({
                results: cached.results,
                total: cached.total,
                page,
                cached: true
            });
        }

        // Fetch from Archive.org
        const data = await searchArchive(q, page, rows);

        // Cache the results (don't await — fire and forget)
        setCachedSearch(q, page, data.results, data.total).catch(err => {
            console.error('Cache write error:', err.message);
        });

        res.json({
            results: data.results,
            total: data.total,
            page,
            cached: false
        });
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(502).json({ error: 'Failed to fetch search results' });
    }
});

module.exports = router;
