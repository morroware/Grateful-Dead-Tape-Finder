<?php
/**
 * MySQL-backed cache for Archive.org search results and show metadata.
 */

require_once __DIR__ . '/Database.php';

class CacheService {

    // ── Search Cache ──

    public static function getSearchCache($queryHash, $page) {
        $row = Database::queryOne(
            "SELECT results_json, total_results FROM search_cache
             WHERE query_hash = ? AND page = ? AND expires_at > NOW()",
            [$queryHash, $page]
        );
        if (!$row) return null;
        return [
            'results'       => json_decode($row['results_json'], true),
            'total_results' => (int)$row['total_results'],
        ];
    }

    public static function setSearchCache($queryHash, $queryText, $page, $totalResults, $results) {
        $config = require __DIR__ . '/config.php';
        $ttl = $config['cache']['search_ttl'];

        Database::query(
            "INSERT INTO search_cache (query_hash, query_text, page, total_results, results_json, expires_at)
             VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
             ON DUPLICATE KEY UPDATE
                results_json = VALUES(results_json),
                total_results = VALUES(total_results),
                expires_at = VALUES(expires_at)",
            [$queryHash, $queryText, $page, $totalResults, json_encode($results), $ttl]
        );
    }

    // ── Show Cache ──

    public static function getShowCache($identifier) {
        $show = Database::queryOne(
            "SELECT * FROM shows WHERE identifier = ? AND expires_at > NOW()",
            [$identifier]
        );
        if (!$show) return null;

        $tracks = Database::queryAll(
            "SELECT track_number, title, filename, format, size, duration
             FROM show_tracks WHERE show_id = ? ORDER BY track_number",
            [$show['id']]
        );

        $metadata = [
            'identifier'  => $show['identifier'],
            'title'       => $show['title'],
            'creator'     => $show['creator'],
            'date'        => $show['date'],
            'year'        => $show['year'],
            'venue'       => $show['venue'],
            'coverage'    => $show['coverage'],
            'source'      => $show['source'],
            'lineage'     => $show['lineage'],
            'taper'       => $show['taper'],
            'description' => $show['description'],
            'notes'       => $show['notes'],
            'setlist'     => $show['setlist'],
            'downloads'   => (int)$show['downloads'],
            'avg_rating'  => $show['avg_rating'] ? (float)$show['avg_rating'] : null,
        ];

        return ['metadata' => $metadata, 'tracks' => $tracks];
    }

    public static function setShowCache($identifier, $metadata, $tracks) {
        $config = require __DIR__ . '/config.php';
        $ttl = $config['cache']['show_ttl'];
        $pdo = Database::get();

        $pdo->beginTransaction();
        try {
            // Upsert show
            Database::query(
                "INSERT INTO shows (identifier, title, creator, date, year, venue, coverage,
                    source, lineage, taper, description, notes, setlist, downloads, avg_rating,
                    raw_metadata, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
                 ON DUPLICATE KEY UPDATE
                    title=VALUES(title), creator=VALUES(creator), date=VALUES(date),
                    year=VALUES(year), venue=VALUES(venue), coverage=VALUES(coverage),
                    source=VALUES(source), lineage=VALUES(lineage), taper=VALUES(taper),
                    description=VALUES(description), notes=VALUES(notes), setlist=VALUES(setlist),
                    downloads=VALUES(downloads), avg_rating=VALUES(avg_rating),
                    raw_metadata=VALUES(raw_metadata), expires_at=VALUES(expires_at)",
                [
                    $identifier,
                    $metadata['title'] ?? null,
                    $metadata['creator'] ?? null,
                    $metadata['date'] ?? null,
                    $metadata['year'] ?? null,
                    $metadata['venue'] ?? null,
                    $metadata['coverage'] ?? null,
                    $metadata['source'] ?? null,
                    $metadata['lineage'] ?? null,
                    $metadata['taper'] ?? null,
                    $metadata['description'] ?? null,
                    $metadata['notes'] ?? null,
                    $metadata['setlist'] ?? null,
                    $metadata['downloads'] ?? 0,
                    $metadata['avg_rating'] ?? null,
                    json_encode($metadata),
                    $ttl,
                ]
            );

            // Get the show ID
            $show = Database::queryOne("SELECT id FROM shows WHERE identifier = ?", [$identifier]);
            $showId = $show['id'];

            // Replace tracks
            Database::query("DELETE FROM show_tracks WHERE show_id = ?", [$showId]);

            if (!empty($tracks)) {
                $stmt = Database::get()->prepare(
                    "INSERT INTO show_tracks (show_id, track_number, title, filename, format, size, duration)
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                foreach ($tracks as $i => $track) {
                    $stmt->execute([
                        $showId,
                        $i + 1,
                        $track['title'] ?? $track['filename'] ?? "Track " . ($i + 1),
                        $track['filename'] ?? '',
                        $track['format'] ?? null,
                        $track['size'] ?? null,
                        $track['duration'] ?? null,
                    ]);
                }
            }

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ── Cache Cleanup ──

    public static function cleanExpired() {
        $searchDeleted = Database::execute("DELETE FROM search_cache WHERE expires_at < NOW()");

        // Get expired show IDs (tracks cascade-delete via FK)
        $expiredShows = Database::queryAll("SELECT id FROM shows WHERE expires_at < NOW()");
        $showsDeleted = 0;
        if (!empty($expiredShows)) {
            $ids = array_column($expiredShows, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $showsDeleted = Database::execute(
                "DELETE FROM shows WHERE id IN ($placeholders)",
                $ids
            );
        }

        return ['search_deleted' => $searchDeleted, 'shows_deleted' => $showsDeleted];
    }

    public static function purgeAll() {
        Database::query("DELETE FROM show_tracks");
        Database::query("DELETE FROM shows");
        Database::query("DELETE FROM search_cache");
    }

    public static function getStats() {
        $searchCount = Database::queryOne("SELECT COUNT(*) as cnt FROM search_cache")['cnt'];
        $showCount   = Database::queryOne("SELECT COUNT(*) as cnt FROM shows")['cnt'];
        $trackCount  = Database::queryOne("SELECT COUNT(*) as cnt FROM show_tracks")['cnt'];
        return [
            'search_entries' => (int)$searchCount,
            'shows_cached'   => (int)$showCount,
            'tracks_cached'  => (int)$trackCount,
        ];
    }
}
