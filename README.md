# Live Music Archive Explorer

A web application for searching and streaming live concert recordings from Archive.org's etree collection. Features a PHP backend with MySQL caching, optional user accounts, favorites, shareable collections, and an admin panel.

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
- PHP backend proxies and caches Archive.org API responses in MySQL
- Search results cached for 6 hours, show metadata cached for 24 hours
- Works natively on any cPanel / shared hosting -- no Node.js required
- Graceful degradation: if the backend is offline, the frontend falls back to direct Archive.org calls
- Rate limiting on authentication endpoints (20 attempts per 15 minutes)

### User Accounts (Optional)
- Registration and login with bcrypt-hashed passwords (12 rounds)
- PHP native session authentication
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
| Backend | PHP 7.4+ (no frameworks, no Composer) |
| Database | MySQL 5.7+ / MariaDB 10.3+ (PDO) |
| Auth | password_hash (bcrypt), PHP sessions |
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
├── .htaccess               # Apache config (security headers, compression)
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
└── api/                    # PHP backend
    ├── .htaccess           # Route all requests to index.php
    ├── index.php           # API router
    ├── config.example.php  # Configuration template
    ├── Database.php        # PDO connection singleton
    ├── helpers.php         # Auth, JSON response, rate limiting
    ├── CacheService.php    # MySQL cache read/write/expire
    ├── ArchiveProxy.php    # Archive.org API client with retries
    ├── install.php         # Database setup script (run once)
    └── routes/
        ├── search.php      # GET /api/search (cached proxy)
        ├── shows.php       # GET /api/shows/:id (cached proxy)
        ├── auth.php        # Auth endpoints (register, login, logout)
        ├── favorites.php   # CRUD /api/favorites
        ├── collections.php # CRUD /api/collections
        └── admin.php       # Admin API endpoints
```

## Installation

### cPanel Setup (Recommended)

This is designed for cPanel hosting. No Node.js, no Composer, no SSH required.

**1. Create a MySQL Database** in cPanel > MySQL Databases:
   - Create a database (e.g., `youruser_tapefinder`)
   - Create a database user with a strong password
   - **Add the user to the database** with All Privileges

**2. Upload Files** via cPanel File Manager or FTP:
   - Upload everything to your `public_html` directory

**3. Configure the backend:**
   - In File Manager, navigate to `public_html/api/`
   - Copy `config.example.php` to `config.php`
   - Edit `config.php` and fill in your database credentials:

```php
'db' => [
    'host'     => 'localhost',
    'name'     => 'youruser_tapefinder',  // your cPanel DB name
    'user'     => 'youruser_dbuser',      // your cPanel DB user
    'password' => 'your_password',
],
```

**4. Run the installer** -- choose one method:

   - **Browser:** Visit `https://yourdomain.com/api/install.php`
   - **cPanel Terminal:** `cd ~/public_html/api && php install.php`

**5. Delete `install.php`** after setup (or rename it) for security.

**6. Test it:** Visit `https://yourdomain.com/api/health` (or `https://yourdomain.com/api/index.php?route=health` if rewrite rules are blocked) — you should see `{"status":"ok","database":"connected"}`.

That's it. Open your domain in a browser and start searching.

### Local Development

```bash
# Clone the repository
git clone https://github.com/morroware/Grateful-Dead-Tape-Finder.git
cd Grateful-Dead-Tape-Finder

# Set up the PHP backend
cd api
cp config.example.php config.php
# Edit config.php with your local MySQL credentials
php install.php

# Start a local PHP server
cd ..
php -S localhost:8000
```

Open `http://localhost:8000` in your browser.

### Static-Only Mode (No Backend)

The app works without the backend -- just serve the files from any static host. Search and playback use Archive.org directly. User accounts, favorites, collections, and caching won't be available.

```bash
python3 -m http.server 8000
# or
npx http-server -p 8000
```

## Database Schema

8 tables in MySQL (created automatically by `install.php`):

| Table | Purpose |
|-------|---------|
| `search_cache` | Cached Archive.org search result pages (6h TTL) |
| `shows` | Cached show metadata (24h TTL) |
| `show_tracks` | Track listings for cached shows |
| `users` | User accounts (bcrypt passwords) |
| `favorites` | User-to-show favorites with personal notes |
| `collections` | Named, shareable curated show lists |
| `collection_items` | Shows within collections (ordered) |

## API Endpoints

### Public (no auth)
- `GET /api/search?q=...&page=1&rows=50` -- Search with caching
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

## Configuration

### `api/config.php`

| Setting | Default | Description |
|---------|---------|-------------|
| `db.host` | localhost | MySQL host |
| `db.port` | 3306 | MySQL port |
| `db.name` | tapefinder | Database name |
| `db.user` | tapefinder | MySQL username |
| `db.password` | | MySQL password |
| `session.lifetime` | 30 days | Session cookie lifetime |
| `cache.search_ttl` | 21600 | Search cache lifetime in seconds (6h) |
| `cache.show_ttl` | 86400 | Show cache lifetime in seconds (24h) |

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

## Security

- All user-facing text is HTML-escaped to prevent XSS
- SQL queries use PDO prepared statements to prevent injection
- Passwords are hashed with bcrypt (12 rounds) via `password_hash()`
- Session cookies are httpOnly with secure flag on HTTPS
- Auth endpoints are rate-limited (20 requests per 15 minutes per IP)
- Internal PHP files are blocked from direct access via `.htaccess`
- Server directory and sensitive files (.env, .sql, .md) are blocked

## Requirements

### Server
- PHP 7.4+ with PDO, curl, and JSON extensions (standard on cPanel)
- MySQL 5.7+ or MariaDB 10.3+
- Apache with mod_rewrite (standard on cPanel)

### Browser
- ES6 module support
- Web Audio API
- HTML5 Audio
- Fetch API
- localStorage

**Tested on:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Node.js Backend (Alternative)

A Node.js/Express backend is also included in the `server/` directory for use outside cPanel. See `server/README.md` for details. The PHP backend is recommended for cPanel hosting.

## License

Share Ye Well License -- See licence.md

## Credits

- Archive.org for the etree collection and API
- Tailwind CSS for the utility framework
- The live music community for recording preservation
