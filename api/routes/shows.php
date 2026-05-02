<?php
/**
 * GET /api/shows/:identifier
 * Returns show metadata and track listing with caching.
 */

require_once __DIR__ . '/../CacheService.php';
require_once __DIR__ . '/../ArchiveProxy.php';

if ($method !== 'GET') jsonError('Method not allowed', 405);

checkRateLimit('shows', 120, 60);

$identifier = $subRoute;
if (empty($identifier)) {
    jsonError('Show identifier is required');
}

// Validate identifier format to prevent SSRF / path traversal
if (!validateIdentifier($identifier)) {
    jsonError('Invalid show identifier', 400);
}

// Check cache
$cached = CacheService::getShowCache($identifier);
if ($cached) {
    jsonResponse([
        'metadata' => $cached['metadata'],
        'tracks'   => $cached['tracks'],
        'cached'   => true,
    ]);
}

// Fetch from Archive.org
$data = ArchiveProxy::getShowMetadata($identifier);

// Store in cache
try {
    CacheService::setShowCache($identifier, $data['metadata'], $data['tracks']);
} catch (Exception $e) {
    error_log('Cache write error: ' . $e->getMessage());
}

jsonResponse([
    'metadata' => $data['metadata'],
    'tracks'   => $data['tracks'],
    'cached'   => false,
]);
