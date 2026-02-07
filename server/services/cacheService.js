const crypto = require('crypto');
const { query, queryOne } = require('../config/database');

const SEARCH_TTL = parseInt(process.env.SEARCH_CACHE_TTL || '21600', 10);
const SHOW_TTL = parseInt(process.env.SHOW_CACHE_TTL || '86400', 10);

function hashQuery(queryString) {
    return crypto.createHash('sha256').update(queryString).digest('hex');
}

// ── Search cache ──

async function getCachedSearch(queryText, page) {
    const hash = hashQuery(queryText + ':' + page);
    const row = await queryOne(
        'SELECT results_json, total_results FROM search_cache WHERE query_hash = ? AND page = ? AND expires_at > NOW()',
        [hash, page]
    );
    if (!row) return null;
    return {
        results: typeof row.results_json === 'string' ? JSON.parse(row.results_json) : row.results_json,
        total: row.total_results
    };
}

async function setCachedSearch(queryText, page, results, totalResults) {
    const hash = hashQuery(queryText + ':' + page);
    await query(
        `INSERT INTO search_cache (query_hash, query_text, page, total_results, results_json, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
         ON DUPLICATE KEY UPDATE
           results_json = VALUES(results_json),
           total_results = VALUES(total_results),
           expires_at = VALUES(expires_at),
           created_at = NOW()`,
        [hash, queryText, page, totalResults, JSON.stringify(results), SEARCH_TTL]
    );
}

// ── Show cache ──

async function getCachedShow(identifier) {
    const show = await queryOne(
        'SELECT * FROM shows WHERE identifier = ? AND expires_at > NOW()',
        [identifier]
    );
    if (!show) return null;

    const tracks = await query(
        'SELECT track_number, title, filename, format, size, duration FROM show_tracks WHERE show_id = ? ORDER BY track_number',
        [show.id]
    );

    return {
        metadata: {
            identifier: show.identifier,
            title: show.title,
            creator: show.creator,
            date: show.date,
            year: show.year,
            venue: show.venue,
            coverage: show.coverage,
            source: show.source,
            lineage: show.lineage,
            taper: show.taper,
            description: show.description,
            notes: show.notes,
            setlist: show.setlist,
            downloads: show.downloads,
            avg_rating: show.avg_rating ? parseFloat(show.avg_rating) : null
        },
        files: tracks.map(t => ({
            track: t.track_number,
            title: t.title,
            name: t.filename,
            format: t.format,
            size: t.size,
            length: t.duration
        })),
        rawMetadata: typeof show.raw_metadata === 'string' ? JSON.parse(show.raw_metadata) : show.raw_metadata
    };
}

async function setCachedShow(identifier, archiveData) {
    const m = archiveData.metadata || {};

    // Upsert show
    const result = await query(
        `INSERT INTO shows (identifier, title, creator, date, year, venue, coverage, source, lineage, taper, description, notes, setlist, downloads, avg_rating, raw_metadata, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           creator = VALUES(creator),
           date = VALUES(date),
           year = VALUES(year),
           venue = VALUES(venue),
           coverage = VALUES(coverage),
           source = VALUES(source),
           lineage = VALUES(lineage),
           taper = VALUES(taper),
           description = VALUES(description),
           notes = VALUES(notes),
           setlist = VALUES(setlist),
           downloads = VALUES(downloads),
           avg_rating = VALUES(avg_rating),
           raw_metadata = VALUES(raw_metadata),
           expires_at = VALUES(expires_at),
           updated_at = NOW()`,
        [
            identifier,
            m.title || null,
            typeof m.creator === 'string' ? m.creator : (Array.isArray(m.creator) ? m.creator[0] : null),
            m.date || null,
            m.year ? parseInt(m.year, 10) || null : null,
            m.venue || null,
            m.coverage || null,
            m.source || null,
            m.lineage || null,
            m.taper || null,
            m.description || null,
            m.notes || null,
            m.setlist || null,
            m.downloads ? parseInt(m.downloads, 10) || 0 : 0,
            m.avg_rating ? parseFloat(m.avg_rating) || null : null,
            JSON.stringify(m),
            SHOW_TTL
        ]
    );

    // Get the show id
    const show = await queryOne('SELECT id FROM shows WHERE identifier = ?', [identifier]);
    if (!show) return;

    // Replace tracks
    await query('DELETE FROM show_tracks WHERE show_id = ?', [show.id]);

    if (archiveData.files && Array.isArray(archiveData.files)) {
        const audioFiles = archiveData.files.filter(f =>
            f.format && f.format.toLowerCase().includes('mp3') && f.name && !f.name.includes('64kb')
        );

        // Prefer VBR versions
        const vbrFiles = audioFiles.filter(f => f.name.toLowerCase().includes('_vbr.mp3'));
        const regularFiles = audioFiles.filter(f => !f.name.toLowerCase().includes('_vbr.mp3'));
        const filesToUse = vbrFiles.length > 0 ? vbrFiles : regularFiles;

        for (let i = 0; i < filesToUse.length; i++) {
            const f = filesToUse[i];
            await query(
                'INSERT INTO show_tracks (show_id, track_number, title, filename, format, size, duration) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    show.id,
                    i + 1,
                    f.title || f.name.replace('.mp3', '').replace('_vbr', ''),
                    f.name,
                    f.format || 'MP3',
                    f.size ? parseInt(f.size, 10) || null : null,
                    f.length || null
                ]
            );
        }
    }
}

// ── Cache cleanup ──

async function cleanExpiredCache() {
    const searchResult = await query('DELETE FROM search_cache WHERE expires_at < NOW()');
    const showIds = await query('SELECT id FROM shows WHERE expires_at < NOW()');

    if (showIds.length > 0) {
        // show_tracks cascade-deletes with shows
        await query('DELETE FROM shows WHERE expires_at < NOW()');
    }

    return {
        searchDeleted: searchResult.affectedRows || 0,
        showsDeleted: showIds.length
    };
}

// ── Stats ──

async function getCacheStats() {
    const searchCount = await queryOne('SELECT COUNT(*) as count FROM search_cache WHERE expires_at > NOW()');
    const showCount = await queryOne('SELECT COUNT(*) as count FROM shows WHERE expires_at > NOW()');
    const trackCount = await queryOne('SELECT COUNT(*) as count FROM show_tracks');
    const totalSearchRows = await queryOne('SELECT COUNT(*) as count FROM search_cache');
    const totalShowRows = await queryOne('SELECT COUNT(*) as count FROM shows');

    return {
        activeSearchEntries: searchCount.count,
        activeShowEntries: showCount.count,
        totalTracks: trackCount.count,
        totalSearchRows: totalSearchRows.count,
        totalShowRows: totalShowRows.count
    };
}

module.exports = {
    getCachedSearch,
    setCachedSearch,
    getCachedShow,
    setCachedShow,
    cleanExpiredCache,
    getCacheStats,
    hashQuery
};
