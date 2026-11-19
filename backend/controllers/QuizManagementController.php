<?php
// backend/controllers/QuizManagementController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';
require_once __DIR__ . '/../services/BackupService.php';
require_once __DIR__ . '/../services/ScoringEngine.php';
require_once __DIR__ . '/../services/QuestionParserService.php';

class QuizManagementController {

    public static function getData() {
        AuthMiddleware::teacherOnly();
        Response::json(Database::load());
    }

    public static function saveQuestions() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        if (!is_array($input)) {
            Response::error('Data soal tidak valid.', 400);
        }

        $uploadsDir = EXAMLAN_ROOT . '/uploads/soal';

        foreach ($input as &$quiz) {
            $quiz['status'] = $quiz['status'] ?? 'ACTIVE';
            if (empty($quiz['questions'])) {
                $quiz['status'] = 'DRAFT';
            }
            if ($quiz['status'] === 'ACTIVE' && ($errors = ScoringEngine::quizValidationErrors($quiz))) {
                Response::error('Kuis tidak dapat diaktifkan: ' . implode('; ', $errors), 400);
            }

            // Proses lampiran gambar pada tiap butir soal
            if (isset($quiz['questions']) && is_array($quiz['questions'])) {
                foreach ($quiz['questions'] as &$q) {
                    // Deteksi permintaan hapus gambar
                    if (isset($q['image_payload']) && $q['image_payload'] === 'DELETE') {
                        if (!empty($q['image'])) {
                            $oldPath = EXAMLAN_ROOT . '/' . ltrim((string)$q['image'], '/\\');
                            if (file_exists($oldPath) && is_file($oldPath)) {
                                @unlink($oldPath);
                            }
                        }
                        $q['image'] = '';
                        unset($q['image_payload']);
                    }

                    // Deteksi upload gambar baru via Base64
                    if (!empty($q['image_payload']) && $q['image_payload'] !== 'DELETE') {
                        if (!is_dir($uploadsDir)) {
                            @mkdir($uploadsDir, 0755, true);
                        }

                        $payload = (string)$q['image_payload'];
                        $ext = 'jpg';
                        if (preg_match('#^data:image/(png|jpeg|jpg);base64,#i', $payload, $matches)) {
                            $ext = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
                            $payload = substr($payload, strpos($payload, ',') + 1);
                        }

                        $decoded = base64_decode($payload, true);
                        if ($decoded !== false) {
                            if (!empty($q['image'])) {
                                $oldPath = EXAMLAN_ROOT . '/' . ltrim((string)$q['image'], '/\\');
                                if (file_exists($oldPath) && is_file($oldPath)) {
                                    @unlink($oldPath);
                                }
                            }

                            $safeQuizId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($quiz['id'] ?? 'quiz'));
                            $filename = 'img_soal_' . $safeQuizId . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $ext;
                            $filepath = $uploadsDir . '/' . $filename;

                            if (file_put_contents($filepath, $decoded) !== false) {
                                $q['image'] = 'uploads/soal/' . $filename;
                            }
                        }
                        unset($q['image_payload']);
                    }
                }
                unset($q);
            }
        }
        unset($quiz);

        $db = Database::load();
        BackupService::createBackup('before-save-quizzes');

        $existingMap = [];
        foreach ($db['questions'] as $eq) {
            if (!empty($eq['id'])) $existingMap[$eq['id']] = $eq;
        }

        $now = time();
        foreach ($input as &$quiz) {
            $qid = $quiz['id'] ?? '';
            $existing = $existingMap[$qid] ?? null;

            if (!isset($quiz['pin_auto_refresh'])) {
                $quiz['pin_auto_refresh'] = $existing['pin_auto_refresh'] ?? true;
            }

            if ($existing && !empty($existing['pin']) && !empty($quiz['pin']) && $existing['pin'] !== $quiz['pin']) {
                $quiz['pin_updated_at'] = $now;
            } elseif ($existing && !empty($existing['pin_updated_at'])) {
                $quiz['pin_updated_at'] = $existing['pin_updated_at'];
            } else {
                $quiz['pin_updated_at'] = $now;
            }
            unset($quiz['prev_pin'], $quiz['prev_pin_expires_at']);
        }
        unset($quiz);

        $db['questions'] = $input;
        AuditService::log($db, 'Simpan paket kuis', '', count($input) . ' paket');
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Soal berhasil disimpan di server']);
    }

    public static function importQuestionsFile() {
        AuthMiddleware::teacherOnly();
        $quizId = trim((string)($_POST['quiz_id'] ?? ''));
        if ($quizId === '') {
            Response::error('Target paket kuis belum dipilih.', 400);
        }
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Berkas gagal diunggah atau tidak ditemukan.', 400);
        }

        $fileTmp = $_FILES['file']['tmp_name'];
        $fileName = strtolower($_FILES['file']['name']);
        $ext = pathinfo($fileName, PATHINFO_EXTENSION);
        $uploadsDir = EXAMLAN_ROOT . '/uploads/soal';
        if (!is_dir($uploadsDir)) @mkdir($uploadsDir, 0755, true);

        $parsedQuestions = [];

        try {
            if ($ext === 'docx') {
                $parsedQuestions = QuestionParserService::parseDocx($fileTmp, $uploadsDir, $quizId);
            } elseif ($ext === 'doc') {
                $header = file_get_contents($fileTmp, false, null, 0, 4);
                if ($header === "PK\x03\x04") {
                    $parsedQuestions = QuestionParserService::parseDocx($fileTmp, $uploadsDir, $quizId);
                } else {
                    $parsedQuestions = QuestionParserService::parseDocHtml($fileTmp, $uploadsDir, $quizId);
                }
            } elseif ($ext === 'xlsx' || $ext === 'xls') {
                $parsedQuestions = QuestionParserService::parseXlsx($fileTmp, $uploadsDir, $quizId);
            } elseif ($ext === 'txt') {
                $parsedQuestions = QuestionParserService::parseText(file_get_contents($fileTmp), $quizId);
            } elseif ($ext === 'csv') {
                $parsedQuestions = QuestionParserService::parseCsv($fileTmp, $quizId);
            } else {
                Response::error('Format berkas tidak didukung. Harap unggah berkas .docx, .doc, .xlsx, .xls, .csv, atau .txt.', 400);
            }
        } catch (\Throwable $e) {
            Response::error('Gagal memproses berkas soal: ' . $e->getMessage(), 400);
        }

        if (isset($parsedQuestions['error'])) {
            Response::error($parsedQuestions['error'], 400);
        }

        if (empty($parsedQuestions)) {
            Response::error('Tidak ada butir soal yang berhasil dibaca dari berkas. Pastikan format penulisan soal sesuai panduan template.', 400);
        }

        $db = Database::load();
        $targetQuiz = null;
        foreach ($db['questions'] as &$q) {
            if ((string)$q['id'] === $quizId) {
                $targetQuiz = &$q;
                break;
            }
        }
        unset($q);

        if (!$targetQuiz) {
            Response::notFound('Paket kuis target tidak ditemukan.');
        }

        if (!isset($targetQuiz['questions']) || !is_array($targetQuiz['questions'])) {
            $targetQuiz['questions'] = [];
        }

        $addedCount = 0;
        foreach ($parsedQuestions as $newQ) {
            $targetQuiz['questions'][] = $newQ;
            $addedCount++;
        }

        if (!empty($_POST['status'])) {
            $targetQuiz['status'] = trim((string)$_POST['status']);
        } elseif ($targetQuiz['status'] === 'DRAFT' && count($targetQuiz['questions']) > 0) {
            $targetQuiz['status'] = 'ACTIVE';
        }

        AuditService::log($db, 'Import soal file (' . $ext . ')', $targetQuiz['title'], "$addedCount soal ditambahkan");
        Database::save($db);

        Response::json([
            'status' => 'success',
            'message' => "Berhasil mengimpor $addedCount butir soal ke dalam paket '{$targetQuiz['title']}'.",
            'added_count' => $addedCount,
            'quiz' => $targetQuiz,
            'all_questions' => $db['questions']
        ]);
    }

    public static function allowRetake() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $quizId = trim((string)($input['quiz_id'] ?? ''));
        if ($nis === '' || $quizId === '') {
            Response::error('NIS atau paket kuis tidak valid.', 400);
        }
        $db = Database::load();
        $attempts = max(1, min(10, (int)($input['attempts'] ?? 1)));
        $until = trim((string)($input['valid_until'] ?? ''));
        if ($until !== '' && strtotime($until) === false) {
            Response::error('Tanggal berlaku tidak valid.', 400);
        }
        $db['retake_permissions'][$nis . '_' . $quizId] = [
            'remaining' => $attempts,
            'reason' => trim((string)($input['reason'] ?? '')),
            'expires_at' => $until ?: null,
            'granted_by' => 'guru',
            'granted_at' => date('c')
        ];
        AuditService::log($db, 'Izin ujian ulang', $nis . ' / ' . $quizId, 'Kesempatan: ' . $attempts);
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Izin ujian ulang diberikan.']);
    }
}
