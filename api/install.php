<?php
/**
 * Tape Finder — Database Setup Script
 *
 * Run from the terminal to create tables and an admin user:
 *
 *   cd api/
 *   cp config.example.php config.php   # then edit with your DB credentials
 *   php install.php
 *
 * Or run from cPanel Terminal:
 *   cd ~/public_html/api && php install.php
 *
 * Can also be run from a browser (one-time), then delete or rename this file.
 */

// Allow both CLI and web execution
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
}

function out($msg) {
    echo $msg . "\n";
}

out('');
out('  ╔══════════════════════════════════════════╗');
out('  ║   Live Music Archive — Tape Finder        ║');
out('  ║   PHP Backend Setup                       ║');
out('  ╚══════════════════════════════════════════╝');
out('');

// Check for config file
$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    out('  ERROR: config.php not found.');
    out('');
    out('  Run these commands first:');
    out('    cp config.example.php config.php');
    out('    nano config.php   # or vi, or edit in cPanel File Manager');
    out('');
    out('  Fill in your MySQL database credentials, then run this script again.');
    exit(1);
}

$config = require $configPath;
$db = $config['db'];

out("  Database: {$db['name']}@{$db['host']}:{$db['port']}");
out("  User:     {$db['user']}");
out('');

// Connect to MySQL
try {
    $pdo = new PDO(
        "mysql:host={$db['host']};port={$db['port']};charset=utf8mb4",
        $db['user'],
        $db['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    out('  Connected to MySQL server.');
} catch (PDOException $e) {
    out('  ERROR: Could not connect to MySQL.');
    out('  ' . $e->getMessage());
    out('');
    out('  Check your config.php credentials.');
    out('  On cPanel, make sure the database user has been added to the database');
    out('  with All Privileges (cPanel > MySQL Databases > Add User to Database).');
    exit(1);
}

// Create database if it doesn't exist
try {
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$db['name']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    out("  Database \"{$db['name']}\" ready.");
} catch (PDOException $e) {
    out("  Note: Could not create database (may already exist): {$e->getMessage()}");
    out("  On cPanel, create the database first via cPanel > MySQL Databases.");
}

$pdo->exec("USE `{$db['name']}`");

// Create tables
out('  Creating tables...');

$tables = [
    // Search cache
    "CREATE TABLE IF NOT EXISTS search_cache (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // Shows cache
    "CREATE TABLE IF NOT EXISTS shows (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // Show tracks
    "CREATE TABLE IF NOT EXISTS show_tracks (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // Users
    "CREATE TABLE IF NOT EXISTS users (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // Favorites
    "CREATE TABLE IF NOT EXISTS favorites (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // Collections
    "CREATE TABLE IF NOT EXISTS collections (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

    // Collection items
    "CREATE TABLE IF NOT EXISTS collection_items (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
];

foreach ($tables as $sql) {
    try {
        $pdo->exec($sql);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'already exists') === false) {
            out("  Warning: {$e->getMessage()}");
        }
    }
}

out('  Tables created successfully.');

// Create admin user
$admin = $config['admin'];
out('');
out("  Creating admin user \"{$admin['username']}\"...");

$hash = password_hash($admin['password'], PASSWORD_BCRYPT, ['cost' => 12]);

try {
    $stmt = $pdo->prepare(
        "INSERT INTO users (username, email, password_hash, display_name, is_admin)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE is_admin = TRUE, password_hash = VALUES(password_hash)"
    );
    $stmt->execute([$admin['username'], $admin['email'], $hash, $admin['username']]);
    out("  Admin user \"{$admin['username']}\" ready.");
} catch (PDOException $e) {
    out("  Admin user: {$e->getMessage()}");
}

out('');
out('  ╔══════════════════════════════════════════╗');
out('  ║   Setup Complete!                         ║');
out('  ╚══════════════════════════════════════════╝');
out('');
out('  Your PHP backend is ready. Test it by visiting:');
out('    https://yourdomain.com/api/health');
out('');
out('  Admin login:');
out("    Email:    {$admin['email']}");
out("    Password: {$admin['password']}");
out('');
out('  IMPORTANT: Delete or rename install.php after setup!');
out('');
