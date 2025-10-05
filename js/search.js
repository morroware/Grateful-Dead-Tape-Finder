/**
 * search.js - Modern search with Ocean Blue theme
 */

import { showLoading, hideLoading, showToast } from './utils.js';
import { getBandConfig } from './bandConfig.js';
import { storage } from './storage.js';

// Search state
let currentPage = 1;
const resultsPerPage = 10;
let totalResults = 0;
let currentView = 'list';
let currentResults = [];
let activeFilters = new Set();
let lastSearchParams = null;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`Fetch attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) {
                throw error;
            }
            await sleep(RETRY_DELAY * (i + 1));
        }
    }
}

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
            const toYear = yearTo || '2025';
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

        const url = `https://archive.org/advancedsearch.php?` +
            `q=${encodeURIComponent(baseQuery)}` +
            `&fl[]=identifier,title,year,venue,coverage,downloads,source,creator,date,avg_rating` +
            `&sort[]=downloads+desc&output=json` +
            `&rows=${resultsPerPage}&page=${page}`;
        
        const data = await fetchWithRetry(url);
        
        hideLoading();
        const resultsDiv = document.getElementById('results');
        
        if (!data.response || !data.response.docs || data.response.docs.length === 0) {
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
        
        totalResults = data.response.numFound;
        currentResults = data.response.docs;
        
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
    if (isSbd) tags += `<span class="tag bg-emerald-900 text-emerald-200 border border-emerald-700">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        SBD
    </span>`;
    if (isAud) tags += `<span class="tag bg-amber-900 text-amber-200 border border-amber-700">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        AUD
    </span>`;
    if (isMx) tags += `<span class="tag bg-cyan-900 text-cyan-200 border border-cyan-700">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        MATRIX
    </span>`;
    
    if (show.avg_rating && show.avg_rating > 0) {
        const stars = '★'.repeat(Math.round(show.avg_rating));
        tags += `<span class="tag bg-blue-900 text-blue-200 border border-blue-700">
            ${stars} ${show.avg_rating.toFixed(1)}
        </span>`;
    }
    
    const title = show.creator && show.creator !== 'Grateful Dead' ? 
        `${show.creator}` : 
        'Grateful Dead';
    
    const showTitle = show.title || show.date || 'Unknown Show';
    
    return `
        <div class="show-card card-hover p-4 md:p-6 rounded-xl md:rounded-2xl cursor-pointer group"
             onclick="openPlayerPage('${show.identifier}')">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-3 md:mb-4">
                <div class="flex-1 min-w-0">
                    <div class="text-xs md:text-sm font-semibold text-sky-400 mb-1">${title}</div>
                    <h3 class="text-base md:text-xl font-bold text-white mb-2 group-hover:text-sky-300 transition-colors leading-snug">
                        ${showTitle}
                    </h3>
                    <div class="flex flex-wrap gap-1.5 md:gap-2">${tags}</div>
                </div>
                <div class="text-left md:text-right flex-shrink-0">
                    <div class="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-cyan-400">
                        ${show.downloads || 0}
                    </div>
                    <div class="text-xs text-gray-500 font-medium">plays</div>
                </div>
            </div>
            
            <div class="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-400">
                ${show.venue ? `
                    <div class="flex items-center gap-1.5">
                        <svg class="w-3 h-3 md:w-4 md:h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>${show.venue}</span>
                    </div>
                ` : ''}
                ${show.date || show.year ? `
                    <div class="flex items-center gap-1.5">
                        <svg class="w-3 h-3 md:w-4 md:h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>${show.date || show.year}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-700 flex items-center justify-between">
                <span class="text-xs md:text-sm text-gray-500">${show.coverage || ''}</span>
                <div class="flex items-center gap-2 text-sky-400 font-medium text-xs md:text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Play now</span>
                    <svg class="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>
        </div>
    `;
}

function createGridCard(show) {
    const title = show.creator && show.creator !== 'Grateful Dead' ? show.creator : 'Grateful Dead';
    const showTitle = show.title || show.date || 'Unknown Show';
    
    const src = show.source ? show.source.toLowerCase() : '';
    const sourceIcon = src.includes('sbd') ? 
        '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>' :
        src.includes('aud') ?
        '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>' : '';
    
    return `
        <div class="show-card card-hover p-4 md:p-5 rounded-xl cursor-pointer group h-full flex flex-col"
             onclick="openPlayerPage('${show.identifier}')">
            <div class="flex-1">
                <div class="text-xs font-semibold text-sky-400 mb-2">${title}</div>
                <h4 class="font-bold text-sm md:text-base text-white mb-3 group-hover:text-sky-300 transition-colors leading-snug" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                    ${showTitle}
                </h4>
                <div class="space-y-1.5 text-xs text-gray-400">
                    ${show.date || show.year ? `<div class="flex items-center gap-1.5">
                        <svg class="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        ${show.date || show.year}
                    </div>` : ''}
                    ${show.venue ? `<div class="flex items-center gap-1.5">
                        <svg class="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        <span class="truncate">${show.venue}</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 text-gray-400">
                    ${sourceIcon}
                    <span>${show.downloads || 0} plays</span>
                </div>
                ${show.avg_rating ? `<span class="text-yellow-400 font-medium">★ ${show.avg_rating.toFixed(1)}</span>` : ''}
            </div>
        </div>
    `;
}

function createCompactCard(show) {
    const src = show.source ? show.source.toLowerCase() : '';
    const sourceType = src.includes('sbd') ? 'SBD' : src.includes('aud') ? 'AUD' : src.includes('matrix') ? 'MTX' : '';
    
    return `
        <div class="show-card px-4 py-3 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-opacity-100 group"
             onclick="openPlayerPage('${show.identifier}')">
            <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="flex-shrink-0 w-16 text-sm text-gray-500 font-medium">${show.date || show.year || '—'}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-white truncate group-hover:text-sky-300 transition-colors">${show.title || 'Unknown Show'}</div>
                    ${show.venue ? `<div class="text-xs text-gray-500 truncate">${show.venue}</div>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                ${sourceType ? `<span class="px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs font-medium">${sourceType}</span>` : ''}
                ${show.avg_rating ? `<span class="text-yellow-400 text-sm font-medium">★${show.avg_rating.toFixed(1)}</span>` : ''}
                <span class="text-gray-500 text-sm">${show.downloads || 0}</span>
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
    window.location.href = `player.html?id=${identifier}`;
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
            yearFrom.value = '1965';
            yearTo.value = '2025';
        }
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
            if (yearFrom && yearTo && config && config.yearRange) {
                yearFrom.value = config.yearRange[0];
                yearTo.value = config.yearRange[1];
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
                const randomBtn = document.getElementById('randomShow');
                if (randomBtn) randomBtn.click();
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