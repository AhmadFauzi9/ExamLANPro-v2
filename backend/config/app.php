<?php
/**
 * ExamLAN Pro - Backend Application Configuration
 */

define('EXAMLAN_ROOT', dirname(__DIR__, 2));
define('EXAMLAN_BACKEND', dirname(__DIR__));
define('EXAMLAN_STORAGE', EXAMLAN_BACKEND . '/storage');

define('EXAMLAN_DB_FILE', EXAMLAN_STORAGE . '/db_kuis.json');
define('EXAMLAN_SESSION_DIR', EXAMLAN_STORAGE . '/sessions');
define('EXAMLAN_BACKUP_DIR', EXAMLAN_STORAGE . '/backups');
define('EXAMLAN_UPLOADS_DIR', EXAMLAN_ROOT . '/uploads/soal');

define('DEFAULT_TEACHER_HASH', '$2y$12$Id0m0N5GLQeEaxfBCE9HW.vUv.C3bJR/BrJ6MPJKGmPTbGFX2ZC1m'); // admin123
define('TEACHER_SESSION_TIMEOUT', 1800); // 30 menit
define('TOKEN_ROTATION_INTERVAL', 600);   // 10 menit
define('MAX_AUDIT_LOGS', 1000);
define('MAX_STUDENT_HISTORY', 5);
