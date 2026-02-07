# Live Music Archive Explorer

A web application for searching and streaming live concert recordings from Archive.org's etree collection. Features a Node.js backend with MySQL caching, optional user accounts, favorites, shareable collections, and an admin panel.

**Live Demo:** https://gratefuldeadparkinglots.com

## Features

### Search & Playback
- Full Archive.org Advanced Search API integration
- Pre-configured queries for 50+ artists across jam, bluegrass, funk, rock, and electronic genres
- Quality filters: Soundboard, Audience, Matrix, Top Rated
- Year range filtering with band-specific defaults
- Three view modes: List, Grid, Compact
- HTML5 audio player with full transport controls, shuffle, loop, and keyboard shortcuts
- Web Audio API frequency visualization
- Dynamic social meta tags (Open Graph, Twitter Cards, JSON-LD) for link previews

### Backend & Caching
- Node.js/Express backend proxies and caches Archive.org API responses in MySQL
- Search results cached for 6 hours, show metadata cached for 24 hours
- Automatic hourly cache expiration and cleanup
- Graceful degradation: if the backend is offline, the frontend falls back to direct Archive.org calls
- Rate limiting on authentication endpoints (20 attempts per 15 minutes)

### User Accounts (Optional)
- Registration and login with bcrypt-hashed passwords (12 rounds)
- Session-based authentication stored in MySQL
- Profile management (display name, email, password change)
- Accounts are entirely optional -- all browsing and playback works without signing in

### Favorites & Collections
- Heart icon to favorite any show (logged-in users)
- Personal notes on each favorite
- Create named, shareable collections of shows
- Public collection URLs for sharing curated playlists
- "Add to Collection" dropdown on the player page

### Admin Panel
- Dashboard with cache stats, user counts, and top-favorited shows
- User management: create, promote/demote admin, delete
- Cache management: clear expired entries or purge all
- Accessible at `/admin.html` (admin login required)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (ES6 modules), HTML5, Tailwind CSS (CDN) |
| Backend | Node.js, Express.js |
| Database | MySQL 5.7+ / MariaDB 10.3+ (mysql2) |
| Auth | bcrypt, express-session, express-mysql-session |
| Validation | express-validator |
| Audio | HTML5 Audio API, Web Audio API |
| Data Source | Archive.org public API |

## Project Structure

```
├── index.html              # Search page
├── player.html             # Audio player page
├── login.html              # Login / register page
├── profile.html            # User profile, favorites, collections
├── collection.html         # Public collection view
├── admin.html              # Admin panel
├── .htaccess               # Apache proxy config for cPanel hosting
├── css/
│   └── styles.css          # Custom styles and theme variables
├── js/
│   ├── main.js             # Entry point, routing, auth init
│   ├── api.js              # API layer (backend with Archive.org fallback)
│   ├── auth.js             # Authentication UI
│   ├── favorites.js        # Favorites and collections UI
│   ├── search.js           # Search logic and rendering
│   ├── player.js           # Audio player implementation
│   ├── visualizer.js       # Web Audio visualization
│   ├── bandConfig.js       # Band/collection configurations
│   ├── utils.js            # Utility functions (formatting, XSS protection, toasts)
│   ├── storage.js          # localStorage wrapper
│   └── socialMeta.js       # Dynamic meta tags for SEO/sharing
└── server/
    ├── package.json        # Node.js dependencies
    ├── index.js            # Express server entry point
    ├── install.js          # Interactive database setup script
    ├── .env.example        # Environment variable template
    ├── config/
    │   └── database.js     # MySQL connection pool with keep-alive
    ├── middleware/
    │   └── auth.js         # Session authentication middleware
    ├── routes/
    │   ├── search.js       # GET /api/search (cached proxy)
    │   ├── shows.js        # GET /api/shows/:id (cached proxy)
    │   ├── auth.js         # POST /api/auth/register, login, logout
    │   ├── favorites.js    # CRUD /api/favorites
    │   ├── collections.js  # CRUD /api/collections
    │   └── admin.js        # Admin API endpoints
    ├── services/
    │   ├── cacheService.js # Cache read/write/expire logic
    │   └── archiveProxy.js # Archive.org API client with retry logic
    └── schema/
        └── init.sql        # Database schema (all tables)
```

## Installation

### Prerequisites
- Node.js 16+
- MySQL 5.7+ or MariaDB 10.3+

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/morroware/Grateful-Dead-Tape-Finder.git
cd Grateful-Dead-Tape-Finder/server

# Install dependencies
npm install

# Run the interactive installer
# This creates the database, tables, .env file, and admin account
node install.js

# Start the server
npm start
```

The installer will prompt you for MySQL credentials and create everything automatically. Once started, open `http://localhost:3001` in your browser.

### Manual Setup

1. Copy `.env.example` to `.env` and fill in your MySQL credentials:

```bash
cp .env.example .env
```

2. Create the database and tables:

```bash
mysql -u root -p < schema/init.sql
```

3. Install dependencies and start:

```bash
npm install
npm start
```

### cPanel / Shared Hosting Setup

1. **Create a MySQL Database** in cPanel > MySQL Databases
   - Create a database (e.g., `youruser_tapefinder`)
   - Create a database user with a strong password
   - Add the user to the database with All Privileges

2. **Upload Files** via cPanel File Manager or FTP
   - Upload the entire project to your `public_html` directory (or a subdirectory)
   - The `.htaccess` file handles routing API requests to the Node.js backend

3. **Set Up Node.js** via cPanel > Setup Node.js App (if available)
   - Application root: `server/`
   - Application startup file: `index.js`
   - Set environment variables from `.env.example`
   - Click "Run NPM Install" then "Start Application"

4. **Alternative: SSH Setup**

```bash
cd ~/public_html/server   # or wherever you uploaded
cp .env.example .env
nano .env                 # fill in your cPanel MySQL credentials
npm install
node install.js           # creates tables and admin user
```

5. **Keep Node.js Running** -- use PM2 or cPanel's Node.js manager:

```bash
npm install -g pm2
pm2 start index.js --name tapefinder
pm2 save
pm2 startup
```

6. **Apache Proxy** -- The included `.htaccess` file proxies `/api/*` requests to the Node.js backend on port 3001. If your cPanel uses Phusion Passenger instead, uncomment the Passenger lines in `.htaccess` and comment out the RewriteRule.

### Static-Only Mode (No Backend)

The app works without the backend -- just serve the files from any static host. Search and playback use Archive.org directly. User accounts, favorites, collections, and caching won't be available.

```bash
# Any of these work:
python3 -m http.server 8000
npx http-server -p 8000
php -S localhost:8000
```

## Database Schema

8 tables in MySQL:

| Table | Purpose |
|-------|---------|
| `search_cache` | Cached Archive.org search result pages (6h TTL) |
| `shows` | Cached show metadata (24h TTL) |
| `show_tracks` | Track listings for cached shows |
| `users` | User accounts (bcrypt passwords) |
| `favorites` | User-to-show favorites with personal notes |
| `collections` | Named, shareable curated show lists |
| `collection_items` | Shows within collections (ordered) |
| `sessions` | Server-side session storage (express-mysql-session) |

## API Endpoints

### Public (no auth)
- `GET /api/search?q=...&page=1&rows=10` -- Search with caching
- `GET /api/shows/:identifier` -- Show metadata with caching
- `GET /api/health` -- Server health check
- `GET /api/collections/:slug` -- View public collection

### Auth
- `POST /api/auth/register` -- Create account (rate-limited)
- `POST /api/auth/login` -- Sign in (rate-limited)
- `POST /api/auth/logout` -- Sign out
- `GET /api/auth/me` -- Check current session
- `PUT /api/auth/profile` -- Update profile/password

### Favorites (auth required)
- `GET /api/favorites` -- List favorites
- `GET /api/favorites/check/:identifier` -- Check if favorited
- `POST /api/favorites` -- Add favorite
- `PUT /api/favorites/:identifier` -- Update notes
- `DELETE /api/favorites/:identifier` -- Remove favorite

### Collections (auth for write)
- `GET /api/collections` -- List user's collections
- `POST /api/collections` -- Create collection
- `GET /api/collections/:slug` -- View collection (public or owner)
- `PUT /api/collections/:slug` -- Update collection
- `DELETE /api/collections/:slug` -- Delete collection
- `POST /api/collections/:slug/items` -- Add show to collection
- `DELETE /api/collections/:slug/items/:identifier` -- Remove show

### Admin (admin auth required)
- `GET /api/admin/stats` -- Dashboard stats
- `GET /api/admin/users` -- List users (paginated)
- `POST /api/admin/users` -- Create user
- `PUT /api/admin/users/:id` -- Update user role
- `DELETE /api/admin/users/:id` -- Delete user
- `POST /api/admin/cache/clear` -- Clear expired cache
- `POST /api/admin/cache/purge` -- Purge all cache

## Keyboard Shortcuts

### Search Page
| Key | Action |
|-----|--------|
| `/` | Focus search input |
| `R` | Random show |
| `1`, `2`, `3` | Switch view mode (List, Grid, Compact) |

### Player Page
| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `Left Arrow` / `Right Arrow` | Seek +/-5 seconds |
| `J` / `L` | Seek +/-10 seconds |
| `M` | Mute toggle |
| `N` | Next track |
| `P` | Previous track |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | MySQL host |
| `DB_PORT` | 3306 | MySQL port |
| `DB_USER` | tapefinder | MySQL username |
| `DB_PASSWORD` | | MySQL password |
| `DB_NAME` | tapefinder | Database name |
| `SESSION_SECRET` | | Random secret for sessions (generated by installer) |
| `PORT` | 3001 | Server port |
| `FRONTEND_ORIGIN` | http://localhost:8080 | CORS allowed origin (`*` for any, comma-separated for multiple) |
| `SEARCH_CACHE_TTL` | 21600 | Search cache lifetime in seconds (6h) |
| `SHOW_CACHE_TTL` | 86400 | Show cache lifetime in seconds (24h) |
| `ARCHIVE_API_BASE` | https://archive.org | Archive.org API base URL |

## Configuration

### Adding Bands

Edit `js/bandConfig.js`:

```javascript
'NewBandId': {
    query: 'collection:(CollectionName) AND mediatype:(etree)',
    title: 'Band Display Name',
    yearRange: [1990, 2024]  // optional
}
```

Add to `getAllBands()` for the dropdown, and add a matching `<option>` in `index.html`.

### Cache TTLs

Adjust `SEARCH_CACHE_TTL` and `SHOW_CACHE_TTL` in `.env` (values in seconds):
- Search results: 21600 (6 hours) -- balances freshness with API load
- Show metadata: 86400 (24 hours) -- metadata rarely changes

## Security

- All user-facing text is HTML-escaped to prevent XSS
- SQL queries use parameterized statements to prevent injection
- Passwords are hashed with bcrypt (12 rounds)
- Session cookies are httpOnly with secure flag in production
- Auth endpoints are rate-limited (20 requests per 15 minutes)
- Show identifiers are validated against a strict allowlist pattern
- CORS is configurable via environment variable

## Browser Requirements

- ES6 module support
- Web Audio API
- HTML5 Audio
- Fetch API
- localStorage

**Tested on:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## License

Share Ye Well License -- See licence.md

## Credits

- Archive.org for the etree collection and API
- Tailwind CSS for the utility framework
- The live music community for recording preservation
