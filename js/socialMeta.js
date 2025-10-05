/**
 * socialMeta.js - Dynamic social media meta tags updater
 * Updates Open Graph and Twitter Card tags based on content
 */

export class SocialMetaUpdater {
    /**
     * Update social meta tags for a show
     * @param {Object} show - Show data from Archive.org
     */
    static updateShowMeta(show) {
        if (!show || !show.metadata) return;

        const meta = show.metadata;
        const identifier = show.metadata.identifier;
        
        // Build show title
        const artist = meta.creator || 'Live Music';
        const showDate = meta.date || meta.year || '';
        const venue = meta.venue || '';
        const title = `${artist}${showDate ? ' - ' + showDate : ''}${venue ? ' @ ' + venue : ''}`;
        
        // Build description
        let description = `Listen to ${artist}`;
        if (showDate && venue) {
            description += ` performing live on ${showDate} at ${venue}`;
        } else if (showDate) {
            description += ` from ${showDate}`;
        } else if (venue) {
            description += ` at ${venue}`;
        }
        
        if (meta.source) {
            const source = meta.source.toLowerCase();
            if (source.includes('soundboard') || source.includes('sbd')) {
                description += '. High-quality soundboard recording';
            } else if (source.includes('audience') || source.includes('aud')) {
                description += '. Audience recording';
            }
        }
        
        description += ' from Archive.org';
        
        // Build URL
        const pageUrl = `${window.location.origin}${window.location.pathname}?id=${identifier}`;
        
        // Try to find an image (Archive.org sometimes has show images)
        const imageUrl = `https://archive.org/services/img/${identifier}`;
        
        // Update page title
        document.title = title;
        
        // Update or create meta tags
        this.setMetaTag('og:title', title);
        this.setMetaTag('og:description', description);
        this.setMetaTag('og:url', pageUrl);
        this.setMetaTag('og:image', imageUrl);
        this.setMetaTag('og:type', 'music.song');
        
        // Twitter Card
        this.setMetaTag('twitter:title', title, 'name');
        this.setMetaTag('twitter:description', description, 'name');
        this.setMetaTag('twitter:url', pageUrl, 'name');
        this.setMetaTag('twitter:image', imageUrl, 'name');
        
        // Music-specific Open Graph tags
        if (meta.creator) {
            this.setMetaTag('music:musician', meta.creator);
        }
        if (meta.date) {
            this.setMetaTag('music:release_date', meta.date);
        }
        
        // Additional structured data
        this.updateStructuredData({
            title,
            artist,
            date: meta.date,
            venue: meta.venue,
            identifier,
            url: pageUrl
        });
        
        console.log('✅ Social meta tags updated for:', title);
    }
    
    /**
     * Set or update a meta tag
     * @param {string} property - Meta property name
     * @param {string} content - Meta content
     * @param {string} attr - Attribute to use (property or name)
     */
    static setMetaTag(property, content, attr = 'property') {
        if (!content) return;
        
        let meta = document.querySelector(`meta[${attr}="${property}"]`);
        
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attr, property);
            document.head.appendChild(meta);
        }
        
        meta.setAttribute('content', content);
    }
    
    /**
     * Update structured data (JSON-LD)
     * @param {Object} data - Show data
     */
    static updateStructuredData(data) {
        // Remove existing structured data for music
        const existing = document.querySelector('script[type="application/ld+json"][data-show]');
        if (existing) existing.remove();
        
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "MusicRecording",
            "name": data.title,
            "byArtist": {
                "@type": "MusicGroup",
                "name": data.artist
            },
            "recordingOf": {
                "@type": "MusicComposition",
                "name": data.title
            },
            "datePublished": data.date,
            "url": data.url,
            "inLanguage": "en",
            "recordedAt": data.venue ? {
                "@type": "EventVenue",
                "name": data.venue
            } : undefined
        };
        
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-show', 'true');
        script.textContent = JSON.stringify(structuredData, null, 2);
        document.head.appendChild(script);
    }
    
    /**
     * Create shareable links
     * @param {string} url - URL to share
     * @param {string} title - Title to share
     * @returns {Object} Share URLs for different platforms
     */
    static getShareLinks(url, title) {
        const encodedUrl = encodeURIComponent(url);
        const encodedTitle = encodeURIComponent(title);
        
        return {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
            reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
            email: `mailto:?subject=${encodedTitle}&body=Check out this concert recording: ${encodedUrl}`,
            copy: url
        };
    }
    
    /**
     * Create share button UI
     * @param {string} identifier - Archive.org identifier
     * @param {string} title - Show title
     * @returns {HTMLElement} Share button element
     */
    static createShareButton(identifier, title) {
        const url = `${window.location.origin}${window.location.pathname}?id=${identifier}`;
        const shareLinks = this.getShareLinks(url, title);
        
        const container = document.createElement('div');
        container.className = 'relative inline-block';
        
        container.innerHTML = `
            <button class="share-button inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share</span>
            </button>
            <div class="share-menu hidden absolute top-full mt-2 right-0 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50 min-w-[200px]">
                <a href="${shareLinks.facebook}" target="_blank" rel="noopener" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors">
                    <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                </a>
                <a href="${shareLinks.twitter}" target="_blank" rel="noopener" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors">
                    <svg class="w-5 h-5 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                    <span>Twitter</span>
                </a>
                <a href="${shareLinks.reddit}" target="_blank" rel="noopener" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors">
                    <svg class="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                    </svg>
                    <span>Reddit</span>
                </a>
                <button class="copy-link-btn flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors w-full text-left" data-url="${url}">
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Copy Link</span>
                </button>
            </div>
        `;
        
        // Toggle share menu
        const button = container.querySelector('.share-button');
        const menu = container.querySelector('.share-menu');
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('hidden');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', () => {
            menu.classList.add('hidden');
        });
        
        // Copy link functionality
        const copyBtn = container.querySelector('.copy-link-btn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(url);
                copyBtn.innerHTML = `
                    <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Copied!</span>
                `;
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>Copy Link</span>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
        
        return container;
    }
}

// Export for use in player.js
export default SocialMetaUpdater;