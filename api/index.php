<?php
/**
 * API Router — dispatches requests to route handlers.
 *
 * All /api/* requests are rewritten here by .htaccess.
 */

require_once __DIR__ . '/helpers.php';

// Handle CORS preflight
handleCors();

// Parse the request
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip /api/ prefix (handles both /api/search and bare /search if .htaccess strips it)
$path = preg_replace('#^.*/api/#', '', $uri);
$path = trim($path, '/');
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
