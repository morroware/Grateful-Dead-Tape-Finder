<?php
/**
 * Archive.org API client with retry logic.
 */

class ArchiveProxy {

    private static function getBaseUrl() {
        $config = require __DIR__ . '/config.php';
        return $config['archive']['base_url'] ?? 'https://archive.org';
    }

    /**
     * Make an HTTP GET request with retries.
     */
    private static function fetch($url, $retries = 3) {
        $lastError = null;

        for ($attempt = 0; $attempt < $retries; $attempt++) {
            if ($attempt > 0) {
                usleep(500000 * $attempt); // 0.5s, 1s, 1.5s backoff
            }

            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT      => 'TapeFinder/1.0 (Live Music Archive Explorer)',
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($response !== false && $httpCode === 200) {
                return $response;
            }

            $lastError = $error ?: "HTTP $httpCode";
        }

        throw new Exception("Archive.org API request failed after $retries attempts: $lastError");
    }

    /**
     * Search the Archive.org Advanced Search API.
     * Returns ['results' => [...], 'total' => int].
     */
    public static function search($query, $page = 1, $rows = 50) {
        $baseUrl = self::getBaseUrl();
        $params = http_build_query([
            'q'      => $query,
            'fl'     => 'identifier,title,creator,date,year,venue,coverage,source,avg_rating,downloads',
            'sort'   => 'downloads desc',
            'rows'   => $rows,
            'page'   => $page,
            'output' => 'json',
        ]);

        $url = "$baseUrl/advancedsearch.php?$params";
        $response = self::fetch($url);
        $data = json_decode($response, true);

        if (!$data || !isset($data['response'])) {
            throw new Exception('Invalid response from Archive.org search API');
        }

        return [
            'results' => $data['response']['docs'] ?? [],
            'total'   => $data['response']['numFound'] ?? 0,
        ];
    }

    /**
     * Get metadata for a specific show/item.
     * Returns ['metadata' => [...], 'tracks' => [...]].
     */
    public static function getShowMetadata($identifier) {
        $baseUrl = self::getBaseUrl();
        $url = "$baseUrl/metadata/" . rawurlencode($identifier);
        $response = self::fetch($url);
        $data = json_decode($response, true);

        if (!$data || !isset($data['metadata'])) {
            throw new Exception("Show not found: $identifier");
        }

        $meta = $data['metadata'];
        $files = $data['files'] ?? [];

        // Extract metadata
        $metadata = [
            'identifier'  => $identifier,
            'title'       => is_array($meta['title'] ?? null) ? ($meta['title'][0] ?? '') : ($meta['title'] ?? ''),
            'creator'     => is_array($meta['creator'] ?? null) ? ($meta['creator'][0] ?? '') : ($meta['creator'] ?? ''),
            'date'        => is_array($meta['date'] ?? null) ? ($meta['date'][0] ?? '') : ($meta['date'] ?? ''),
            'venue'       => is_array($meta['venue'] ?? null) ? ($meta['venue'][0] ?? '') : ($meta['venue'] ?? ''),
            'coverage'    => is_array($meta['coverage'] ?? null) ? ($meta['coverage'][0] ?? '') : ($meta['coverage'] ?? ''),
            'source'      => is_array($meta['source'] ?? null) ? ($meta['source'][0] ?? '') : ($meta['source'] ?? ''),
            'lineage'     => is_array($meta['lineage'] ?? null) ? ($meta['lineage'][0] ?? '') : ($meta['lineage'] ?? ''),
            'taper'       => is_array($meta['taper'] ?? null) ? ($meta['taper'][0] ?? '') : ($meta['taper'] ?? ''),
            'description' => is_array($meta['description'] ?? null) ? ($meta['description'][0] ?? '') : ($meta['description'] ?? ''),
            'notes'       => is_array($meta['notes'] ?? null) ? ($meta['notes'][0] ?? '') : ($meta['notes'] ?? ''),
            'setlist'     => is_array($meta['setlist'] ?? null) ? implode("\n", $meta['setlist']) : ($meta['setlist'] ?? ''),
            'downloads'   => (int)($meta['downloads'] ?? 0),
            'avg_rating'  => isset($meta['avg_rating']) ? (float)$meta['avg_rating'] : null,
            'year'        => null,
        ];

        // Extract year from date
        $dateStr = $metadata['date'];
        if ($dateStr && preg_match('/(\d{4})/', $dateStr, $m)) {
            $metadata['year'] = (int)$m[1];
        }

        // Extract playable audio tracks
        $audioFormats = ['VBR MP3', 'MP3', '128Kbps MP3', '64Kbps MP3', 'Ogg Vorbis', 'Flac'];
        $tracks = [];
        $seenTitles = [];

        // Prefer MP3 files
        foreach ($files as $file) {
            $format = $file['format'] ?? '';
            if (!in_array($format, $audioFormats)) continue;

            $name = $file['name'] ?? '';
            // Skip derivative/metadata files
            if (preg_match('/^_/', $name)) continue;

            $title = $file['title'] ?? pathinfo($name, PATHINFO_FILENAME);
            // Clean up track title
            $title = preg_replace('/^(d\d+)?t\d+[\s._-]*/i', '', $title);
            $title = str_replace(['_', '-'], ' ', $title);
            $title = trim($title) ?: pathinfo($name, PATHINFO_FILENAME);

            // Prefer first format seen for each title
            $titleKey = strtolower($title);
            if (isset($seenTitles[$titleKey]) && stripos($format, 'mp3') === false) {
                continue;
            }
            $seenTitles[$titleKey] = true;

            $tracks[] = [
                'title'    => $title,
                'filename' => $name,
                'format'   => $format,
                'size'     => isset($file['size']) ? (int)$file['size'] : null,
                'duration' => $file['length'] ?? null,
            ];
        }

        // Sort by filename for proper track ordering
        usort($tracks, function ($a, $b) {
            return strnatcasecmp($a['filename'], $b['filename']);
        });

        return ['metadata' => $metadata, 'tracks' => $tracks];
    }
}
