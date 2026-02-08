<?php
/**
 * API Router — dispatches requests to route handlers.
 *
 * Supports two URL styles:
 *   1. Clean URLs via mod_rewrite:  /api/search  (if .htaccess rewrite works)
 *   2. PATH_INFO without rewrite:   /api/index.php/search  (always works)
 */

require_once __DIR__ . '/helpers.php';

// Handle CORS preflight
handleCors();

// Parse the request
$method = $_SERVER['REQUEST_METHOD'];

// Prefer PATH_INFO (works without mod_rewrite: /api/index.php/search)
// Fall back to parsing REQUEST_URI for clean URLs (/api/search)
if (!empty($_SERVER['PATH_INFO'])) {
    $path = trim($_SERVER['PATH_INFO'], '/');
} else {
    $uri  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = preg_replace('#^.*/api/#', '', $uri);
    $path = preg_replace('#^index\.php/?#', '', $path);
    $path = trim($path, '/');
}
$segments = $path ? explode('/', $path) : [];

$route    = $segments[0] ?? '';
$subRoute = $segments[1] ?? '';
$param3   = $segments[2] ?? '';
$param4   = $segments[3] ?? '';

// Dispatch to route handlers
try {
    switch ($route) {
        case 'search':
            require __DIR__ . '/routes/search.php';
            break;

        case 'shows':
            require __DIR__ . '/routes/shows.php';
            break;

        case 'auth':
            require __DIR__ . '/routes/auth.php';
            break;

        case 'favorites':
            require __DIR__ . '/routes/favorites.php';
            break;

        case 'collections':
            require __DIR__ . '/routes/collections.php';
            break;

        case 'admin':
            require __DIR__ . '/routes/admin.php';
            break;

        case 'health':
            try {
                Database::get();
                jsonResponse(['status' => 'ok', 'database' => 'connected']);
            } catch (Exception $e) {
                jsonResponse(['status' => 'error', 'database' => 'disconnected', 'message' => $e->getMessage()], 503);
            }
            break;

        default:
            jsonError('Not found', 404);
    }
} catch (PDOException $e) {
    error_log('Database error: ' . $e->getMessage());
    jsonError('Database error', 500);
} catch (Exception $e) {
    error_log('Server error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}
