<?php
/**
 * Tape Finder Configuration
 *
 * Copy this file to config.php and fill in your credentials:
 *   cp config.example.php config.php
 *
 * For cPanel:
 *   - Database names are usually prefixed: youruser_tapefinder
 *   - Database users are usually prefixed: youruser_tapefinder
 *   - Find credentials in cPanel > MySQL Databases
 */
return [
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'name'     => 'tapefinder',        // cPanel: youruser_tapefinder
        'user'     => 'tapefinder',        // cPanel: youruser_dbuser
        'password' => 'your_password_here',
    ],

    'session' => [
        'name'     => 'tapefinder_sid',
        'lifetime' => 30 * 24 * 60 * 60,  // 30 days
    ],

    'cache' => [
        'search_ttl' => 21600,             // 6 hours
        'show_ttl'   => 86400,             // 24 hours
    ],

    'archive' => [
        'base_url' => 'https://archive.org',
    ],

    // Cross-origin sharing.
    // The frontend is served from the same origin as the API by default, so
    // leave this empty. If you serve the frontend from a different host, list
    // the exact origins allowed (scheme + host + optional port). Wildcards are
    // intentionally not supported because credentialed CORS forbids them.
    'cors' => [
        'allowed_origins' => [],  // e.g. ['https://gratefuldeadparkinglots.com']
    ],

    // Only used by install.php to create the first admin user
    'admin' => [
        'username' => 'admin',
        'email'    => 'admin@example.com',
        'password' => 'change_this_password',
    ],
];
