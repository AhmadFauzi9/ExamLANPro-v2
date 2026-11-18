<?php
/**
 * ExamLAN Pro - Authentication Middleware
 */

class AuthMiddleware {
    public static function teacherOnly(): void {
        $timeout = TEACHER_SESSION_TIMEOUT;
        if (
            empty($_SESSION['teacher_authenticated']) ||
            empty($_SESSION['teacher_last_activity']) ||
            (time() - (int)$_SESSION['teacher_last_activity'] > $timeout)
        ) {
            $_SESSION = [];
            Response::forbidden('Akses guru ditolak. Silakan login sebagai guru.');
        }
        $_SESSION['teacher_last_activity'] = time();
    }

    public static function isTeacher(): bool {
        $timeout = TEACHER_SESSION_TIMEOUT;
        return !empty($_SESSION['teacher_authenticated']) &&
               !empty($_SESSION['teacher_last_activity']) &&
               (time() - (int)$_SESSION['teacher_last_activity'] <= $timeout);
    }
}
