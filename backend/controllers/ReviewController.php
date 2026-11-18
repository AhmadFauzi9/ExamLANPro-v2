<?php
// backend/controllers/ReviewController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';

class ReviewController {

    public static function getReview() {
        $token = (string)($_GET['token'] ?? '');
        if ($token === '') {
            Response::json(['allowed' => false], 400);
        }
        $db = Database::load();
        foreach ($db['results'] as $r) {
            if (($r['review_token'] ?? '') === $token) {
                $quizCode = (string)($r['code'] ?? '');
                $allowed = !empty($db['review_settings'][$quizCode]) || !empty($db['review_settings']['all']);
                Response::json(['allowed' => (bool)$allowed, 'breakdowns' => $allowed ? ($r['breakdowns'] ?? []) : []]);
            }
        }
        Response::json(['allowed' => false], 404);
    }

    public static function setReviewState() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $quizId = (string)($input['quiz_id'] ?? '');
        $enabled = !empty($input['enabled']);
        $db = Database::load();
        if ($quizId === '') {
            Response::error('Paket kuis tidak valid.', 400);
        }
        if ($quizId === 'all') {
            $db['review_settings']['all'] = $enabled;
            foreach (($db['questions'] ?? []) as $q) {
                if (!empty($q['id'])) {
                    $db['review_settings'][$q['id']] = $enabled;
                }
            }
        } else {
            $db['review_settings'][$quizId] = $enabled;
        }
        AuditService::log($db, $enabled ? 'Buka Pembahasan Ujian' : 'Kunci Pembahasan Ujian', $quizId);
        Database::save($db);
        Response::json([
            'status' => 'success',
            'enabled' => $enabled,
            'review_settings' => $db['review_settings'],
            'review_states' => $db['review_settings'],
            'message' => $enabled ? 'Jawaban & pembahasan dibuka untuk siswa.' : 'Jawaban & pembahasan disembunyikan dari siswa.'
        ]);
    }

    public static function getReviewStates() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        Response::json([
            'status' => 'success',
            'review_settings' => $db['review_settings'] ?? [],
            'review_states' => $db['review_settings'] ?? []
        ]);
    }
}
