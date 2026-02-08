<?php
/**
 * Favorites routes (all require auth):
 *   GET    /api/favorites           — list user's favorites
 *   GET    /api/favorites/check/:id — check if show is favorited
 *   POST   /api/favorites           — add favorite
 *   PUT    /api/favorites/:id       — update notes
 *   DELETE /api/favorites/:id       — remove favorite
 */

requireAuth();
$userId = $_SESSION['user_id'];

switch ($method) {

    case 'GET':
        if ($subRoute === 'check' && !empty($param3)) {
            // Check if favorited
            $fav = Database::queryOne(
                "SELECT id FROM favorites WHERE user_id = ? AND identifier = ?",
                [$userId, $param3]
            );
            jsonResponse(['favorited' => $fav ? true : false, 'id' => $fav['id'] ?? null]);
        }

        // List favorites
        $favorites = Database::queryAll(
            "SELECT id, identifier, title, creator, date, notes, created_at
             FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
            [$userId]
        );
        jsonResponse(['favorites' => $favorites]);
        break;

    case 'POST':
        $body = getJsonBody();
        $identifier = trim($body['identifier'] ?? '');
        if (empty($identifier)) jsonError('Identifier is required');

        // Check for duplicate
        $existing = Database::queryOne(
            "SELECT id FROM favorites WHERE user_id = ? AND identifier = ?",
            [$userId, $identifier]
        );
        if ($existing) jsonError('Already favorited');

        Database::query(
            "INSERT INTO favorites (user_id, identifier, title, creator, date, notes) VALUES (?, ?, ?, ?, ?, ?)",
            [
                $userId,
                $identifier,
                $body['title'] ?? null,
                $body['creator'] ?? null,
                $body['date'] ?? null,
                $body['notes'] ?? null,
            ]
        );

        jsonResponse(['message' => 'Favorite added', 'id' => Database::lastInsertId()], 201);
        break;

    case 'PUT':
        if (empty($subRoute)) jsonError('Favorite identifier is required');

        $body = getJsonBody();
        $updated = Database::execute(
            "UPDATE favorites SET notes = ? WHERE user_id = ? AND identifier = ?",
            [$body['notes'] ?? '', $userId, $subRoute]
        );

        if ($updated === 0) jsonError('Favorite not found', 404);
        jsonResponse(['message' => 'Favorite updated']);
        break;

    case 'DELETE':
        if (empty($subRoute)) jsonError('Favorite identifier is required');

        $deleted = Database::execute(
            "DELETE FROM favorites WHERE user_id = ? AND identifier = ?",
            [$userId, $subRoute]
        );

        if ($deleted === 0) jsonError('Favorite not found', 404);
        jsonResponse(['message' => 'Favorite removed']);
        break;

    default:
        jsonError('Method not allowed', 405);
}
