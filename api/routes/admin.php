<?php
/**
 * Admin routes (all require admin auth):
 *   GET    /api/admin/stats       — dashboard stats
 *   GET    /api/admin/users       — list users
 *   POST   /api/admin/users       — create user
 *   PUT    /api/admin/users/:id   — update user role
 *   DELETE /api/admin/users/:id   — delete user
 *   POST   /api/admin/cache/clear — clear expired cache
 *   POST   /api/admin/cache/purge — purge all cache
 */

require_once __DIR__ . '/../CacheService.php';

requireAdmin();

$action = $subRoute;
$paramId = $param3;

switch ($action) {

    // ── Dashboard Stats ──
    case 'stats':
        if ($method !== 'GET') jsonError('Method not allowed', 405);

        $cacheStats = CacheService::getStats();
        $userCount  = Database::queryOne("SELECT COUNT(*) as cnt FROM users")['cnt'];
        $favCount   = Database::queryOne("SELECT COUNT(*) as cnt FROM favorites")['cnt'];

        $topFavorites = Database::queryAll(
            "SELECT identifier, title, creator, COUNT(*) as fav_count
             FROM favorites GROUP BY identifier, title, creator
             ORDER BY fav_count DESC LIMIT 10"
        );

        jsonResponse([
            'cache'          => $cacheStats,
            'user_count'     => (int)$userCount,
            'favorite_count' => (int)$favCount,
            'top_favorites'  => $topFavorites,
        ]);
        break;

    // ── User Management ──
    case 'users':
        switch ($method) {
            case 'GET':
                $page = max(1, (int)($_GET['page'] ?? 1));
                $limit = 50;
                $offset = ($page - 1) * $limit;

                $users = Database::queryAll(
                    "SELECT id, username, email, display_name, is_admin, created_at, last_login_at
                     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    [$limit, $offset]
                );
                $total = Database::queryOne("SELECT COUNT(*) as cnt FROM users")['cnt'];

                jsonResponse([
                    'users' => $users,
                    'total' => (int)$total,
                    'page'  => $page,
                ]);
                break;

            case 'POST':
                $body = getJsonBody();
                $username = trim($body['username'] ?? '');
                $email    = trim($body['email'] ?? '');
                $password = $body['password'] ?? '';

                if (strlen($username) < 3) jsonError('Username must be at least 3 characters');
                if (!validateEmail($email)) jsonError('Invalid email address');
                if (strlen($password) < 8) jsonError('Password must be at least 8 characters');

                $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                try {
                    Database::query(
                        "INSERT INTO users (username, email, password_hash, display_name, is_admin)
                         VALUES (?, ?, ?, ?, ?)",
                        [$username, $email, $hash, $username, !empty($body['is_admin']) ? 1 : 0]
                    );
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), 'Duplicate') !== false) {
                        jsonError('Username or email already exists');
                    }
                    throw $e;
                }

                jsonResponse(['message' => 'User created', 'id' => Database::lastInsertId()], 201);
                break;

            case 'PUT':
                if (empty($paramId)) jsonError('User ID is required');

                $body = getJsonBody();
                if (!isset($body['is_admin'])) jsonError('is_admin field is required');

                // Don't let admin demote themselves
                if ((int)$paramId === (int)$_SESSION['user_id'] && !$body['is_admin']) {
                    jsonError('Cannot remove your own admin status');
                }

                $updated = Database::execute(
                    "UPDATE users SET is_admin = ? WHERE id = ?",
                    [$body['is_admin'] ? 1 : 0, $paramId]
                );
                if ($updated === 0) jsonError('User not found', 404);

                jsonResponse(['message' => 'User updated']);
                break;

            case 'DELETE':
                if (empty($paramId)) jsonError('User ID is required');

                // Don't let admin delete themselves
                if ((int)$paramId === (int)$_SESSION['user_id']) {
                    jsonError('Cannot delete your own account');
                }

                $deleted = Database::execute("DELETE FROM users WHERE id = ?", [$paramId]);
                if ($deleted === 0) jsonError('User not found', 404);

                jsonResponse(['message' => 'User deleted']);
                break;

            default:
                jsonError('Method not allowed', 405);
        }
        break;

    // ── Cache Management ──
    case 'cache':
        if ($method !== 'POST') jsonError('Method not allowed', 405);

        if ($paramId === 'clear') {
            $result = CacheService::cleanExpired();
            jsonResponse([
                'message'        => 'Expired cache entries cleared',
                'search_deleted' => $result['search_deleted'],
                'shows_deleted'  => $result['shows_deleted'],
            ]);
        } elseif ($paramId === 'purge') {
            CacheService::purgeAll();
            jsonResponse(['message' => 'All cache entries purged']);
        } else {
            // Handle /api/admin/cache/clear and /api/admin/cache/purge
            // when they come as $param3 = 'clear'|'purge'
            jsonError('Use /api/admin/cache/clear or /api/admin/cache/purge', 400);
        }
        break;

    default:
        jsonError('Not found', 404);
}
