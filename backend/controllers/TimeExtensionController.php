<?php
// backend/controllers/TimeExtensionController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';

class TimeExtensionController {

    public static function request() {
        $input = Utils::getJsonInput();
        $token = trim((string)($input['attempt_token'] ?? $input['token'] ?? ''));
        $db = Database::load();
        $db['time_extension_requests'] = $db['time_extension_requests'] ?? [];

        $key = Utils::attemptKey($token);
        $attempt = $db['active_attempts'][$key] ?? ($db['active_attempts'][$token] ?? null);
        if ($attempt && !isset($db['active_attempts'][$key]) && isset($db['active_attempts'][$token])) {
            $key = $token;
        }

        if (!$attempt) {
            foreach ($db['active_attempts'] as $ak => $cand) {
                if (($cand['token'] ?? '') === $token || $ak === $token || $ak === $key) {
                    $attempt = $cand;
                    $key = $ak;
                    break;
                }
            }
        }

        if (!$attempt || !empty($attempt['finished'])) {
            Response::notFound('Sesi ujian tidak aktif atau tidak ditemukan.');
        }

        $found = false;
        foreach ($db['time_extension_requests'] as &$req) {
            if (($req['token_hash'] ?? '') === $key || (($req['nis'] ?? '') === (string)$attempt['nis'] && ($req['quiz_id'] ?? '') === (string)$attempt['quiz_id'])) {
                $req['token_hash'] = $key;
                $req['status'] = 'PENDING';
                $req['requested_at'] = time();
                $found = true;
                break;
            }
        }
        unset($req);

        if (!$found) {
            $quiz = null;
            foreach ($db['questions'] as $q) {
                if ((string)($q['id'] ?? '') === (string)$attempt['quiz_id']) {
                    $quiz = $q;
                    break;
                }
            }
            $db['time_extension_requests'][] = [
                'id' => 'req_' . bin2hex(random_bytes(8)),
                'token_hash' => $key,
                'nis' => (string)$attempt['nis'],
                'name' => (string)$attempt['name'],
                'class' => (string)$attempt['class'],
                'quiz_id' => (string)$attempt['quiz_id'],
                'quiz_title' => (string)($quiz['title'] ?? $attempt['quiz_id']),
                'requested_at' => time(),
                'status' => 'PENDING',
                'added_minutes' => 0
            ];
        }

        AuditService::log($db, 'Minta perpanjangan waktu', $attempt['nis'] . ' / ' . $attempt['quiz_id']);
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Permintaan perpanjangan waktu berhasil dikirim.']);
    }

    public static function checkRequests() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $all = array_values($db['time_extension_requests'] ?? []);
        usort($all, function($a, $b) {
            return ($b['requested_at'] ?? 0) <=> ($a['requested_at'] ?? 0);
        });
        $pending = array_values(array_filter($all, fn($r) => ($r['status'] ?? '') === 'PENDING'));
        Response::json([
            'status' => 'success',
            'requests' => $pending,
            'all_requests' => $all,
            'pending_count' => count($pending)
        ]);
    }

    public static function approve() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        
        // Jika dikirim approve: false, teruskan ke alur penolakan
        if (isset($input['approve']) && $input['approve'] === false) {
            $tokenHash = trim((string)($input['token_hash'] ?? ''));
            $attemptToken = trim((string)($input['attempt_token'] ?? ''));
            $reqId = trim((string)($input['id'] ?? $input['request_id'] ?? ''));
            $db = Database::load();
            $db['time_extension_requests'] = $db['time_extension_requests'] ?? [];

            if ($tokenHash === '' && $attemptToken !== '') $tokenHash = Utils::attemptKey($attemptToken);
            if ($tokenHash === '' && $reqId !== '') {
                foreach ($db['time_extension_requests'] as $r) {
                    if (($r['id'] ?? '') === $reqId) { $tokenHash = (string)($r['token_hash'] ?? ''); break; }
                }
            }

            foreach ($db['time_extension_requests'] as &$req) {
                if (($req['token_hash'] ?? '') === $tokenHash || ($reqId !== '' && ($req['id'] ?? '') === $reqId)) {
                    $req['status'] = 'REJECTED';
                    $req['responded_at'] = time();
                    AuditService::log($db, 'Tolak perpanjangan waktu', $req['nis']);
                    break;
                }
            }
            unset($req);
            Database::save($db);
            Response::json(['status' => 'success', 'message' => 'Permintaan perpanjangan waktu ditolak.']);
        }

        $tokenHash = trim((string)($input['token_hash'] ?? ''));
        $attemptToken = trim((string)($input['attempt_token'] ?? ''));
        $reqId = trim((string)($input['id'] ?? $input['request_id'] ?? ''));
        $nis = trim((string)($input['nis'] ?? ''));
        $minutes = (int)($input['minutes'] ?? 0);

        if ($minutes < 1) {
            Response::error('Jumlah menit perpanjangan waktu harus minimal 1 menit.', 400);
        }

        $db = Database::load();
        $db['time_extension_requests'] = $db['time_extension_requests'] ?? [];

        if ($tokenHash === '' && $attemptToken !== '') $tokenHash = Utils::attemptKey($attemptToken);
        if ($tokenHash === '' && $reqId !== '') {
            foreach ($db['time_extension_requests'] as $r) {
                if (($r['id'] ?? '') === $reqId) { $tokenHash = (string)($r['token_hash'] ?? ''); break; }
            }
        }
        if ($tokenHash === '' && $nis !== '') {
            foreach ($db['active_attempts'] as $ak => $av) {
                if ((string)($av['nis'] ?? '') === $nis && empty($av['finished'])) { $tokenHash = $ak; break; }
            }
        }

        if (!isset($db['active_attempts'][$tokenHash])) {
            Response::notFound('Sesi ujian siswa tidak ditemukan di server.');
        }

        $attempt = &$db['active_attempts'][$tokenHash];
        $baseTime = max(time(), (int)($attempt['ends_at'] ?? time()));
        $newEndsAt = $baseTime + ($minutes * 60);
        $attempt['ends_at'] = $newEndsAt;
        $sNis = (string)($attempt['nis'] ?? '');
        unset($attempt);

        if ($sNis !== '' && isset($db['student_sessions'][$sNis])) {
            $db['student_sessions'][$sNis]['ends_at'] = $newEndsAt;
        }

        $matchedReq = false;
        foreach ($db['time_extension_requests'] as &$req) {
            if (($req['token_hash'] ?? '') === $tokenHash || ($reqId !== '' && ($req['id'] ?? '') === $reqId)) {
                $req['status'] = 'APPROVED';
                $req['added_minutes'] = $minutes;
                $req['new_ends_at'] = $newEndsAt;
                $req['responded_at'] = time();
                $matchedReq = true;
                AuditService::log($db, "Setujui perpanjangan waktu +{$minutes}m", ($req['nis'] ?? $sNis));
                break;
            }
        }
        unset($req);

        if (!$matchedReq) {
            AuditService::log($db, "Setujui perpanjangan waktu +{$minutes}m", $sNis);
        }

        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => "Perpanjangan waktu {$minutes} menit berhasil diberikan.",
            'new_ends_at' => $newEndsAt,
            'added_minutes' => $minutes
        ]);
    }

    public static function reject() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $tokenHash = trim((string)($input['token_hash'] ?? ''));
        $attemptToken = trim((string)($input['attempt_token'] ?? ''));
        $reqId = trim((string)($input['id'] ?? $input['request_id'] ?? ''));
        $db = Database::load();
        $db['time_extension_requests'] = $db['time_extension_requests'] ?? [];

        if ($tokenHash === '' && $attemptToken !== '') $tokenHash = Utils::attemptKey($attemptToken);
        if ($tokenHash === '' && $reqId !== '') {
            foreach ($db['time_extension_requests'] as $r) {
                if (($r['id'] ?? '') === $reqId) { $tokenHash = (string)($r['token_hash'] ?? ''); break; }
            }
        }

        foreach ($db['time_extension_requests'] as &$req) {
            if (($req['token_hash'] ?? '') === $tokenHash || ($reqId !== '' && ($req['id'] ?? '') === $reqId)) {
                $req['status'] = 'REJECTED';
                $req['responded_at'] = time();
                AuditService::log($db, 'Tolak perpanjangan waktu', $req['nis']);
                break;
            }
        }
        unset($req);
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Permintaan perpanjangan waktu ditolak.']);
    }

    public static function clearHistory() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $db['time_extension_requests'] = array_values(array_filter($db['time_extension_requests'] ?? [], fn($r) => ($r['status'] ?? '') === 'PENDING'));
        AuditService::log($db, 'Bersihkan riwayat perpanjangan waktu');
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Riwayat perpanjangan waktu berhasil dibersihkan.']);
    }

    public static function checkStatus() {
        $token = (string)($_GET['token'] ?? '');
        $db = Database::load();
        $key = Utils::attemptKey($token);
        $attempt = $db['active_attempts'][$key] ?? null;
        $targetReq = null;
        foreach ($db['time_extension_requests'] ?? [] as $req) {
            if (($req['token_hash'] ?? '') === $key) {
                $targetReq = $req;
                break;
            }
        }
        if (!$targetReq) {
            Response::json(['status' => 'success', 'extension_status' => 'NONE']);
        }
        Response::json([
            'status' => 'success',
            'extension_status' => $targetReq['status'],
            'ends_at' => $attempt ? (int)$attempt['ends_at'] : 0,
            'server_now' => time()
        ]);
    }
}
