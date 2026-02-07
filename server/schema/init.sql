-- Tape Finder Database Schema
-- Run this to initialize the database

CREATE DATABASE IF NOT EXISTS tapefinder
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tapefinder;

-- ============================================================
-- CACHE TABLES
-- ============================================================

-- Cached search result pages
CREATE TABLE IF NOT EXISTS search_cache (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    query_hash      CHAR(64) NOT NULL,
    query_text      TEXT NOT NULL,
    page            INT UNSIGNED NOT NULL,
    total_results   INT UNSIGNED NOT NULL,
    results_json    JSON NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL,

    UNIQUE KEY uq_query_page (query_hash, page),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cached show metadata
CREATE TABLE IF NOT EXISTS shows (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    identifier      VARCHAR(255) NOT NULL UNIQUE,
    title           VARCHAR(500),
    creator         VARCHAR(500),
    date            VARCHAR(50),
    year            SMALLINT UNSIGNED,
    venue           VARCHAR(500),
    coverage        VARCHAR(500),
    source          TEXT,
    lineage         TEXT,
    taper           VARCHAR(500),
    description     MEDIUMTEXT,
    notes           MEDIUMTEXT,
    setlist         MEDIUMTEXT,
    downloads       INT UNSIGNED DEFAULT 0,
    avg_rating      DECIMAL(3,2),
    raw_metadata    JSON,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at      TIMESTAMP NOT NULL,

    INDEX idx_creator (creator(100)),
    INDEX idx_year (year),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cached track listings
CREATE TABLE IF NOT EXISTS show_tracks (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- USER TABLES
-- ============================================================

-- User accounts
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   CHAR(60) NOT NULL,
    display_name    VARCHAR(100),
    is_admin        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP NULL,

    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User favorites
CREATE TABLE IF NOT EXISTS favorites (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    identifier      VARCHAR(255) NOT NULL,
    title           VARCHAR(500),
    creator         VARCHAR(500),
    date            VARCHAR(50),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_show (user_id, identifier),
    INDEX idx_user (user_id),
    INDEX idx_identifier (identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Named collections (shareable)
CREATE TABLE IF NOT EXISTS collections (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    is_public       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items within collections
CREATE TABLE IF NOT EXISTS collection_items (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    collection_id   BIGINT UNSIGNED NOT NULL,
    identifier      VARCHAR(255) NOT NULL,
    title           VARCHAR(500),
    creator         VARCHAR(500),
    position        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE KEY uq_collection_show (collection_id, identifier),
    INDEX idx_collection (collection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SESSION TABLE (for express-mysql-session)
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) NOT NULL PRIMARY KEY,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT,
    INDEX idx_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
