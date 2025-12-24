// storage.js - Centralized storage management

class StorageManager {
    constructor() {
        this.prefix = 'tapeFinder_';
        this.initStorage();
    }

    initStorage() {
        // Validate and initialize recently viewed
        try {
            const raw = localStorage.getItem(this.prefix + 'recentlyViewed') || '[]';
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error('Invalid format');
        } catch {
            console.error('Invalid recentlyViewed; resetting');
            localStorage.removeItem(this.prefix + 'recentlyViewed');
        }
    }

    // Get recently viewed shows
    getRecentlyViewed() {
        try {
            const raw = localStorage.getItem(this.prefix + 'recentlyViewed') || '[]';
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    // Update recently viewed shows
    updateRecentlyViewed(show) {
        if (!show || !show.identifier) {
            console.error('Invalid show data for recently viewed');
            return;
        }

        let stored = this.getRecentlyViewed();
        
        // Remove if already exists, then add to front
        stored = stored.filter(s => s.identifier !== show.identifier);
        stored.unshift({
            identifier: show.identifier,
            title: show.title || 'Unknown Show'
        });
        
        // Keep only last 5
        if (stored.length > 5) stored.pop();

        try {
            localStorage.setItem(this.prefix + 'recentlyViewed', JSON.stringify(stored));
        } catch (e) {
            console.error('Error saving recentlyViewed:', e);
        }
        
        return stored;
    }

    // Get selected band
    getSelectedBand() {
        return localStorage.getItem(this.prefix + 'selectedBand') || 'GratefulDead';
    }

    // Save selected band
    setSelectedBand(band) {
        try {
            localStorage.setItem(this.prefix + 'selectedBand', band);
        } catch (e) {
            console.error('Error saving selected band:', e);
        }
    }

    // Clear all storage
    clearAll() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        });
    }
}

// Export singleton instance
export const storage = new StorageManager();