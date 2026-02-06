# Implementation Plan: Caching, MySQL Database & Optional User Accounts

## Current State Analysis

### What exists today
The Grateful Dead Tape Finder is a **pure static frontend** application with zero backend infrastructure:

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, Tailwind CSS (CDN)
- **Data source**: Archive.org Advanced Search API (`archive.org/advancedsearch.php`) and Metadata API (`archive.org/metadata/{id}`)
- **Storage**: Browser `localStorage` only — stores last 5 recently viewed shows, selected band, and view mode preference
- **Authentication**: None. Completely anonymous usage
- **Hosting**: Static file server (GitHub Pages, Netlify, etc.)

### What it does
1. **Search page** (`index.html`): Queries Archive.org for live concert recordings across 40+ artists. Supports text search, year ranges, quality filters (SBD/AUD/Matrix/Top Rated), pagination (10/page), and three view modes
2. **Player page** (`player.html?id={identifier}`): Fetches show metadata from Archive.org, builds an MP3 playlist, streams audio with Web Audio API visualization, keyboard controls, shuffle/loop, and social sharing meta tags

### Key data flows to intercept
| Action | Current Source | Data |
|--------|---------------|------|
| Search results | `archive.org/advancedsearch.php?q=...` | identifier, title, year, venue, coverage, downloads, source, creator, date, avg_rating |
| Show metadata | `archive.org/metadata/{id}` | Full metadata + file listing (titles, formats, sizes) |
| Audio streaming | `archive.org/download/{id}/{file}` | MP3 binary (pass-through, do NOT cache) |

---

## Architecture Overview

### Design principles
1. **Non-breaking**: The app must work identically for anonymous users. No account required for any existing functionality
2. **Cache-transparent**: The frontend calls our backend API, which either serves from MySQL cache or proxies to Archive.org and caches the response
3. **Graceful degradation**: If the backend is unreachable, the frontend falls back to direct Archive.org calls (preserving the current behavior)
4. **Minimal footprint**: Express.js backend, single MySQL database, no Redis or external cache services — keep it simple and deployable

### System diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Frontend)                                         │
│                                                             │
│  index.html ──→ js/api.js ──→ Backend API ──→ MySQL Cache  │
│  player.html ──→ js/api.js ──→ Backend API ──→ MySQL Cache │
│                       │                            │        │
│                       │ (fallback if backend down) │        │
│                       └──→ Archive.org directly    │        │
│                                                    │        │
│  Auth UI (login/register/profile) ──→ Backend API  │        │
│  Favorites UI ──→ Backend API ──→ MySQL             │        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Backend (Node.js + Express)                                │
│                                                             │
│  /api/search       → check cache → proxy to Archive.org    │
│  /api/shows/:id    → check cache → proxy to Archive.org    │
│  /api/auth/*       → user registration, login, sessions    │
│  /api/favorites/*  → CRUD user favorites                   │
│  /api/collections/*→ CRUD user collections (shareable)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MySQL Database                                             │
│                                                             │
│  search_cache      → cached search result pages             │
│  shows             → cached show metadata                   │
│  show_tracks       → cached track listings per show         │
│  users             → optional user accounts                 │
│  favorites         → user ↔ show relationships              │
│  collections       → named groups of favorites (shareable)  │
│  collection_items  → shows within a collection              │
└─────────────────────────────────────────────────────────────┘
```

---

## MySQL Database Schema

### Table: `search_cache`
Caches Archive.org search result pages. Keyed by a hash of the full query string so identical searches hit cache.

```sql
CREATE TABLE search_cache (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    query_hash      CHAR(64) NOT NULL,          -- SHA-256 of the full query URL
    query_text      TEXT NOT NULL,               -- human-readable query for debugging
    page            INT UNSIGNED NOT NULL,       -- page number
    total_results   INT UNSIGNED NOT NULL,       -- numFound from Archive.org
    results_json    JSON NOT NULL,               -- the docs array verbatim
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL,          -- created_at + TTL

    UNIQUE KEY uq_query_page (query_hash, page),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**TTL strategy**: Search results expire after **6 hours**. Archive.org data changes infrequently (new tapes uploaded occasionally), but download counts and ratings shift, so 6 hours balances freshness with reduced API load.

### Table: `shows`
Caches full show metadata. One row per Archive.org identifier.

```sql
CREATE TABLE shows (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifier      VARCHAR(255) NOT NULL UNIQUE, -- Archive.org identifier
    title           VARCHAR(500),
    creator         VARCHAR(500),
    date            VARCHAR(50),
    year            SMALLINT UNSIGNED,
    venue           VARCHAR(500),
    coverage        VARCHAR(500),
    source          TEXT,
    lineage         TEXT,
    taper           VARCHAR(500),
    description     TEXT,
    notes           TEXT,
    setlist         TEXT,
    downloads       INT UNSIGNED DEFAULT 0,
    avg_rating      DECIMAL(3,2),
    raw_metadata    JSON,                        -- full Archive.org metadata blob
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL,          -- created_at + TTL

    INDEX idx_creator (creator(100)),
    INDEX idx_year (year),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**TTL strategy**: Show metadata expires after **24 hours**. Metadata rarely changes, and the file listing is essentially static once uploaded.

### Table: `show_tracks`
Caches the parsed track listing for each show.

```sql
CREATE TABLE show_tracks (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    show_id         BIGINT UNSIGNED NOT NULL,
    track_number    SMALLINT UNSIGNED NOT NULL,
    title           VARCHAR(500) NOT NULL,
    filename        VARCHAR(1000) NOT NULL,
    format          VARCHAR(50),
    size            BIGINT UNSIGNED,
    duration        VARCHAR(20),

    FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE,
    INDEX idx_show (show_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Table: `users`
Optional accounts. Passwords hashed with bcrypt.

```sql
CREATE TABLE users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   CHAR(60) NOT NULL,           -- bcrypt output
    display_name    VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP NULL,

    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Table: `favorites`
Simple many-to-many between users and shows. When a user favorites a show, if that show hasn't been cached yet, we cache it at that moment.

```sql
CREATE TABLE favorites (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    identifier      VARCHAR(255) NOT NULL,       -- Archive.org identifier
    title           VARCHAR(500),                -- denormalized for quick display
    creator         VARCHAR(500),                -- denormalized
    date            VARCHAR(50),                 -- denormalized
    notes           TEXT,                        -- user's personal notes
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_show (user_id, identifier),
    INDEX idx_user (user_id),
    INDEX idx_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Table: `collections`
User-curated named lists of shows. Each collection gets a shareable URL slug.

```sql
CREATE TABLE collections (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    slug            VARCHAR(100) NOT NULL UNIQUE, -- shareable URL path
    is_public       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Table: `collection_items`
Shows within a collection, with ordering.

```sql
CREATE TABLE collection_items (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    collection_id   BIGINT UNSIGNED NOT NULL,
    identifier      VARCHAR(255) NOT NULL,       -- Archive.org identifier
    title           VARCHAR(500),
    creator         VARCHAR(500),
    position        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE KEY uq_collection_show (collection_id, identifier),
    INDEX idx_collection (collection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Backend API Design

### Technology choices
- **Runtime**: Node.js (keeps the project in a single language ecosystem)
- **Framework**: Express.js (minimal, well-understood, matches project's no-framework philosophy)
- **MySQL client**: `mysql2/promise` (native promises, prepared statements)
- **Auth**: `bcrypt` for password hashing, `express-session` with `express-mysql-session` for session storage (cookie-based, no JWT complexity)
- **Validation**: `express-validator` for input sanitization
- **CORS**: `cors` middleware (configured for the frontend origin)

### Directory structure

```
server/
├── index.js                 # Express app entry point
├── config/
│   └── database.js          # MySQL connection pool setup
├── middleware/
│   ├── auth.js              # Session authentication middleware
│   └── cache.js             # Cache-check middleware
├── routes/
│   ├── search.js            # GET /api/search
│   ├── shows.js             # GET /api/shows/:identifier
│   ├── auth.js              # POST /api/auth/register, /login, /logout, /me
│   ├── favorites.js         # GET/POST/DELETE /api/favorites
│   └── collections.js       # CRUD /api/collections
├── services/
│   ├── archiveProxy.js      # Fetches from Archive.org and caches
│   └── cacheService.js      # Cache read/write/expire logic
├── schema/
│   └── init.sql             # Full database schema
├── package.json
└── .env.example
```

### API endpoints

#### Caching endpoints (public, no auth required)

**`GET /api/search`**
Proxies and caches Archive.org search results.

```
Query params (pass-through from frontend):
  q        - full query string
  page     - page number
  rows     - results per page (default 10)
  sort     - sort field

Response: { results: [...], total: N, page: N, cached: bool }

Logic:
  1. Compute SHA-256 hash of normalized query + page
  2. Check search_cache for non-expired row matching (query_hash, page)
  3. If HIT: return cached results_json, total_results
  4. If MISS: fetch from Archive.org, store in search_cache, return
```

**`GET /api/shows/:identifier`**
Proxies and caches Archive.org show metadata.

```
Response: { metadata: {...}, tracks: [...], cached: bool }

Logic:
  1. Check shows table for non-expired row matching identifier
  2. If HIT: return cached metadata + tracks from show_tracks
  3. If MISS: fetch from Archive.org /metadata/{id}, parse:
     - Store metadata fields in shows table
     - Parse MP3 files, filter 64kb, prefer VBR → store in show_tracks
     - Return full response
```

#### Auth endpoints

**`POST /api/auth/register`**
```
Body: { username, email, password }
Validation:
  - username: 3-50 chars, alphanumeric + underscores
  - email: valid email format
  - password: minimum 8 chars
Response: { user: { id, username, email, display_name } }
Sets session cookie.
```

**`POST /api/auth/login`**
```
Body: { email, password }
Response: { user: { id, username, email, display_name } }
Sets session cookie.
```

**`POST /api/auth/logout`**
```
Destroys session. Clears cookie.
Response: { success: true }
```

**`GET /api/auth/me`**
```
Returns current session user, or 401 if not logged in.
Response: { user: { id, username, email, display_name } } | { user: null }
```

#### Favorites endpoints (auth required)

**`GET /api/favorites`**
```
Returns all favorites for the authenticated user.
Response: { favorites: [{ identifier, title, creator, date, notes, created_at }] }
```

**`POST /api/favorites`**
```
Body: { identifier, title?, creator?, date?, notes? }
Adds a show to user's favorites.
Response: { favorite: { id, identifier, title, ... } }
```

**`DELETE /api/favorites/:identifier`**
```
Removes a show from user's favorites.
Response: { success: true }
```

#### Collections endpoints (auth required for write, public read for public collections)

**`GET /api/collections`**
```
Auth required. Returns all collections owned by user.
Response: { collections: [{ id, name, description, slug, is_public, item_count }] }
```

**`POST /api/collections`**
```
Auth required. Creates a new collection.
Body: { name, description?, is_public? }
Auto-generates slug from name.
Response: { collection: { id, name, slug, ... } }
```

**`GET /api/collections/:slug`**
```
Public if collection is_public. Auth required otherwise.
Response: { collection: { name, description, owner }, items: [...] }
```

**`POST /api/collections/:slug/items`**
```
Auth required (owner only). Adds a show to the collection.
Body: { identifier, title?, creator? }
Response: { item: { id, identifier, title, position } }
```

**`DELETE /api/collections/:slug/items/:identifier`**
```
Auth required (owner only). Removes a show from the collection.
Response: { success: true }
```

---

## Caching Strategy

### How caching works end-to-end

1. **Frontend calls backend** instead of Archive.org directly
2. **Backend checks MySQL** for a cached, non-expired result
3. **Cache HIT**: Return cached data immediately (fast, no external call)
4. **Cache MISS**: Proxy request to Archive.org, store response in MySQL, return to frontend
5. **Background cleanup**: A scheduled job runs every hour to `DELETE FROM search_cache WHERE expires_at < NOW()` and similarly for shows

### TTL values
| Data type | TTL | Rationale |
|-----------|-----|-----------|
| Search results | 6 hours | Download counts and ratings change; new shows get uploaded |
| Show metadata | 24 hours | Metadata is nearly immutable once a show is uploaded |
| Show tracks | 24 hours | Same as metadata — track listings don't change |

### Cache key strategy
- **Search cache key**: SHA-256 of the full normalized query URL (sorted params, lowercased). This means identical searches from different users share the same cache entry
- **Show cache key**: The Archive.org `identifier` string directly (it's already unique)

### What we do NOT cache
- **Audio files**: MP3 streaming stays direct from `archive.org/download/`. Audio files are large binary blobs that would bloat the database and provide minimal benefit since Archive.org's CDN is already optimized for this
- **User-specific data**: Favorites and collections are user data, not cache. They don't expire

### Fallback behavior
The frontend `api.js` module wraps every backend call in a try-catch. If the backend is unreachable (network error, 5xx), it falls back to calling Archive.org directly — exactly as the app works today. This means:
- Deploying the backend is an enhancement, not a requirement
- If the backend goes down, the app still works (just without caching, accounts, or favorites)

---

## Frontend Changes

### New files

```
js/
├── api.js              # API abstraction layer (backend with Archive.org fallback)
├── auth.js             # Login/register/logout UI logic
└── favorites.js        # Favorites and collections UI logic
```

### New HTML pages

```
login.html              # Login / Register page
profile.html            # User profile, favorites, collections management
collection.html         # Public collection view page
```

### Changes to existing files

#### `js/api.js` (new — central API layer)
This is the key architectural piece. Every data fetch goes through this module.

```javascript
// Pseudocode structure
const API_BASE = '/api';

async function apiCall(endpoint, options) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn('Backend unavailable, falling back to Archive.org');
        return null; // caller handles fallback
    }
}

// Search: tries backend first, falls back to direct Archive.org
export async function searchShows(queryParams) {
    const result = await apiCall(`/search?${queryParams}`);
    if (result) return result;
    // Fallback: direct Archive.org call (existing logic)
    return await directArchiveSearch(queryParams);
}

// Show metadata: tries backend first, falls back to direct Archive.org
export async function getShowMetadata(identifier) {
    const result = await apiCall(`/shows/${identifier}`);
    if (result) return result;
    // Fallback: direct Archive.org call (existing logic)
    return await directArchiveMetadata(identifier);
}
```

#### `js/search.js` (modified)
- Replace direct `fetch` to `archive.org/advancedsearch.php` with a call to `api.searchShows()`
- No other changes to search logic, filtering, pagination, or UI rendering

#### `js/player.js` (modified)
- Replace direct `fetch` to `archive.org/metadata/{id}` with a call to `api.getShowMetadata()`
- Audio streaming URLs remain direct Archive.org links (no change)
- Add a "Favorite" heart button in the player UI (only visible when logged in)

#### `js/main.js` (modified)
- On app load, call `GET /api/auth/me` to check if user has an active session
- If logged in, show user avatar/name in header and enable favorites UI
- If not logged in, show "Sign In" link in header (non-intrusive)
- Add routing for new pages (login.html, profile.html, collection.html)

#### `index.html` (modified)
- Add a user area to the header: either "Sign In" link or user dropdown with avatar
- No changes to search UI itself — it works exactly the same

#### `player.html` (modified)
- Add a "Favorite" heart icon button next to the show title
- Add an "Add to Collection" dropdown (only when logged in)
- Both buttons hidden when not logged in — the player is unchanged for anonymous users

### UI/UX for accounts

The account system is intentionally **unobtrusive**:

1. **Header**: A small "Sign In" text link in the top-right corner. When logged in, it shows the username with a dropdown for Profile/Favorites/Sign Out
2. **No gate**: Nothing in the app requires an account. Search, browse, play — all work anonymously
3. **Prompted naturally**: When an anonymous user clicks the heart icon to favorite a show, a gentle tooltip says "Sign in to save favorites" with a link. No modal, no blocking popup
4. **Registration**: Simple form — username, email, password. No email verification for v1 (keep it simple)
5. **Profile page**: Shows favorites list and collections. Each collection has a "Copy Share Link" button

---

## Implementation Phases

### Phase 1: Backend foundation + MySQL schema
**Files created:**
- `server/` directory with all files
- `server/schema/init.sql` with full schema
- `server/config/database.js` with connection pool
- `server/index.js` with Express app setup
- `server/package.json` with dependencies
- `.env.example` with required environment variables

**What it does:**
- Express server starts and connects to MySQL
- Database tables created via init script
- CORS configured for frontend origin
- Session middleware configured with MySQL session store

### Phase 2: Caching layer
**Files created:**
- `server/services/cacheService.js`
- `server/services/archiveProxy.js`
- `server/routes/search.js`
- `server/routes/shows.js`
- `server/middleware/cache.js`

**What it does:**
- `GET /api/search` proxies Archive.org with MySQL caching
- `GET /api/shows/:id` proxies Archive.org metadata with MySQL caching
- Background cleanup of expired cache entries
- Cache hit/miss logging

**Frontend changes:**
- Create `js/api.js` with backend-first, Archive.org-fallback pattern
- Modify `js/search.js` to use `api.searchShows()`
- Modify `js/player.js` to use `api.getShowMetadata()`

### Phase 3: User authentication
**Files created:**
- `server/routes/auth.js`
- `server/middleware/auth.js`
- `js/auth.js`
- `login.html`

**What it does:**
- Registration with bcrypt password hashing
- Login with session cookie
- Logout
- `GET /api/auth/me` session check
- Frontend login/register forms
- Header updates to show auth state

### Phase 4: Favorites
**Files created:**
- `server/routes/favorites.js`
- `js/favorites.js`
- `profile.html`

**What it does:**
- Add/remove favorites via API
- Heart icon on player page (logged-in users)
- Heart icon on search result cards (logged-in users)
- Profile page showing all favorites
- Personal notes on each favorite

### Phase 5: Shareable collections
**Files created:**
- `server/routes/collections.js`
- `collection.html`

**What it does:**
- Create named collections
- Add/remove/reorder shows within collections
- Public collections accessible via `/collection.html?slug=my-dead-picks`
- "Copy Share Link" button
- Collection management on profile page

---

## Backend Dependencies

```json
{
  "dependencies": {
    "express": "^4.18",
    "mysql2": "^3.6",
    "express-session": "^1.17",
    "express-mysql-session": "^3.0",
    "bcrypt": "^5.1",
    "express-validator": "^7.0",
    "cors": "^2.8",
    "dotenv": "^16.3",
    "node-fetch": "^3.3",
    "crypto": "(built-in)"
  },
  "devDependencies": {
    "nodemon": "^3.0"
  }
}
```

## Environment Variables

```env
# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=tapefinder
DB_PASSWORD=
DB_NAME=tapefinder

# Session
SESSION_SECRET=<random-64-char-string>

# Server
PORT=3001
FRONTEND_ORIGIN=http://localhost:8080

# Cache TTLs (seconds)
SEARCH_CACHE_TTL=21600      # 6 hours
SHOW_CACHE_TTL=86400         # 24 hours

# Archive.org (no API key needed, but rate limit settings)
ARCHIVE_API_BASE=https://archive.org
```

---

## Security Considerations

1. **SQL injection**: All queries use parameterized prepared statements via `mysql2`. Never string-concatenate user input into SQL
2. **XSS**: The frontend already generates HTML from API data. Any user-generated content (notes, collection names) must be HTML-escaped before rendering. Use `textContent` instead of `innerHTML` for user data
3. **CSRF**: `express-session` with `SameSite=Lax` cookies. Since we're using same-origin session cookies (not JWT in headers), CSRF is mitigated by default browser behavior
4. **Password storage**: bcrypt with cost factor 12. Passwords are never logged or returned in API responses
5. **Rate limiting**: Add `express-rate-limit` to auth endpoints (5 attempts per 15 minutes per IP) to prevent brute force
6. **Input validation**: `express-validator` on every endpoint. Username length, email format, password strength, identifier format (alphanumeric + hyphens only)
7. **Session management**: Sessions stored in MySQL (not memory). Session expiry set to 30 days. `httpOnly` and `secure` flags on cookies in production

---

## Key Design Decisions & Rationale

### Why MySQL and not SQLite/Redis?
- The requirement specifically asks for MySQL
- MySQL handles concurrent reads/writes well for a multi-user app
- Session storage plugin exists for Express + MySQL
- Full-text search capabilities available if needed later
- JSON column type for storing raw Archive.org responses without schema rigidity

### Why server-side sessions and not JWT?
- Simpler implementation for a cookie-based web app
- Sessions can be invalidated server-side (logout actually works)
- No token refresh complexity
- Session store in MySQL means sessions persist across server restarts
- The app is a traditional web app, not a mobile API — cookies are the natural fit

### Why a separate API layer (api.js) with fallback?
- Preserves the app's ability to work as a pure static site (backwards compatible)
- If someone deploys without the backend, everything still works
- Clean separation — search.js and player.js don't need to know about caching or auth
- Single place to swap between backend and direct Archive.org calls

### Why denormalize show info into favorites/collection_items?
- Avoids a JOIN on every favorites list render
- Show cache entries expire and get deleted — but a user's favorite should always display its title/date even if the cache is cold
- The denormalized fields are small (title, creator, date) and set once when favorited

### Why not cache audio files?
- A single show can have 20-40 MP3 files, each 5-50 MB
- That's 100MB-2GB per show in database storage
- Archive.org's CDN is already globally distributed and optimized for streaming
- The ROI on caching audio is near zero — the latency is in the metadata lookups, not the audio stream
