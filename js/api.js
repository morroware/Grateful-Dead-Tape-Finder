/**
 * api.js - API abstraction layer
 * Calls backend first, falls back to direct Archive.org if backend is unavailable
 */

const API_BASE = '/api';
let backendAvailable = null; // null = unknown, true/false after first check

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const error = new Error(data.error || `HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

        backendAvailable = true;
        return await response.json();
    } catch (error) {
        if (error.status) throw error; // Re-throw API errors (4xx)
        // Network error — backend unavailable
        backendAvailable = false;
        console.warn('Backend unavailable:', error.message);
        return null;
    }
}

// ── Search ──

export async function searchShows(queryString, page = 1, rows = 10) {
    const result = await apiCall(`/search?q=${encodeURIComponent(queryString)}&page=${page}&rows=${rows}`);
    if (result) {
        return {
            docs: result.results,
            numFound: result.total,
            cached: result.cached
        };
    }
    // Fallback to direct Archive.org
    return await directArchiveSearch(queryString, page, rows);
}

async function directArchiveSearch(queryString, page, rows) {
    const url = `https://archive.org/advancedsearch.php?` +
        `q=${encodeURIComponent(queryString)}` +
        `&fl[]=identifier,title,year,venue,coverage,downloads,source,creator,date,avg_rating` +
        `&sort[]=downloads+desc&output=json` +
        `&rows=${rows}&page=${page}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    return {
        docs: data.response?.docs || [],
        numFound: data.response?.numFound || 0,
        cached: false
    };
}

// ── Show metadata ──

export async function getShowMetadata(identifier) {
    const result = await apiCall(`/shows/${encodeURIComponent(identifier)}`);
    if (result) {
        // Backend returns tracks as {filename, title, format, size, duration}
        // Map to Archive.org raw format {name, title, format, size, length} for player compatibility
        const files = (result.tracks || []).map(t => ({
            name: t.filename,
            title: t.title,
            format: t.format,
            size: t.size,
            length: t.duration
        }));
        return {
            metadata: result.metadata,
            files: files,
            cached: result.cached
        };
    }
    // Fallback to direct Archive.org
    return await directArchiveMetadata(identifier);
}

async function directArchiveMetadata(identifier) {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { metadata: data.metadata, files: data.files, cached: false };
}

// ── Auth ──

export async function checkAuth() {
    const result = await apiCall('/auth/me');
    return result ? result.user : null;
}

export async function login(email, password) {
    return await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

export async function register(username, email, password) {
    return await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
    });
}

export async function logout() {
    return await apiCall('/auth/logout', { method: 'POST' });
}

export async function updateProfile(data) {
    return await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

// ── Favorites ──

export async function getFavorites() {
    const result = await apiCall('/favorites');
    return result ? result.favorites : [];
}

export async function checkFavorite(identifier) {
    const result = await apiCall(`/favorites/check/${encodeURIComponent(identifier)}`);
    return result ? result.favorited : false;
}

export async function addFavorite(identifier, title, creator, date, notes) {
    return await apiCall('/favorites', {
        method: 'POST',
        body: JSON.stringify({ identifier, title, creator, date, notes })
    });
}

export async function updateFavoriteNotes(identifier, notes) {
    return await apiCall(`/favorites/${encodeURIComponent(identifier)}`, {
        method: 'PUT',
        body: JSON.stringify({ notes })
    });
}

export async function removeFavorite(identifier) {
    return await apiCall(`/favorites/${encodeURIComponent(identifier)}`, {
        method: 'DELETE'
    });
}

// ── Collections ──

export async function getCollections() {
    const result = await apiCall('/collections');
    return result ? result.collections : [];
}

export async function createCollection(name, description, isPublic) {
    return await apiCall('/collections', {
        method: 'POST',
        body: JSON.stringify({ name, description, is_public: isPublic })
    });
}

export async function getCollection(slug) {
    return await apiCall(`/collections/${encodeURIComponent(slug)}`);
}

export async function updateCollection(slug, data) {
    return await apiCall(`/collections/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

export async function deleteCollection(slug) {
    return await apiCall(`/collections/${encodeURIComponent(slug)}`, {
        method: 'DELETE'
    });
}

export async function addToCollection(slug, identifier, title, creator) {
    return await apiCall(`/collections/${encodeURIComponent(slug)}/items`, {
        method: 'POST',
        body: JSON.stringify({ identifier, title, creator })
    });
}

export async function removeFromCollection(slug, identifier) {
    return await apiCall(`/collections/${encodeURIComponent(slug)}/items/${encodeURIComponent(identifier)}`, {
        method: 'DELETE'
    });
}

// ── Admin ──

export async function getAdminStats() {
    return await apiCall('/admin/stats');
}

export async function getAdminUsers(page) {
    return await apiCall(`/admin/users?page=${page}`);
}

export async function adminUpdateUser(userId, data) {
    return await apiCall(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

export async function adminDeleteUser(userId) {
    return await apiCall(`/admin/users/${userId}`, {
        method: 'DELETE'
    });
}

export async function adminCreateUser(data) {
    return await apiCall('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function adminClearCache() {
    return await apiCall('/admin/cache/clear', { method: 'POST' });
}

export async function adminPurgeCache() {
    return await apiCall('/admin/cache/purge', { method: 'POST' });
}

export function isBackendAvailable() {
    return backendAvailable;
}
