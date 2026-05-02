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
    // The frontend is served from the same origin as the API, so we don't need
    // to advertise any cross-origin permissions. Same-origin requests don't
    // require CORS headers at all and won't trigger preflights.
    //
    // If you need to allow specific cross-origin frontends, set
    // 'cors.allowed_origins' in config.php to an array of exact origins.
    $allowed = [];
    $configPath = __DIR__ . '/config.php';
    if (file_exists($configPath)) {
        $config = require $configPath;
        $allowed = $config['cors']['allowed_origins'] ?? [];
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Allow-Credentials: true');
    }

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
    // Pull display_name fresh so profile updates show up without re-login.
    $row = Database::queryOne(
        "SELECT display_name FROM users WHERE id = ?",
        [$_SESSION['user_id']]
    );
    return [
        'id'           => $_SESSION['user_id'],
        'username'     => $_SESSION['username'],
        'email'        => $_SESSION['email'],
        'display_name' => $row['display_name'] ?? $_SESSION['username'] ?? null,
        'is_admin'     => $_SESSION['is_admin'] ?? false,
    ];
}

// ── Rate Limiting (file-based, per IP) ──
// Uses a project-local tmp directory instead of sys_get_temp_dir(),
// which is often shared/purged on cPanel shared hosting.
// Read-modify-write happens under an exclusive flock() to avoid TOCTOU
// races where parallel requests bypass the limit.

function checkRateLimit($action = 'auth', $maxAttempts = 20, $windowSeconds = 900) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($action . ':' . $ip);
    $dir = __DIR__ . '/.ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    }
    $file = $dir . '/' . $key;

    $fp = @fopen($file, 'c+');
    if (!$fp) {
        // Storage unavailable — fail open rather than 500 (cache layer is best-effort)
        return;
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return;
    }

    $contents = stream_get_contents($fp);
    $data = json_decode($contents ?: '', true);
    $now = time();

    if (!is_array($data) || !isset($data['reset_at']) || $data['reset_at'] < $now) {
        $data = ['attempts' => 0, 'reset_at' => $now + $windowSeconds];
    }

    if ($data['attempts'] >= $maxAttempts) {
        flock($fp, LOCK_UN);
        fclose($fp);
        jsonError('Too many attempts, please try again later', 429);
    }

    $data['attempts']++;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
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
