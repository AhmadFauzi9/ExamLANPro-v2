<?php
// backend/controllers/SystemController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';
require_once __DIR__ . '/../services/BackupService.php';

class SystemController {

    public static function saveSettings() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $db = Database::load();
        $db['settings'] = $db['settings'] ?? [];
        if (isset($input['require_student_password'])) {
            $db['settings']['require_student_password'] = (bool)$input['require_student_password'];
        }
        AuditService::log($db, 'Ubah pengaturan ujian', 'Sistem', 'Wajib Password = ' . ($db['settings']['require_student_password'] ? 'Ya' : 'Tidak'));
        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => 'Pengaturan sistem berhasil disimpan.',
            'settings' => $db['settings']
        ]);
    }

    public static function status() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $writable = is_writable(EXAMLAN_ROOT) && is_writable(EXAMLAN_DB_FILE);
        Response::json([
            'status' => 'success',
            'checks' => [
                ['name' => 'PHP', 'ok' => true, 'detail' => PHP_VERSION],
                ['name' => 'API Guru', 'ok' => true, 'detail' => 'Sesi terverifikasi'],
                ['name' => 'Session', 'ok' => is_writable(session_save_path()), 'detail' => session_save_path()],
                ['name' => 'Storage JSON', 'ok' => $writable, 'detail' => basename(EXAMLAN_DB_FILE)],
                ['name' => 'Backup', 'ok' => is_dir(EXAMLAN_BACKUP_DIR) || is_writable(EXAMLAN_STORAGE), 'detail' => 'Folder backups']
            ]
        ]);
    }

    public static function getTrash() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        Response::json(['status' => 'success', 'trash' => $db['trash']]);
    }

    public static function restoreTrash() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $type = (string)($input['type'] ?? '');
        $index = (int)($input['index'] ?? -1);
        $db = Database::load();

        if (!isset($db['trash'][$type][$index])) {
            Response::notFound('Data trash tidak ditemukan.');
        }

        $item = $db['trash'][$type][$index];
        if ($type === 'results') {
            $db['results'][] = $item;
        } elseif ($type === 'students') {
            $db['students'][] = $item;
        } else {
            Response::error('Jenis data tidak dapat dipulihkan.', 400);
        }

        array_splice($db['trash'][$type], $index, 1);
        AuditService::log($db, 'Pulihkan dari trash', $type);
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Data dipulihkan.']);
    }

    public static function createBackup() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        BackupService::createBackup('manual');
        AuditService::log($db, 'Backup manual');
        Database::save($db);
        // Reload after backup saved
        $db = Database::load();
        Response::json([
            'status' => 'success',
            'message' => 'Backup berhasil dibuat.',
            'backups' => $db['backups']
        ]);
    }

    public static function deleteBackup() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $files = [];
        if (!empty($input['files']) && is_array($input['files'])) {
            foreach ($input['files'] as $f) {
                $fn = basename(trim((string)$f));
                if ($fn !== '') {
                    $files[] = $fn;
                }
            }
        } elseif (!empty($input['file'])) {
            $fn = basename(trim((string)$input['file']));
            if ($fn !== '') {
                $files[] = $fn;
            }
        }

        if (empty($files)) {
            Response::error('Nama berkas cadangan tidak valid atau belum dipilih.', 400);
        }

        $db = Database::load();
        $newBackups = [];
        $backupsList = $db['backups'] ?? [];
        $deleteMap = array_flip($files);

        foreach ($backupsList as $b) {
            $curFile = (string)($b['file'] ?? $b['name'] ?? '');
            if (isset($deleteMap[$curFile])) {
                $filePath = EXAMLAN_BACKUP_DIR . '/' . $curFile;
                if (file_exists($filePath) && is_file($filePath)) {
                    @unlink($filePath);
                }
            } else {
                $newBackups[] = $b;
            }
        }

        foreach ($files as $fn) {
            $filePath = EXAMLAN_BACKUP_DIR . '/' . $fn;
            if (file_exists($filePath) && is_file($filePath)) {
                @unlink($filePath);
            }
        }

        $db['backups'] = $newBackups;
        $auditDetail = count($files) > 1 
            ? count($files) . ' berkas: ' . implode(', ', array_slice($files, 0, 5)) . (count($files) > 5 ? '...' : '') 
            : $files[0];
        AuditService::log($db, 'Hapus berkas cadangan', $auditDetail);
        Database::save($db);

        $msg = count($files) > 1 
            ? count($files) . ' berkas cadangan berhasil dihapus.' 
            : 'Berkas cadangan berhasil dihapus.';

        Response::json([
            'status' => 'success',
            'message' => $msg,
            'backups' => $db['backups'],
            'deleted_count' => count($files)
        ]);
    }

    public static function restoreBackup() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $fileName = '';
        $rawContent = null;

        // 1. Cek jika file dikirim via upload berkas (multipart/form-data)
        if (isset($_FILES['backup_file']) && $_FILES['backup_file']['error'] === UPLOAD_ERR_OK) {
            $tmpPath = $_FILES['backup_file']['tmp_name'];
            $fileName = basename($_FILES['backup_file']['name']);
            $rawContent = @file_get_contents($tmpPath);
        } else {
            // 2. Cek jika nama file berasal dari riwayat backup server
            $fileParam = trim((string)($input['file'] ?? $_POST['file'] ?? ''));
            if ($fileParam !== '') {
                $fileName = basename($fileParam);
                $filePath = EXAMLAN_BACKUP_DIR . '/' . $fileName;
                if (!file_exists($filePath) || !is_file($filePath)) {
                    Response::error('Berkas cadangan tidak ditemukan di server.', 404);
                }
                $rawContent = @file_get_contents($filePath);
            }
        }

        if ($rawContent === null || $rawContent === '') {
            Response::error('Berkas cadangan tidak valid atau belum dipilih.', 400);
        }

        $restoredDb = @json_decode($rawContent, true);
        if (!is_array($restoredDb)) {
            Response::error('Format berkas cadangan rusak atau bukan JSON yang valid.', 400);
        }

        // Validasi struktur minimal database ExamLAN Pro
        $hasQuestions = isset($restoredDb['questions']) && is_array($restoredDb['questions']);
        $hasStudents = isset($restoredDb['students']) && is_array($restoredDb['students']);
        $hasResults = isset($restoredDb['results']) && is_array($restoredDb['results']);

        if (!$hasQuestions && !$hasStudents && !$hasResults) {
            Response::error('Berkas ini bukan berkas cadangan database ExamLAN Pro yang valid.', 400);
        }

        // Buat cadangan penyelamat kondisi database saat ini sebelum ditimpa (Auto Safety Backup)
        $currentDb = Database::load();
        $safetyPrefix = 'before-restore-' . preg_replace('/[^a-z0-9_-]/i', '-', pathinfo($fileName, PATHINFO_FILENAME));
        BackupService::createBackup($safetyPrefix);

        // Pertahankan dan gabungkan daftar riwayat backup agar tidak hilang
        $existingBackups = $currentDb['backups'] ?? [];
        if (!empty($restoredDb['backups']) && is_array($restoredDb['backups'])) {
            $knownFiles = [];
            foreach ($existingBackups as $b) {
                $f = $b['file'] ?? $b['name'] ?? '';
                if ($f) $knownFiles[$f] = true;
            }
            foreach ($restoredDb['backups'] as $b) {
                $f = $b['file'] ?? $b['name'] ?? '';
                if ($f && empty($knownFiles[$f])) {
                    $existingBackups[] = $b;
                    $knownFiles[$f] = true;
                }
            }
        }
        $restoredDb['backups'] = $existingBackups;

        // Normalisasi struktur kunci penting
        $restoredDb['questions'] = $restoredDb['questions'] ?? [];
        $restoredDb['students'] = $restoredDb['students'] ?? [];
        $restoredDb['results'] = $restoredDb['results'] ?? [];
        $restoredDb['active_attempts'] = $restoredDb['active_attempts'] ?? [];
        $restoredDb['student_sessions'] = $restoredDb['student_sessions'] ?? [];
        $restoredDb['settings'] = $restoredDb['settings'] ?? ($currentDb['settings'] ?? ['require_student_password' => true]);
        $restoredDb['trash'] = $restoredDb['trash'] ?? ['quizzes' => [], 'students' => [], 'results' => []];
        $restoredDb['audit_logs'] = $restoredDb['audit_logs'] ?? ($restoredDb['audit'] ?? []);

        AuditService::log($restoredDb, 'Restore database', "Dari berkas: {$fileName}");
        Database::save($restoredDb);

        // Jika upload berkas dari luar, simpan juga salinannya di folder backups server agar tercatat
        if (isset($_FILES['backup_file']) && $fileName !== '') {
            $destBackupPath = EXAMLAN_BACKUP_DIR . '/' . $fileName;
            if (!file_exists($destBackupPath)) {
                @file_put_contents($destBackupPath, $rawContent);
                $restoredDb['backups'][] = [
                    'file' => $fileName,
                    'time' => date('c'),
                    'reason' => 'uploaded-restore'
                ];
                Database::save($restoredDb);
            }
        }

        // Muat data terbaru setelah disimpan
        $finalDb = Database::load();

        Response::json([
            'status' => 'success',
            'message' => "Database berhasil dipulihkan dari berkas '{$fileName}'. Cadangan otomatis sebelum pemulihan telah disimpan.",
            'backups' => $finalDb['backups'] ?? []
        ]);
    }

    public static function downloadBackup() {
        AuthMiddleware::teacherOnly();
        $fileParam = trim((string)($_GET['file'] ?? ''));
        if ($fileParam === '') {
            Response::error('Nama berkas cadangan tidak valid.', 400);
        }
        $fileName = basename($fileParam);
        $filePath = EXAMLAN_BACKUP_DIR . '/' . $fileName;
        if (!file_exists($filePath) || !is_file($filePath)) {
            Response::notFound('Berkas cadangan tidak ditemukan.');
        }

        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: no-cache, must-revalidate');
        readfile($filePath);
        exit;
    }
}
