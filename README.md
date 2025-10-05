# Live Music Archive Explorer

A static web application for searching and streaming live concert recordings from Archive.org's etree collection. Built with vanilla JavaScript, HTML5, and CSS.

**Live Demo:** https://gratefuldeadparkinglots.com

## Overview

This application provides a search interface and audio player for Archive.org's live music library. It requires no backend infrastructure, frameworks, or build tools.

## Features

### Search

- Full Archive.org Advanced Search API integration
- Pre-configured queries for 50+ artists and collections
- Quality filters: Five-star ratings, Soundboard, Audience, Matrix recordings
- Year range filtering with band-specific defaults
- Pagination with configurable result count
- Three view modes: List, Grid, Compact

### Audio Player

- HTML5 audio playback with full transport controls
- Shuffle and loop modes (none, single, all)
- Volume control and muting
- Track seeking with buffer visualization
- Automatic retry on network failures (3 attempts)
- Error handling for corrupt/unsupported files
- Web Audio API frequency visualization

### State Management

- localStorage for view preferences and recently viewed shows
- URL-based deep linking to specific shows and tracks
- Automatic scroll-to-active track in playlist

### UI/UX

- Keyboard shortcuts for all primary functions
- Responsive design for mobile and desktop
- Loading states with skeleton screens
- Toast notifications for user feedback
- Collapsible sections on mobile

## Technical Stack

- **Frontend:** Vanilla JavaScript (ES6 modules)
- **Styling:** Tailwind CSS (CDN) + custom CSS
- **Audio:** HTML5 Audio API, Web Audio API
- **Storage:** localStorage
- **API:** Archive.org Advanced Search

## Browser Requirements

- ES6 module support
- Web Audio API
- HTML5 Audio
- Fetch API
- CSS Grid/Flexbox
- localStorage

**Tested on:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Installation

1. Clone the repository:

```bash
git clone https://github.com/morroware/Grateful-Dead-Tape-Finder.git
cd Grateful-Dead-Tape-Finder
```

2. Serve via HTTP (required for ES6 modules):

**Python 3:**
```bash
python -m http.server 8000
```

**Node.js:**
```bash
npx http-server -p 8000
```

**PHP:**
```bash
php -S localhost:8000
```

3. Navigate to `http://localhost:8000`

## Project Structure

```
├── index.html              # Search page
├── player.html             # Player page
├── css/
│   └── styles.css          # Custom styles and theme variables
└── js/
    ├── main.js             # Entry point, routing, error boundary
    ├── search.js           # Search logic, API calls, rendering
    ├── player.js           # Audio player implementation
    ├── visualizer.js       # Web Audio visualization
    ├── bandConfig.js       # Band/collection configurations
    ├── utils.js            # Utility functions
    ├── storage.js          # localStorage wrapper
    └── socialMeta.js       # Dynamic meta tags for SEO
```

## Module Documentation

### main.js

Application bootstrap, page routing, global error handling.

### search.js

- `searchShows(page)`: Executes Archive.org API query
- `updateResultsDisplay()`: Renders results in active view mode
- `changePage(delta)`: Pagination control
- `switchView(view)`: Changes between list/grid/compact modes

### player.js

Core Player class:

- `initialize(identifier, startTrack)`: Loads show metadata and playlist
- `loadTrack(index)`: Loads audio source
- `playPause()`: Toggle playback
- `nextTrack()/prevTrack()`: Navigation with loop/shuffle support
- `selectTrack(index)`: Direct track selection
- Error recovery with consecutive error tracking

### visualizer.js

Visualizer class for Web Audio API integration:

- `initialize(audioElement)`: Creates AudioContext and AnalyserNode
- `draw()`: RequestAnimationFrame loop for canvas rendering
- FFT size: 256, renders frequency bars with gradient effects

### bandConfig.js

Configuration object mapping band IDs to Archive.org queries:

```javascript
{
    query: string,           // Archive.org search query
    title: string,           // Display name
    yearRange?: [number, number],  // Optional year filter
    customSearch?: boolean   // Enable freeform search
}
```

### utils.js

- `formatTime(seconds)`: Converts seconds to MM:SS or H:MM:SS
- `shuffleArray(array)`: Fisher-Yates shuffle
- `showToast(message, type, duration)`: Toast notifications
- `showPlayerError(message)`: Player error display

### storage.js

StorageManager singleton:

- `getRecentlyViewed()`: Returns last 5 shows
- `updateRecentlyViewed(show)`: Adds show to history
- `getSelectedBand()/setSelectedBand(band)`: Persists dropdown selection

### socialMeta.js

SocialMetaUpdater static class:

- `updateShowMeta(show)`: Updates Open Graph and Twitter Card tags
- `createShareButton(identifier, title)`: Generates share UI
- `getShareLinks(url, title)`: Returns platform-specific share URLs

## Configuration

### Adding Bands

Edit `js/bandConfig.js`:

```javascript
export const bandConfig = {
    'NewBandId': {
        query: 'collection:(CollectionName) AND mediatype:(etree)',
        title: 'Band Display Name',
        yearRange: [1990, 2024]  // optional
    }
};
```

Update `getAllBands()` to add to dropdown:

```javascript
{ group: 'Genre Name', options: [
    { id: 'NewBandId', title: 'Band Display Name' }
]}
```

### Theme Customization

CSS variables in `css/styles.css`:

```css
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --accent-primary: #0ea5e9;
  --accent-secondary: #06b6d4;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
}
```

### Visualizer Settings

Modify `js/visualizer.js` draw() method:

```javascript
this.analyser.fftSize = 256;  // 64, 128, 256, 512, 1024, 2048
const barHeight = eased * height * 1.7;  // Height multiplier
const hue = (i * 2 + time * 80) % 360;   // Color shift speed
```

## API Reference

### Archive.org Advanced Search

**Endpoint:**
```
https://archive.org/advancedsearch.php
```

**Parameters:**

- `q`: Query string (URL encoded)
- `fl[]`: Field list (identifier, title, year, venue, etc.)
- `sort[]`: Sort order (downloads desc)
- `output`: json
- `rows`: Results per page
- `page`: Page number

**Audio streaming:**
```
https://archive.org/download/{identifier}/{filename}
```

**Query Syntax:**

- Exact phrase: `"Madison Square Garden"`
- Boolean: `New York AND 1977`, `jazz OR blues`, `Dead NOT Company`
- Fields: `venue:"Red Rocks"`, `year:1989`
- Range: `year:[1970 TO 1979]`
- Wildcards: `phil*`, `grate?ul`

## Keyboard Shortcuts

### Search Page:

- `/`: Focus search input
- `R`: Random show
- `1, 2, 3`: Switch view modes

### Player Page:

- `Space` or `K`: Play/Pause
- `←/→`: Seek ±5 seconds
- `J/L`: Seek ±10 seconds
- `M`: Mute toggle
- `N`: Next track
- `P`: Previous track

## Error Handling

- **Network errors:** Automatic retry with exponential backoff (1s, 2s, 3s)
- **Audio errors:** Specific handling for MEDIA_ERR_NETWORK, MEDIA_ERR_DECODE, etc.
- **Consecutive failures:** After 3 failed tracks, show persistent error
- **Global handlers:** Catch unhandled exceptions and promise rejections

## Performance

- Debounced API calls during search input
- Paginated results (10 per page default)
- RequestAnimationFrame for 60fps visualization
- Canvas rendering optimized for low CPU usage
- Event listener cleanup on page unload
- No external dependencies beyond Tailwind CDN

## Known Limitations

- Archive.org API rate limiting during heavy usage
- Safari requires user interaction before AudioContext creation
- Mobile browsers may block autoplay
- Large playlists (100+ tracks) have slower metadata parsing
- No offline support (requires active internet connection)

## Deployment

Static hosting compatible with:

- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
- Firebase Hosting
- Any static file server

No build process or environment variables required.

## Development

No build tools needed. Edit files and refresh browser.

For production:

- Minify JavaScript and CSS
- Optimize images
- Add cache headers
- Consider CDN for static assets
- Enable gzip/brotli compression

## License

Share Ye Well License -- See License.md

## Credits

- Archive.org for etree collection and API
- Tailwind CSS for utility framework
- Live music community for recording preservation

