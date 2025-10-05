/**
 * main.js - Main application entry point with robust error handling
 */

import { initSearchPage } from './search.js';
import { Player } from './player.js';
import { showToast } from './utils.js';

// Global player instance for player page
let player = null;

/**
 * Retry current track (for error retry button)
 */
window.retryCurrentTrack = function() {
    const errorEl = document.querySelector('.bg-red-800');
    if (errorEl) errorEl.remove();
    if (player) {
        try {
            player.loadTrack(player.currentIndex);
            player.playPause();
        } catch (e) {
            console.error('Retry failed:', e);
            showToast('Unable to retry. Please refresh the page.', 'error');
        }
    }
};

/**
 * Initialize player page with error handling
 */
async function initializePlayerPage() {
    const params = new URLSearchParams(window.location.search);
    const identifier = params.get('id');
    
    if (!identifier) {
        showPlayerInitError('No show ID provided. Please select a show from the search page.');
        return;
    }
    
    const trackParam = parseInt(params.get('track'), 10);
    
    // Determine start track
    let startTrack = 0;
    if (!isNaN(trackParam) && trackParam > 0) {
        startTrack = trackParam - 1;
    }
    
    try {
        // Create and initialize player
        player = new Player();
        window.player = player; // Expose for onclick handlers
        
        const success = await player.initialize(identifier, startTrack);
        
        if (!success) {
            showPlayerInitError('Failed to load show. The recording may be unavailable.');
            return;
        }
        
        // Auto-play if coming from search (with error handling)
        try {
            await player.playPause();
        } catch (e) {
            console.log('Auto-play blocked by browser or failed:', e);
            // This is okay - user can click play manually
        }
        
        // Update URL when track changes
        const originalLoadTrack = player.loadTrack.bind(player);
        player.loadTrack = function(index) {
            try {
                originalLoadTrack(index);
                const q = new URLSearchParams(window.location.search);
                q.set('track', index + 1);
                history.replaceState(null, '', window.location.pathname + '?' + q);
            } catch (e) {
                console.error('Error updating URL:', e);
                // Non-critical error, continue anyway
            }
        };
        
    } catch (error) {
        console.error('Fatal error initializing player:', error);
        showPlayerInitError(error.message || 'Unknown error loading player');
    }
}

/**
 * Show player initialization error
 */
function showPlayerInitError(message) {
    const pw = document.getElementById('player-wrapper');
    if (pw) {
        pw.innerHTML = `
            <div class="bg-gray-800 border-2 border-red-900 rounded-lg p-6 text-center">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 class="text-xl font-bold text-red-400 mb-2">Error Loading Player</h3>
                <p class="text-gray-300 mb-4">${message}</p>
                <div class="flex gap-4 justify-center">
                    <button onclick="location.reload()" 
                            class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
                        Try Again
                    </button>
                    <a href="index.html" 
                       class="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors inline-block">
                        Return to Search
                    </a>
                </div>
            </div>`;
    }
}

/**
 * Main initialization with comprehensive error handling
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing application');
    
    // Set up global error handler
    window.addEventListener('error', function(event) {
        console.error('Global error:', event.error);
        // Don't show toast for every error, as it could be annoying
        // Only log to console for debugging
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        // Log but don't interrupt user experience
    });
    
    const isPlayerPage = window.location.pathname.includes('player.html');
    
    if (isPlayerPage) {
        // Player page
        console.log('Initializing player page');
        try {
            initializePlayerPage();
        } catch (error) {
            console.error('Fatal error on player page:', error);
            showPlayerInitError(error.message || 'Unknown error');
        }
    } else {
        // Search page
        console.log('Initializing search page');
        try {
            initSearchPage();
        } catch (error) {
            console.error('Error initializing search:', error);
            
            // Show user-friendly error on search page
            const resultsDiv = document.getElementById('results');
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="text-center my-8 p-6 bg-gray-800 border-2 border-red-900 rounded-lg">
                        <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 class="text-xl font-semibold text-red-400 mb-2">Initialization Error</h3>
                        <p class="text-gray-400 mb-4">
                            The application failed to start properly.
                        </p>
                        <button onclick="location.reload()" 
                                class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
                            Reload Page
                        </button>
                    </div>`;
            }
            
            // Still show a toast so user knows something happened
            showToast('Application error. Please refresh the page.', 'error', 5000);
        }
    }
});

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    if (player) {
        try {
            player.destroy();
        } catch (e) {
            console.error('Error during cleanup:', e);
            // Non-critical, page is unloading anyway
        }
    }
});