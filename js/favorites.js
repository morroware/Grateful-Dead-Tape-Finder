/**
 * favorites.js - Favorites and collections UI
 */

import { checkFavorite, addFavorite, removeFavorite, getFavorites, getCollections, addToCollection, createCollection } from './api.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './utils.js';

// ── Favorite heart button for player page ──

export async function initFavoriteButton(identifier, title, creator, date) {
    const container = document.getElementById('favorite-btn-container');
    if (!container) return;

    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = `
            <a href="login.html?return=${encodeURIComponent(window.location.href)}"
               class="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
               title="Sign in to save favorites">
                <svg class="w-6 h-6 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
            </a>`;
        return;
    }

    let isFav = false;
    try {
        isFav = await checkFavorite(identifier);
    } catch (e) {
        // ignore
    }

    renderHeartButton(container, isFav, identifier, title, creator, date);
}

function renderHeartButton(container, isFav, identifier, title, creator, date) {
    container.innerHTML = `
        <button id="fav-toggle" class="transition-colors" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
            <svg class="w-6 h-6 ${isFav ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
        </button>`;

    document.getElementById('fav-toggle').addEventListener('click', async () => {
        try {
            if (isFav) {
                await removeFavorite(identifier);
                isFav = false;
                showToast('Removed from favorites', 'info');
            } else {
                await addFavorite(identifier, title, creator, date);
                isFav = true;
                showToast('Added to favorites', 'success');
            }
            renderHeartButton(container, isFav, identifier, title, creator, date);
        } catch (error) {
            showToast(error.message || 'Failed to update favorite', 'error');
        }
    });
}

// ── Add to collection dropdown for player page ──

export async function initCollectionDropdown(identifier, title, creator) {
    const container = document.getElementById('collection-btn-container');
    if (!container) return;

    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="relative">
            <button id="add-to-collection-btn" class="text-zinc-500 hover:text-zinc-300 transition-colors" title="Add to collection">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
            </button>
            <div id="collection-dropdown" class="hidden absolute right-0 top-full mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div id="collection-list" class="max-h-48 overflow-y-auto"></div>
                <div class="border-t border-zinc-700 p-2">
                    <button id="new-collection-btn" class="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-zinc-700 rounded transition-colors">
                        + New Collection
                    </button>
                </div>
                <div id="new-collection-form" class="hidden border-t border-zinc-700 p-3">
                    <input type="text" id="new-collection-name" placeholder="Collection name" class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm text-white mb-2">
                    <button id="create-collection-btn" class="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors">Create & Add</button>
                </div>
            </div>
        </div>`;

    const btn = document.getElementById('add-to-collection-btn');
    const dropdown = document.getElementById('collection-dropdown');
    const newBtn = document.getElementById('new-collection-btn');
    const newForm = document.getElementById('new-collection-form');
    const createBtn = document.getElementById('create-collection-btn');

    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            await loadCollectionList(identifier, title, creator);
        }
    });

    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    newBtn.addEventListener('click', () => {
        newForm.classList.toggle('hidden');
        if (!newForm.classList.contains('hidden')) {
            document.getElementById('new-collection-name').focus();
        }
    });

    createBtn.addEventListener('click', async () => {
        const name = document.getElementById('new-collection-name').value.trim();
        if (!name) return;

        try {
            const result = await createCollection(name, '', true);
            if (result && result.collection) {
                await addToCollection(result.collection.slug, identifier, title, creator);
                showToast(`Added to "${name}"`, 'success');
                dropdown.classList.add('hidden');
                newForm.classList.add('hidden');
            }
        } catch (error) {
            showToast(error.message || 'Failed to create collection', 'error');
        }
    });
}

async function loadCollectionList(identifier, title, creator) {
    const listEl = document.getElementById('collection-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="px-3 py-2 text-sm text-zinc-500">Loading...</div>';

    try {
        const collections = await getCollections();
        if (!collections || collections.length === 0) {
            listEl.innerHTML = '<div class="px-3 py-2 text-sm text-zinc-500">No collections yet</div>';
            return;
        }

        listEl.innerHTML = collections.map(c => `
            <button class="collection-add-btn w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center justify-between"
                    data-slug="${c.slug}">
                <span class="truncate">${escapeHtml(c.name)}</span>
                <span class="text-xs text-zinc-500 flex-shrink-0 ml-2">${c.item_count || 0}</span>
            </button>
        `).join('');

        listEl.querySelectorAll('.collection-add-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await addToCollection(btn.dataset.slug, identifier, title, creator);
                    showToast('Added to collection', 'success');
                    document.getElementById('collection-dropdown').classList.add('hidden');
                } catch (error) {
                    showToast(error.message || 'Failed to add', 'error');
                }
            });
        });
    } catch (error) {
        listEl.innerHTML = '<div class="px-3 py-2 text-sm text-red-400">Failed to load</div>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ── Favorites list for profile page ──

export async function renderFavoritesList(container) {
    if (!container) return;

    container.innerHTML = '<div class="text-center py-8 text-zinc-500">Loading favorites...</div>';

    try {
        const favorites = await getFavorites();

        if (!favorites || favorites.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <svg class="w-12 h-12 mx-auto text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    <p class="text-zinc-400">No favorites yet</p>
                    <p class="text-sm text-zinc-500 mt-1">Click the heart icon on any show to save it here</p>
                </div>`;
            return;
        }

        container.innerHTML = favorites.map(f => `
            <div class="show-card rounded-lg p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-500 transition-colors"
                 style="background:#18181b;border:1px solid #27272a;">
                <div class="flex-1 min-w-0" onclick="window.location.href='player.html?id=${f.identifier}'">
                    <div class="text-xs text-zinc-500">${escapeHtml(f.creator || 'Unknown Artist')}</div>
                    <div class="text-sm font-medium text-white truncate">${escapeHtml(f.title || f.identifier)}</div>
                    <div class="text-xs text-zinc-500 mt-1">${f.date || ''}</div>
                    ${f.notes ? `<div class="text-xs text-zinc-400 mt-1 italic truncate">${escapeHtml(f.notes)}</div>` : ''}
                </div>
                <button class="fav-remove text-red-500 hover:text-red-400 flex-shrink-0" data-id="${f.identifier}" title="Remove">
                    <svg class="w-5 h-5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                </button>
            </div>
        `).join('');

        container.querySelectorAll('.fav-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await removeFavorite(btn.dataset.id);
                    showToast('Removed from favorites', 'info');
                    renderFavoritesList(container);
                } catch (error) {
                    showToast('Failed to remove', 'error');
                }
            });
        });
    } catch (error) {
        container.innerHTML = '<div class="text-center py-8 text-red-400">Failed to load favorites</div>';
    }
}
