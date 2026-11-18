<?php
// backend/controllers/ResultManagementController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';
require_once __DIR__ . '/../services/BackupService.php';

class ResultManagementController {

    public static function deleteResult() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $quizId = trim((string)($input['quiz_id'] ?? ''));
        $db = Database::load();
        $before = count($db['results']);
        $removed = array_values(array_filter($db['results'], fn($r) => (string)($r['nis'] ?? '') === $nis && (string)($r['code'] ?? '') === $quizId));
        $db['trash']['results'] = array_merge($db['trash']['results'], $removed);
        $db['results'] = array_values(array_filter($db['results'], fn($r) => !((string)($r['nis'] ?? '') === $nis && (string)($r['code'] ?? '') === $quizId)));
        AuditService::log($db, 'Hapus hasil', $nis . ' / ' . $quizId);
        Database::save($db);
        Response::json(['status' => 'success', 'message' => $before === count($db['results']) ? 'Hasil tidak ditemukan.' : 'Hasil berhasil dihapus.']);
    }

    public static function deleteResults() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $items = $input['items'] ?? [];
        $db = Database::load();
        $keys = [];
        foreach ($items as $it) {
            $keys[(string)($it['nis'] ?? '') . '|' . (string)($it['quiz_id'] ?? '')] = true;
        }
        $db['results'] = array_values(array_filter($db['results'], function($r) use ($keys) {
            return empty($keys[(string)($r['nis'] ?? '') . '|' . (string)($r['code'] ?? '')]);
        }));
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Hasil terpilih berhasil dihapus.']);
    }

    public static function clearResults() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        BackupService::createBackup('before-reset-results');
        $db['trash']['results'] = array_merge($db['trash']['results'], $db['results']);
        AuditService::log($db, 'Reset hasil ujian');
        $db['results'] = [];
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Hasil berhasil direset']);
    }

    public static function getResultDetail() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $nis = trim((string)($_GET['nis'] ?? ''));
        $quizId = trim((string)($_GET['quiz_id'] ?? ''));
        $date = trim((string)($_GET['date'] ?? ''));

        $found = null;
        foreach ($db['results'] as $r) {
            if ((string)($r['nis'] ?? '') === $nis && ((string)($r['code'] ?? '') === $quizId || $quizId === '')) {
                if ($date === '' || (string)($r['date'] ?? '') === $date) {
                    $found = $r;
                    break;
                }
            }
        }

        if (!$found) {
            Response::notFound('Data rincian hasil ujian tidak ditemukan.');
        }

        Response::json(['status' => 'success', 'result' => $found]);
    }
}
