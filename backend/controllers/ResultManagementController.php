<?php
// backend/controllers/ResultManagementController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';
require_once __DIR__ . '/../services/BackupService.php';

class ResultManagementController {

    /**
     * Memeriksa apakah suatu entri hasil cocok dengan kriteria target
     */
    public static function isTargetResult(array $r, array $target): bool {
        $id = trim((string)($target['id'] ?? ''));
        $token = trim((string)($target['review_token'] ?? ''));
        $nis = trim((string)($target['nis'] ?? ''));
        $quizId = trim((string)($target['quiz_id'] ?? $target['code'] ?? ''));
        $date = trim((string)($target['date'] ?? ''));

        // 1. Cocokkan berdasarkan ID unik jika tersedia
        if ($id !== '' && !empty($r['id'])) {
            return (string)$r['id'] === $id;
        }

        // 2. Cocokkan berdasarkan review_token unik jika tersedia
        if ($token !== '' && !empty($r['review_token'])) {
            return (string)$r['review_token'] === $token;
        }

        // 3. Cocokkan berdasarkan kombinasi NIS + Kode Kuis + Tanggal/Waktu
        if ($nis !== '' && (string)($r['nis'] ?? '') === $nis && ($quizId === '' || (string)($r['code'] ?? '') === $quizId)) {
            if ($date !== '') {
                return (string)($r['date'] ?? '') === $date;
            }
            // 4. Fallback jika HANYA NIS dan Quiz ID (tanpa id, token, maupun date)
            if ($id === '' && $token === '' && $date === '') {
                return true;
            }
        }

        return false;
    }

    public static function deleteResult() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $quizId = trim((string)($input['quiz_id'] ?? ''));
        $id = trim((string)($input['id'] ?? ''));
        $reviewToken = trim((string)($input['review_token'] ?? ''));
        $date = trim((string)($input['date'] ?? ''));

        if ($nis === '' && $quizId === '' && $id === '' && $reviewToken === '') {
            Response::error('Parameter identifikasi hasil ujian tidak valid.', 400);
        }

        $target = [
            'id' => $id,
            'review_token' => $reviewToken,
            'date' => $date,
            'nis' => $nis,
            'quiz_id' => $quizId
        ];

        $hasSpecificId = ($id !== '' || $reviewToken !== '' || $date !== '');

        $db = Database::load();
        $before = count($db['results']);
        $removed = [];
        $kept = [];

        foreach ($db['results'] as $r) {
            if (self::isTargetResult($r, $target)) {
                $removed[] = $r;
                // Jika memiliki identifier spesifik, hanya hapus 1 rekaman yang cocok
                if ($hasSpecificId) {
                    $target['id'] = '___REMOVED___';
                    $target['review_token'] = '___REMOVED___';
                    $target['date'] = '___REMOVED___';
                }
            } else {
                $kept[] = $r;
            }
        }

        if (empty($removed)) {
            Response::json(['status' => 'error', 'message' => 'Hasil ujian tidak ditemukan atau sudah dihapus.']);
            return;
        }

        $db['trash']['results'] = array_merge($db['trash']['results'] ?? [], $removed);
        $db['results'] = array_values($kept);

        $first = $removed[0];
        $logInfo = ($first['nis'] ?? $nis) . ' / ' . ($first['code'] ?? $quizId);
        if (!empty($first['date'])) {
            $logInfo .= ' [' . $first['date'] . ']';
        }
        if (isset($first['score'])) {
            $logInfo .= ' Nilai: ' . $first['score'];
        }

        AuditService::log($db, 'Hapus hasil ujian', $logInfo);
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Hasil ujian berhasil dihapus.']);
    }

    public static function deleteResults() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $items = $input['items'] ?? [];
        if (!is_array($items) || empty($items)) {
            Response::error('Tidak ada data hasil yang dipilih.', 400);
        }

        $db = Database::load();
        $targetList = [];
        foreach ($items as $it) {
            $targetList[] = [
                'id' => trim((string)($it['id'] ?? '')),
                'review_token' => trim((string)($it['review_token'] ?? '')),
                'date' => trim((string)($it['date'] ?? '')),
                'nis' => trim((string)($it['nis'] ?? '')),
                'quiz_id' => trim((string)($it['quiz_id'] ?? $it['code'] ?? ''))
            ];
        }

        $removed = [];
        $kept = [];

        foreach ($db['results'] as $r) {
            $matchedIdx = -1;
            foreach ($targetList as $idx => $t) {
                if (self::isTargetResult($r, $t)) {
                    $matchedIdx = $idx;
                    break;
                }
            }

            if ($matchedIdx !== -1) {
                $removed[] = $r;
                $matchedTarget = $targetList[$matchedIdx];
                $hasSpecificId = ($matchedTarget['id'] !== '' || $matchedTarget['review_token'] !== '' || $matchedTarget['date'] !== '');
                if ($hasSpecificId) {
                    array_splice($targetList, $matchedIdx, 1);
                }
            } else {
                $kept[] = $r;
            }
        }

        $db['trash']['results'] = array_merge($db['trash']['results'] ?? [], $removed);
        $db['results'] = array_values($kept);

        AuditService::log($db, 'Hapus hasil terpilih', count($removed) . ' rekaman nilai dihapus');
        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => count($removed) > 0 ? (count($removed) . ' hasil terpilih berhasil dihapus.') : 'Tidak ada hasil yang cocok dihapus.'
        ]);
    }

    public static function clearResults() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $db['trash']['results'] = array_merge($db['trash']['results'] ?? [], $db['results']);
        AuditService::log($db, 'Reset hasil ujian');
        $db['results'] = [];
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Hasil berhasil direset']);
    }

    public static function getResultDetail() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $id = trim((string)($_GET['id'] ?? ''));
        $token = trim((string)($_GET['token'] ?? $_GET['review_token'] ?? ''));
        $nis = trim((string)($_GET['nis'] ?? ''));
        $quizId = trim((string)($_GET['quiz_id'] ?? ''));
        $date = trim((string)($_GET['date'] ?? ''));

        $found = null;
        foreach ($db['results'] as $r) {
            if ($id !== '' && !empty($r['id']) && (string)$r['id'] === $id) {
                $found = $r;
                break;
            }
            if ($token !== '' && !empty($r['review_token']) && (string)$r['review_token'] === $token) {
                $found = $r;
                break;
            }
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
