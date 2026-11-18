<?php
/**
 * ExamLAN Pro - Central Database Service
 */

class Database {
    private static ?array $cachedDb = null;

    public static function load(): array {
        if (self::$cachedDb !== null) {
            return self::$cachedDb;
        }

        $file_db = EXAMLAN_DB_FILE;
        if (!file_exists($file_db)) {
            $defaultData = [
                'questions' => [],
                'results' => [],
                'review_settings' => [],
                'retake_permissions' => [],
                'students' => [],
                'active_attempts' => [],
                'student_sessions' => [],
                'audit_logs' => [],
                'backups' => [],
                'time_extension_requests' => [],
                'settings' => ['require_student_password' => true],
                'trash' => ['results' => [], 'students' => [], 'quizzes' => []],
                'teacher_password_hash' => DEFAULT_TEACHER_HASH,
                'teacher_password_changed' => false
            ];
            file_put_contents($file_db, json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        $content = file_get_contents($file_db);
        $db = json_decode($content, true);
        if (!is_array($db)) $db = [];

        $db['questions'] = $db['questions'] ?? [];
        $dirty = false;
        $now = time();
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        foreach ($db['questions'] as &$q) {
            if (empty($q['pin'])) {
                $q['pin'] = substr(str_shuffle($chars), 0, 6);
                $q['pin_enabled'] = true;
                $q['pin_updated_at'] = $now;
                $q['pin_auto_refresh'] = true;
                $dirty = true;
            }

            // Fitur rotasi token otomatis setiap 10 menit (600 detik) - Strict Security
            $autoRefresh = ($q['pin_auto_refresh'] ?? true);
            if ($autoRefresh && !empty($q['pin'])) {
                $updatedAt = (int)($q['pin_updated_at'] ?? 0);
                if ($updatedAt <= 0) {
                    $q['pin_updated_at'] = $now;
                    $dirty = true;
                } elseif (($now - $updatedAt) >= TOKEN_ROTATION_INTERVAL) {
                    $q['pin'] = substr(str_shuffle($chars), 0, 6);
                    $q['pin_updated_at'] = $now;
                    unset($q['prev_pin'], $q['prev_pin_expires_at']);
                    $dirty = true;
                }
            }
        }
        unset($q);

        $db['results'] = $db['results'] ?? [];
        $db['review_settings'] = $db['review_settings'] ?? [];
        $db['retake_permissions'] = $db['retake_permissions'] ?? [];
        $db['students'] = $db['students'] ?? [];

        foreach ($db['students'] as &$st) {
            if (empty($st['password'])) {
                $st['password'] = Utils::generateStudentPassword();
                $dirty = true;
            }
        }
        unset($st);

        $db['active_attempts'] = $db['active_attempts'] ?? [];
        $db['student_sessions'] = $db['student_sessions'] ?? [];
        $db['audit_logs'] = $db['audit_logs'] ?? [];
        $db['backups'] = $db['backups'] ?? [];
        $db['time_extension_requests'] = $db['time_extension_requests'] ?? [];
        $db['settings'] = $db['settings'] ?? [];

        if (!isset($db['settings']['require_student_password'])) {
            $db['settings']['require_student_password'] = true;
            $dirty = true;
        }

        $db['teacher_password_hash'] = $db['teacher_password_hash'] ?? DEFAULT_TEACHER_HASH;
        $db['teacher_password_changed'] = $db['teacher_password_changed'] ?? false;
        $db['trash'] = $db['trash'] ?? ['results' => [], 'students' => [], 'quizzes' => []];

        if ($dirty) {
            self::save($db);
        }

        self::$cachedDb = $db;
        return $db;
    }

    public static function save(array $db): void {
        self::$cachedDb = $db;
        $json = json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        file_put_contents(EXAMLAN_DB_FILE, $json, LOCK_EX);
    }
}
