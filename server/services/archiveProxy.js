const fetch = require('node-fetch');

const ARCHIVE_BASE = process.env.ARCHIVE_API_BASE || 'https://archive.org';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'TapeFinder/1.0' },
                timeout: 15000
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`Archive.org fetch attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await sleep(RETRY_DELAY * (i + 1));
        }
    }
}

async function searchArchive(queryString, page, rows) {
    const url = `${ARCHIVE_BASE}/advancedsearch.php?` +
        `q=${encodeURIComponent(queryString)}` +
        `&fl[]=identifier,title,year,venue,coverage,downloads,source,creator,date,avg_rating` +
        `&sort[]=downloads+desc&output=json` +
        `&rows=${rows}&page=${page}`;

    const data = await fetchWithRetry(url);

    if (!data.response || !data.response.docs) {
        return { results: [], total: 0 };
    }

    return {
        results: data.response.docs,
        total: data.response.numFound || 0
    };
}

async function getShowMetadata(identifier) {
    const url = `${ARCHIVE_BASE}/metadata/${encodeURIComponent(identifier)}`;
    const data = await fetchWithRetry(url);

    if (!data || !data.metadata) {
        throw new Error('Invalid response from Archive.org');
    }

    return data;
}

module.exports = { searchArchive, getShowMetadata };
