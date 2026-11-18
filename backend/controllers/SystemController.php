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
}
