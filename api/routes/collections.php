<?php
/**
 * Collections routes:
 *   GET    /api/collections               — list user's collections (auth)
 *   POST   /api/collections               — create collection (auth)
 *   GET    /api/collections/:slug         — view collection (public)
 *   PUT    /api/collections/:slug         — update collection (auth, owner)
 *   DELETE /api/collections/:slug         — delete collection (auth, owner)
 *   POST   /api/collections/:slug/items   — add item (auth, owner)
 *   DELETE /api/collections/:slug/items/:id — remove item (auth, owner)
 */

$slug = $subRoute;
$itemsAction = $param3;  // 'items' if managing items
$itemParam   = $param4;  // item identifier for delete

// ── Public route: GET /api/collections/:slug ──
if ($method === 'GET' && !empty($slug)) {
    $collection = Database::queryOne(
        "SELECT c.*, u.username as owner_name FROM collections c
         JOIN users u ON u.id = c.user_id
         WHERE c.slug = ?",
        [$slug]
    );

    if (!$collection) jsonError('Collection not found', 404);

    // Check access: public or owner
    startSession();
    $currentUserId = $_SESSION['user_id'] ?? null;
    if (!$collection['is_public'] && $collection['user_id'] != $currentUserId) {
        jsonError('Collection not found', 404);
    }

    $items = Database::queryAll(
        "SELECT identifier, title, creator, position, added_at
         FROM collection_items WHERE collection_id = ? ORDER BY position ASC, added_at ASC",
        [$collection['id']]
    );

    jsonResponse([
        'collection' => [
            'name'        => $collection['name'],
            'description' => $collection['description'],
            'slug'        => $collection['slug'],
            'is_public'   => (bool)$collection['is_public'],
            'owner'       => $collection['owner_name'],
            'created_at'  => $collection['created_at'],
        ],
        'items' => $items,
    ]);
}

// All other routes require auth
requireAuth();
$userId = $_SESSION['user_id'];

switch ($method) {

    case 'GET':
        // List user's collections
        $collections = Database::queryAll(
            "SELECT c.*, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) as item_count
             FROM collections c WHERE c.user_id = ? ORDER BY c.updated_at DESC",
            [$userId]
        );

        $result = array_map(function ($c) {
            return [
                'id'          => $c['id'],
                'name'        => $c['name'],
                'description' => $c['description'],
                'slug'        => $c['slug'],
                'is_public'   => (bool)$c['is_public'],
                'item_count'  => (int)$c['item_count'],
                'created_at'  => $c['created_at'],
                'updated_at'  => $c['updated_at'],
            ];
        }, $collections);

        jsonResponse(['collections' => $result]);
        break;

    case 'POST':
        if (!empty($slug) && $itemsAction === 'items') {
            // Add item to collection
            $collection = Database::queryOne(
                "SELECT id FROM collections WHERE slug = ? AND user_id = ?",
                [$slug, $userId]
            );
            if (!$collection) jsonError('Collection not found', 404);

            $body = getJsonBody();
            $identifier = trim($body['identifier'] ?? '');
            if (empty($identifier)) jsonError('Identifier is required');

            // Get next position
            $maxPos = Database::queryOne(
                "SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM collection_items WHERE collection_id = ?",
                [$collection['id']]
            );

            try {
                Database::query(
                    "INSERT INTO collection_items (collection_id, identifier, title, creator, position)
                     VALUES (?, ?, ?, ?, ?)",
                    [
                        $collection['id'],
                        $identifier,
                        $body['title'] ?? null,
                        $body['creator'] ?? null,
                        $maxPos['next_pos'],
                    ]
                );
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'Duplicate') !== false) {
                    jsonError('Show already in collection');
                }
                throw $e;
            }

            Database::query("UPDATE collections SET updated_at = NOW() WHERE id = ?", [$collection['id']]);

            jsonResponse(['message' => 'Item added to collection'], 201);
        }

        // Create collection
        $body = getJsonBody();
        $name = trim($body['name'] ?? '');
        if (empty($name) || strlen($name) > 200) {
            jsonError('Collection name is required (max 200 characters)');
        }

        $baseSlug = slugify($name);
        $slug = $baseSlug;
        $counter = 1;
        while (Database::queryOne("SELECT id FROM collections WHERE slug = ?", [$slug])) {
            $slug = $baseSlug . '-' . $counter++;
        }

        Database::query(
            "INSERT INTO collections (user_id, name, description, slug, is_public) VALUES (?, ?, ?, ?, ?)",
            [
                $userId,
                $name,
                $body['description'] ?? null,
                $slug,
                isset($body['is_public']) ? (bool)$body['is_public'] : true,
            ]
        );

        jsonResponse([
            'message' => 'Collection created',
            'slug'    => $slug,
            'id'      => Database::lastInsertId(),
        ], 201);
        break;

    case 'PUT':
        if (empty($slug)) jsonError('Collection slug is required');

        $collection = Database::queryOne(
            "SELECT id FROM collections WHERE slug = ? AND user_id = ?",
            [$slug, $userId]
        );
        if (!$collection) jsonError('Collection not found', 404);

        $body = getJsonBody();
        $updates = [];
        $params = [];

        if (isset($body['name'])) {
            $updates[] = 'name = ?';
            $params[] = trim($body['name']);
        }
        if (isset($body['description'])) {
            $updates[] = 'description = ?';
            $params[] = $body['description'];
        }
        if (isset($body['is_public'])) {
            $updates[] = 'is_public = ?';
            $params[] = (bool)$body['is_public'] ? 1 : 0;
        }

        if (empty($updates)) jsonError('No changes provided');

        $params[] = $collection['id'];
        Database::query(
            "UPDATE collections SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = ?",
            $params
        );

        jsonResponse(['message' => 'Collection updated']);
        break;

    case 'DELETE':
        if (empty($slug)) jsonError('Collection slug is required');

        if ($itemsAction === 'items' && !empty($itemParam)) {
            // Remove item from collection
            $collection = Database::queryOne(
                "SELECT id FROM collections WHERE slug = ? AND user_id = ?",
                [$slug, $userId]
            );
            if (!$collection) jsonError('Collection not found', 404);

            $deleted = Database::execute(
                "DELETE FROM collection_items WHERE collection_id = ? AND identifier = ?",
                [$collection['id'], $itemParam]
            );
            if ($deleted === 0) jsonError('Item not found in collection', 404);

            Database::query("UPDATE collections SET updated_at = NOW() WHERE id = ?", [$collection['id']]);
            jsonResponse(['message' => 'Item removed from collection']);
        }

        // Delete collection
        $deleted = Database::execute(
            "DELETE FROM collections WHERE slug = ? AND user_id = ?",
            [$slug, $userId]
        );
        if ($deleted === 0) jsonError('Collection not found', 404);

        jsonResponse(['message' => 'Collection deleted']);
        break;

    default:
        jsonError('Method not allowed', 405);
}
