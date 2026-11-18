<?php
/**
 * ExamLanPro - Backend Bootstrap
 */

require_once __DIR__ . '/config/app.php';

// Session guru harus tetap terbawa pada request API berikutnya
$secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
$sessionDir = EXAMLAN_SESSION_DIR;
if (!is_dir($sessionDir)) @mkdir($sessionDir, 0750, true);
if (is_dir($sessionDir)) session_save_path($sessionDir);

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secureCookie,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

// Headers JSON & Cache Prevention
if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/Router.php';

// Dispatch route
Router::dispatch();
