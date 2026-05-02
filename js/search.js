/**
 * search.js - Modern search with Ocean Blue theme
 */

import { showLoading, hideLoading, showToast, escapeHtml } from './utils.js';
import { getBandConfig } from './bandConfig.js';
import { storage } from './storage.js';
import { searchShows as apiSearch } from './api.js';

// Search state
let currentPage = 1;
const resultsPerPage = 10;
let totalResults = 0;
let currentView = 'list';
let currentResults = [];
let activeFilters = new Set();
let lastSearchParams = null;

export async function searchShows(page = 1) {
    const searchQueryInput = document.getElementById('searchQuery');
    const yearFromInput = document.getElementById('yearFrom');
    const yearToInput = document.getElementById('yearTo');
    const bandSelector = document.getElementById('bandSelector');

    const query = searchQueryInput ? searchQueryInput.value.trim() : '';
    const yearFrom = yearFromInput ? yearFromInput.value : '';
    const yearTo = yearToInput ? yearToInput.value : '';
    const band = bandSelector ? bandSelector.value : 'AllArchive';

    lastSearchParams = { query, yearFrom, yearTo, band, page };

    showLoading();
    currentPage = page;

    try {
        const config = getBandConfig(band);
        let baseQuery = config.query || 'mediatype:(etree)';
        const bandTitle = config.title;

        if (band === 'AllArchive') {
            baseQuery = 'mediatype:(etree)';
            if (query) baseQuery += ` AND (${query})`;
        } else if (band === 'Collection_Search') {
            baseQuery = query ? `collection:(${query}) AND mediatype:(etree)` : 'mediatype:(etree)';
        } else if (band === 'Custom' || config.customSearch) {
            baseQuery = query ? `${query} AND mediatype:(etree)` : 'mediatype:(etree)';
        } else if (baseQuery) {
            if (query) baseQuery += ` AND (${query})`;
        } else {
            baseQuery = 'mediatype:(etree)';
            if (query) baseQuery += ` AND (${query})`;
        }

        if (yearFrom || yearTo) {
            const fromYear = yearFrom || '1900';
            const toYear = yearTo || String(new Date().getFullYear());
            baseQuery += ` AND year:[${fromYear} TO ${toYear}]`;
        } else if (config.yearRange) {
            baseQuery += ` AND year:[${config.yearRange[0]} TO ${config.yearRange[1]}]`;
        }

        activeFilters.forEach(filter => {
            if (filter === 'five-star') {
                baseQuery += ' AND avg_rating:[4.5 TO 5]';
            } else if (filter === 'soundboard') {
                baseQuery += ' AND source:(soundboard OR sbd OR "sbd")';
            } else if (filter === 'aud') {
                baseQuery += ' AND source:(audience OR aud OR "aud")';
            } else if (filter === 'matrix') {
                baseQuery += ' AND source:(matrix OR "matrix")';
            }
        });

        document.title = `${bandTitle} - Live Music Archive`;

        // Use API layer (backend with Archive.org fallback)
        const data = await apiSearch(baseQuery, page, resultsPerPage);

        hideLoading();
        const resultsDiv = document.getElementById('results');

        if (!data.docs || data.docs.length === 0) {
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="text-center py-16 animate-fade-in">
                        <div class="inline-flex items-center justify-center w-20 h-20 bg-gray-800 rounded-full mb-6">
                            <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-300 mb-2">No recordings found</h3>
                        <p class="text-gray-500">Try adjusting your search criteria or filters</p>
                    </div>`;
            }
            updatePagination(0);
            return;
        }

        totalResults = data.numFound;
        currentResults = data.docs;

        if (resultsDiv) {
            updateResultsDisplay();
        }

        updatePagination();

    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        handleSearchError(error);
    }
}

function handleSearchError(error) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    const errorMessage = error.message || 'Unknown error';
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');

    resultsDiv.innerHTML = `
        <div class="text-center py-16 animate-fade-in">
            <div class="inline-flex items-center justify-center w-20 h-20 bg-red-900 bg-opacity-30 rounded-full mb-6">
                <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <h3 class="text-xl font-bold text-red-400 mb-2">
                ${isNetworkError ? 'Connection Problem' : 'Search Error'}
            </h3>
            <p class="text-gray-400 mb-6 max-w-md mx-auto">
                ${isNetworkError
                    ? 'Unable to reach Archive.org. Please check your connection.'
                    : 'An error occurred while searching. This may be temporary.'}
            </p>
            <button
                onclick="window.retryLastSearch()"
                class="px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg">
                Try Again
            </button>
        </div>`;
}

window.retryLastSearch = function() {
    if (lastSearchParams) {
        const { query, yearFrom, yearTo, band, page } = lastSearchParams;

        const searchQueryInput = document.getElementById('searchQuery');
        const yearFromInput = document.getElementById('yearFrom');
        const yearToInput = document.getElementById('yearTo');
        const bandSelector = document.getElementById('bandSelector');

        if (searchQueryInput) searchQueryInput.value = query;
        if (yearFromInput) yearFromInput.value = yearFrom;
        if (yearToInput) yearToInput.value = yearTo;
        if (bandSelector) bandSelector.value = band;

        showToast('Retrying search...', 'info');
        searchShows(page);
    }
};

function updateResultsDisplay() {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    if (currentView === 'grid') {
        resultsDiv.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[400px]';
    } else if (currentView === 'compact') {
        resultsDiv.className = 'space-y-2 min-h-[400px]';
    } else {
        resultsDiv.className = 'space-y-4 min-h-[400px]';
    }

    resultsDiv.innerHTML = currentResults.map((show, index) => {
        const card = currentView === 'grid' ? createGridCard(show) :
                     currentView === 'compact' ? createCompactCard(show) :
                     createEnhancedShowCard(show);
        return `<div class="animate-fade-in" style="animation-delay: ${index * 0.05}s">${card}</div>`;
    }).join('');
}

function createEnhancedShowCard(show) {
    const src = show.source ? show.source.toLowerCase() : '';
    const isSbd = src.includes('soundboard') || src.includes('sbd');
    const isAud = src.includes('audience') || src.includes('aud');
    const isMx = src.includes('matrix');

    let tags = '';
    if (isSbd) tags += `<span class="tag tag-sbd">SBD</span>`;
    if (isAud) tags += `<span class="tag tag-aud">AUD</span>`;
    if (isMx) tags += `<span class="tag tag-matrix">MTX</span>`;

    if (show.avg_rating && show.avg_rating >= 4) {
        tags += `<span class="tag" style="background:#1e3a5f;color:#93c5fd;">★ ${show.avg_rating.toFixed(1)}</span>`;
    }

    const artist = escapeHtml(show.creator || 'Unknown Artist');
    const showTitle = escapeHtml(show.title || show.date || 'Unknown Show');
    const safeId = escapeHtml(show.identifier);

    return `
        <div class="show-card rounded-lg p-4 cursor-pointer transition-all"
             onclick="openPlayerPage('${safeId}')">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <div class="text-xs text-zinc-500 mb-1">${artist}</div>
                    <h3 class="font-medium text-white mb-2 leading-snug">${showTitle}</h3>
                    <div class="flex flex-wrap gap-1.5 mb-2">${tags}</div>
                    <div class="flex items-center gap-4 text-xs text-zinc-500">
                        ${show.venue ? `<span>${escapeHtml(show.venue)}</span>` : ''}
                        ${show.date || show.year ? `<span>${escapeHtml(show.date || String(show.year))}</span>` : ''}
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="text-lg font-semibold text-zinc-300">${(show.downloads || 0).toLocaleString()}</div>
                    <div class="text-xs text-zinc-600">plays</div>
                </div>
            </div>
        </div>
    `;
}

function createGridCard(show) {
    const artist = escapeHtml(show.creator || 'Unknown Artist');
    const showTitle = escapeHtml(show.title || show.date || 'Unknown Show');
    const safeId = escapeHtml(show.identifier);

    const src = show.source ? show.source.toLowerCase() : '';
    const sourceType = src.includes('sbd') ? 'SBD' : src.includes('aud') ? 'AUD' : '';

    return `
        <div class="show-card rounded-lg p-4 cursor-pointer h-full flex flex-col"
             onclick="openPlayerPage('${safeId}')">
            <div class="flex-1">
                <div class="text-xs text-zinc-500 mb-1">${artist}</div>
                <h4 class="font-medium text-sm text-white mb-2 leading-snug" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${showTitle}
                </h4>
                <div class="text-xs text-zinc-500 space-y-1">
                    ${show.date || show.year ? `<div>${escapeHtml(show.date || String(show.year))}</div>` : ''}
                    ${show.venue ? `<div class="truncate">${escapeHtml(show.venue)}</div>` : ''}
                </div>
            </div>
            <div class="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                <span class="text-zinc-500">${(show.downloads || 0).toLocaleString()} plays</span>
                <div class="flex items-center gap-2">
                    ${sourceType ? `<span class="tag tag-${sourceType.toLowerCase()}">${sourceType}</span>` : ''}
                    ${show.avg_rating >= 4 ? `<span class="text-blue-400">★${show.avg_rating.toFixed(1)}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

function createCompactCard(show) {
    const src = show.source ? show.source.toLowerCase() : '';
    const sourceType = src.includes('sbd') ? 'SBD' : src.includes('aud') ? 'AUD' : src.includes('matrix') ? 'MTX' : '';
    const safeId = escapeHtml(show.identifier);

    return `
        <div class="show-card px-4 py-2.5 rounded-lg flex items-center gap-4 cursor-pointer"
             onclick="openPlayerPage('${safeId}')">
            <div class="w-20 text-xs text-zinc-500 flex-shrink-0">${escapeHtml(show.date || String(show.year || '')) || '—'}</div>
            <div class="flex-1 min-w-0">
                <div class="text-sm text-white truncate">${escapeHtml(show.title || 'Unknown Show')}</div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 text-xs">
                ${sourceType ? `<span class="tag tag-${sourceType.toLowerCase()}">${sourceType}</span>` : ''}
                ${show.avg_rating >= 4 ? `<span class="text-blue-400">★${show.avg_rating.toFixed(1)}</span>` : ''}
                <span class="text-zinc-600 w-16 text-right">${(show.downloads || 0).toLocaleString()}</span>
            </div>
        </div>
    `;
}

function updatePagination(customTotal = null) {
    const total = customTotal !== null ? customTotal : totalResults;
    const totalPages = Math.ceil(total / resultsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (pageInfo) {
        if (total === 0) {
            pageInfo.textContent = '';
        } else {
            pageInfo.textContent = `Page ${currentPage} of ${totalPages} • ${total.toLocaleString()} total`;
        }
    }
    if (prevPage) prevPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage === totalPages || totalPages === 0;
}

export function changePage(delta) {
    searchShows(currentPage + delta);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function switchView(view) {
    currentView = view;

    document.querySelectorAll('[data-view]').forEach(btn => {
        if (btn.dataset.view === view) {
            btn.classList.add('bg-sky-600', 'text-white');
            btn.classList.remove('text-gray-400', 'hover:bg-gray-700');
        } else {
            btn.classList.remove('bg-sky-600', 'text-white');
            btn.classList.add('text-gray-400', 'hover:bg-gray-700');
        }
    });

    if (currentResults.length > 0) {
        updateResultsDisplay();
    }

    localStorage.setItem('tapeFinder_viewMode', view);
}

export function openPlayerPage(identifier) {
    if (!identifier) {
        showToast('Invalid show identifier', 'error');
        return;
    }
    window.location.href = `player.html?id=${encodeURIComponent(identifier)}`;
}

export function initSearchPage() {
    console.log('Initializing modern search page...');

    const searchButton = document.getElementById('searchButton');
    const searchQuery = document.getElementById('searchQuery');
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    const bandSelector = document.getElementById('bandSelector');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    const savedView = localStorage.getItem('tapeFinder_viewMode');
    if (savedView) {
        currentView = savedView;
        switchView(savedView);
    }

    if (yearFrom && yearTo) {
        const savedBand = storage.getSelectedBand();
        const config = getBandConfig(savedBand);
        if (config && config.yearRange) {
            yearFrom.value = config.yearRange[0];
            yearTo.value = config.yearRange[1];
        } else {
            yearFrom.value = '';
            yearTo.value = '';
        }
    }

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchShows(1);
        });
    }

    if (searchButton) {
        searchButton.addEventListener('click', (e) => {
            e.preventDefault();
            searchShows(1);
        });
    }

    if (searchQuery) {
        searchQuery.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchShows(1);
            }
        });
    }

    if (yearFrom) yearFrom.addEventListener('change', () => searchShows(1));
    if (yearTo) yearTo.addEventListener('change', () => searchShows(1));

    if (bandSelector) {
        const savedBand = storage.getSelectedBand();
        if (savedBand && bandSelector.querySelector(`option[value="${savedBand}"]`)) {
            bandSelector.value = savedBand;
        }

        bandSelector.addEventListener('change', function() {
            storage.setSelectedBand(this.value);
            currentPage = 1;

            const config = getBandConfig(this.value);
            if (yearFrom && yearTo) {
                if (config && config.yearRange) {
                    yearFrom.value = config.yearRange[0];
                    yearTo.value = config.yearRange[1];
                } else {
                    yearFrom.value = '';
                    yearTo.value = '';
                }
            }

            searchShows(1);
        });
    }

    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.dataset.filter;

            if (activeFilters.has(filter)) {
                activeFilters.delete(filter);
                this.classList.remove('active');
            } else {
                activeFilters.add(filter);
                this.classList.add('active');
            }

            searchShows(1);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea')) return;

        switch(e.key.toLowerCase()) {
            case '/':
                e.preventDefault();
                if (searchQuery) searchQuery.focus();
                break;
            case 'r':
                e.preventDefault();
                if (currentResults.length > 0) {
                    const pick = currentResults[Math.floor(Math.random() * currentResults.length)];
                    if (pick && pick.identifier) openPlayerPage(pick.identifier);
                } else {
                    showToast('Run a search first to pick a random show', 'info');
                }
                break;
        }
    });

    if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
    if (nextPage) nextPage.addEventListener('click', () => changePage(1));

    console.log('Running initial search...');
    searchShows(1);
}

window.openPlayerPage = openPlayerPage;
window.searchShows = searchShows;
window.changePage = changePage;
window.switchView = switchView;
