<?php
/**
 * Shared helper functions: JSON responses, auth, CORS, rate limiting.
 */

require_once __DIR__ . '/Database.php';

// ── JSON Response Helpers ──

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $status = 400) {
    jsonResponse(['error' => $message], $status);
}

function getJsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// ── CORS ──

function handleCors() {
    // When Allow-Credentials is true, Allow-Origin cannot be '*' (CORS spec).
    // Reflect the requesting origin for credentialed requests (sessions).
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        // Same-origin requests don't send an Origin header
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Credentials: true');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ── Session ──

function startSession() {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $config = require __DIR__ . '/config.php';
    $sess = $config['session'];

    session_name($sess['name']);
    session_set_cookie_params([
        'lifetime' => $sess['lifetime'],
        'path'     => '/',
        'httponly'  => true,
        'secure'   => !empty($_SERVER['HTTPS']),
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ── Auth Middleware ──

function requireAuth() {
    startSession();
    if (empty($_SESSION['user_id'])) {
        jsonError('Authentication required', 401);
    }
}

function requireAdmin() {
    startSession();
    if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin'])) {
        jsonError('Admin access required', 403);
    }
}

function getCurrentUser() {
    startSession();
    if (empty($_SESSION['user_id'])) return null;
    return [
        'id'       => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'email'    => $_SESSION['email'],
        'is_admin' => $_SESSION['is_admin'] ?? false,
    ];
}

// ── Rate Limiting (file-based, per IP) ──
// Uses a project-local tmp directory instead of sys_get_temp_dir(),
// which is often shared/purged on cPanel shared hosting.

function checkRateLimit($action = 'auth', $maxAttempts = 20, $windowSeconds = 900) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($action . ':' . $ip);
    // Store rate limit files in api/.ratelimit/ (project-local, .htaccess-protected)
    $dir = __DIR__ . '/.ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
        // Prevent web access with an .htaccess deny-all
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    }
    $file = $dir . '/' . $key;

    $data = ['attempts' => 0, 'reset_at' => time() + $windowSeconds];

    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?: $data;
        if ($data['reset_at'] < time()) {
            $data = ['attempts' => 0, 'reset_at' => time() + $windowSeconds];
        }
    }

    if ($data['attempts'] >= $maxAttempts) {
        jsonError('Too many attempts, please try again later', 429);
    }

    $data['attempts']++;
    file_put_contents($file, json_encode($data), LOCK_EX);
}

// ── Validation ──

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validateIdentifier($id) {
    return preg_match('/^[a-zA-Z0-9._-]+$/', $id);
}

function slugify($text) {
    $slug = strtolower(trim($text));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    $slug = trim($slug, '-');
    return $slug ?: 'untitled';
}
