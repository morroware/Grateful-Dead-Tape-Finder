<?php
/**
 * Auth routes:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *   PUT  /api/auth/profile
 */

startSession();

switch ($subRoute) {

    // ── Register ──
    case 'register':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        checkRateLimit('auth');

        $body = getJsonBody();
        $username = trim($body['username'] ?? '');
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (strlen($username) < 3 || strlen($username) > 50) {
            jsonError('Username must be 3-50 characters');
        }
        if (!validateEmail($email)) {
            jsonError('Invalid email address');
        }
        if (strlen($password) < 8) {
            jsonError('Password must be at least 8 characters');
        }

        // Check for existing user
        $existing = Database::queryOne(
            "SELECT id FROM users WHERE email = ? OR username = ?",
            [$email, $username]
        );
        if ($existing) {
            jsonError('Username or email already in use');
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        Database::query(
            "INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)",
            [$username, $email, $hash, $username]
        );

        $userId = Database::lastInsertId();

        // Auto-login
        $_SESSION['user_id']  = $userId;
        $_SESSION['username'] = $username;
        $_SESSION['email']    = $email;
        $_SESSION['is_admin'] = false;

        jsonResponse([
            'message' => 'Account created successfully',
            'user'    => getCurrentUser(),
        ], 201);
        break;

    // ── Login ──
    case 'login':
        if ($method !== 'POST') jsonError('Method not allowed', 405);
        checkRateLimit('auth');

        $body = getJsonBody();
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (empty($email) || empty($password)) {
            jsonError('Email and password are required');
        }

        $user = Database::queryOne(
            "SELECT id, username, email, password_hash, display_name, is_admin FROM users WHERE email = ?",
            [$email]
        );

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonError('Invalid email or password', 401);
        }

        // Update last login
        Database::query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [$user['id']]);

        // Set session
        $_SESSION['user_id']  = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email']    = $user['email'];
        $_SESSION['is_admin'] = (bool)$user['is_admin'];

        jsonResponse([
            'message' => 'Logged in successfully',
            'user'    => getCurrentUser(),
        ]);
        break;

    // ── Logout ──
    case 'logout':
        if ($method !== 'POST') jsonError('Method not allowed', 405);

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'],
                $params['secure'], $params['httponly']
            );
        }
        session_destroy();

        jsonResponse(['message' => 'Logged out']);
        break;

    // ── Current user ──
    case 'me':
        if ($method !== 'GET') jsonError('Method not allowed', 405);

        $user = getCurrentUser();
        if (!$user) {
            jsonError('Not authenticated', 401);
        }
        jsonResponse(['user' => $user]);
        break;

    // ── Update profile ──
    case 'profile':
        if ($method !== 'PUT') jsonError('Method not allowed', 405);
        requireAuth();

        $body = getJsonBody();
        $userId = $_SESSION['user_id'];

        $updates = [];
        $params = [];

        if (!empty($body['display_name'])) {
            $updates[] = 'display_name = ?';
            $params[]  = trim($body['display_name']);
        }

        if (!empty($body['email'])) {
            if (!validateEmail($body['email'])) {
                jsonError('Invalid email address');
            }
            $existing = Database::queryOne(
                "SELECT id FROM users WHERE email = ? AND id != ?",
                [$body['email'], $userId]
            );
            if ($existing) {
                jsonError('Email already in use');
            }
            $updates[] = 'email = ?';
            $params[]  = trim($body['email']);
        }

        if (!empty($body['new_password'])) {
            if (strlen($body['new_password']) < 8) {
                jsonError('Password must be at least 8 characters');
            }
            // Verify current password
            $user = Database::queryOne("SELECT password_hash FROM users WHERE id = ?", [$userId]);
            if (!password_verify($body['current_password'] ?? '', $user['password_hash'])) {
                jsonError('Current password is incorrect', 401);
            }
            $updates[] = 'password_hash = ?';
            $params[]  = password_hash($body['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }

        if (empty($updates)) {
            jsonError('No changes provided');
        }

        $params[] = $userId;
        Database::query(
            "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?",
            $params
        );

        // Refresh session data
        $user = Database::queryOne("SELECT username, email FROM users WHERE id = ?", [$userId]);
        $_SESSION['username'] = $user['username'];
        $_SESSION['email']    = $user['email'];

        jsonResponse(['message' => 'Profile updated', 'user' => getCurrentUser()]);
        break;

    default:
        jsonError('Not found', 404);
}
