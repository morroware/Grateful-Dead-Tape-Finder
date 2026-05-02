/**
 * utils.js - Essential utility functions only
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for innerHTML
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format time from seconds to human-readable format
 * @param {number} sec - Time in seconds
 * @returns {string} Formatted time string (e.g., "3:45" or "1:23:45")
 */
export function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * Creates a new shuffled array without modifying the original
 * @param {Array} arr - Array to shuffle
 * @returns {Array} New shuffled array
 */
export function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Show player error with retry option
 * Displays an error message in the player UI with a retry button
 * @param {string} msg - Error message to display
 */
export function showPlayerError(msg) {
    const pw = document.getElementById('player-wrapper');
    if (!pw) return;
    
    const err = document.createElement('div');
    err.className = 'bg-red-800 text-white px-4 py-2 rounded-lg mb-4';
    err.innerHTML = `
        <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${escapeHtml(msg)}</span>
        </div>
        <button class="mt-2 bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm"
                onclick="window.retryCurrentTrack()">
            Retry
        </button>`;
    
    const existing = pw.querySelector('.bg-red-800');
    if (existing) existing.remove();
    pw.insertBefore(err, pw.firstChild);
}

/**
 * Show loading indicator with skeleton placeholders
 * Displays loading animation and placeholder cards
 */
export function showLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.remove('hidden');
    
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            resultsDiv.innerHTML += `
                <div class="show-card-skeleton">
                    <div class="skeleton-line" style="width: 50%;"></div>
                    <div class="skeleton-line" style="width: 80%;"></div>
                    <div class="skeleton-line" style="width: 60%;"></div>
                </div>
            `;
        }
    }
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, info)
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Remove any existing toast
    const existing = document.getElementById('toast');
    if (existing) existing.remove();
    
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        warning: 'bg-yellow-600'
    };
    
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export showToast for global use
window.showToast = showToast;