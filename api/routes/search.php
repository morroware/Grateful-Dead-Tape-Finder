<?php
/**
 * GET /api/search?q=...&page=1&rows=50
 * Proxies Archive.org search with MySQL caching.
 */

require_once __DIR__ . '/../CacheService.php';
require_once __DIR__ . '/../ArchiveProxy.php';

if ($method !== 'GET') jsonError('Method not allowed', 405);

$query = trim($_GET['q'] ?? '');
$page  = max(1, (int)($_GET['page'] ?? 1));
$rows  = min(100, max(1, (int)($_GET['rows'] ?? 50)));

if (empty($query)) {
    jsonError('Search query is required');
}

// Check cache
$queryHash = hash('sha256', $query . ":rows=$rows");
$cached = CacheService::getSearchCache($queryHash, $page);

if ($cached) {
    jsonResponse([
        'results' => $cached['results'],
        'total'   => $cached['total_results'],
        'page'    => $page,
        'cached'  => true,
    ]);
}

// Fetch from Archive.org
$data = ArchiveProxy::search($query, $page, $rows);

// Store in cache
try {
    CacheService::setSearchCache($queryHash, $query, $page, $data['total'], $data['results']);
} catch (Exception $e) {
    error_log('Cache write error: ' . $e->getMessage());
}

jsonResponse([
    'results' => $data['results'],
    'total'   => $data['total'],
    'page'    => $page,
    'cached'  => false,
]);
