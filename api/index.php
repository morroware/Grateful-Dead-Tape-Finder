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

// Prefer explicit query param routing to avoid PATH_INFO restrictions.
$routeParam = $_GET['route'] ?? $_GET['path'] ?? null;

// Prefer PATH_INFO (works without mod_rewrite: /api/index.php/search)
// Fall back to parsing REQUEST_URI for clean URLs (/api/search)
if (!empty($routeParam)) {
    $path = trim($routeParam, '/');
} elseif (!empty($_SERVER['PATH_INFO'])) {
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

// Check that config.php exists before dispatching database-dependent routes
$configExists = file_exists(__DIR__ . '/config.php');

// Dispatch to route handlers
try {
    switch ($route) {
        case 'search':
            if (!$configExists) jsonError('Backend not configured — run install first', 503);
            require __DIR__ . '/routes/search.php';
            break;

        case 'shows':
            if (!$configExists) jsonError('Backend not configured — run install first', 503);
            require __DIR__ . '/routes/shows.php';
            break;

        case 'auth':
            if (!$configExists) jsonError('Backend not configured — run install first', 503);
            require __DIR__ . '/routes/auth.php';
            break;

        case 'favorites':
            if (!$configExists) jsonError('Backend not configured — run install first', 503);
            require __DIR__ . '/routes/favorites.php';
            break;

        case 'collections':
            if (!$configExists) jsonError('Backend not configured — run install first', 503);
            require __DIR__ . '/routes/collections.php';
            break;

        case 'admin':
            if (!$configExists) jsonError('Backend not configured — run install first', 503);
            require __DIR__ . '/routes/admin.php';
            break;

        case 'health':
            if (!$configExists) {
                jsonResponse(['status' => 'error', 'database' => 'not configured', 'message' => 'config.php missing — run install'], 503);
            }
            try {
                Database::get();
                jsonResponse(['status' => 'ok', 'database' => 'connected']);
            } catch (\Throwable $e) {
                jsonResponse(['status' => 'error', 'database' => 'disconnected', 'message' => $e->getMessage()], 503);
            }
            break;

        default:
            jsonError('Not found', 404);
    }
} catch (PDOException $e) {
    error_log('Database error: ' . $e->getMessage());
    jsonError('Database error', 500);
} catch (\Throwable $e) {
    error_log('Server error: ' . $e->getMessage());
    jsonError($e->getMessage(), 500);
}
