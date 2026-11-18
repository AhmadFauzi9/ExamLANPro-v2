<?php
/**
 * ExamLAN Pro - JSON Response Helper
 */

class Response {
    public static function json($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(array $data = [], string $message = ''): void {
        $payload = array_merge(['status' => 'success'], $data);
        if ($message !== '' && !isset($payload['message'])) {
            $payload['message'] = $message;
        }
        self::json($payload, 200);
    }

    public static function error(string $message, int $statusCode = 400, array $extra = []): void {
        $payload = array_merge([
            'status' => 'error',
            'message' => $message
        ], $extra);
        self::json($payload, $statusCode);
    }

    public static function unauthorized(string $message = 'Autentikasi diperlukan.'): void {
        self::error($message, 401);
    }

    public static function forbidden(string $message = 'Akses ditolak.'): void {
        self::error($message, 403);
    }

    public static function notFound(string $message = 'Sumber daya tidak ditemukan.'): void {
        self::error($message, 404);
    }

    public static function conflict(string $message = 'Konflik permintaan.'): void {
        self::error($message, 409);
    }

    public static function tooManyRequests(string $message = 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.'): void {
        self::error($message, 429);
    }
}
