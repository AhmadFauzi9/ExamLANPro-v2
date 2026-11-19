<?php
/**
 * ExamLAN Pro - Exam Attempt & Progression Controller
 */

class ExamAttemptController {
    public static function startAttempt(): void {
        $input = Utils::getJsonInput();
        $quizId = trim((string)($input['quiz_id'] ?? ''));
        $nis = trim((string)($input['nis'] ?? ''));
        $name = trim((string)($input['name'] ?? ''));
        $class = trim((string)($input['class'] ?? ''));

        if ($quizId === '' || $nis === '' || $name === '' || $class === '') {
            Response::error('Identitas dan paket kuis wajib diisi.', 400);
        }

        $db = Database::load();
        $quiz = null;
        foreach ($db['questions'] as $candidate) {
            if ((string)($candidate['id'] ?? '') === $quizId) {
                $quiz = $candidate;
                break;
            }
        }

        if (!$quiz || empty($quiz['questions'])) {
            Response::error('Kuis tidak tersedia.', 404);
        }

        $quizPin = strtoupper(trim((string)($quiz['pin'] ?? '')));
        $inputPin = strtoupper(trim((string)($input['pin'] ?? '')));
        if ($quizPin !== '') {
            if ($inputPin === '' || !hash_equals($quizPin, $inputPin)) {
                Response::error('TOKEN ujian tidak valid atau sudah kedaluwarsa. Silakan masukkan token terbaru yang aktif dari guru pengawas.', 401);
            }
        }

        $requirePassword = (bool)($db['settings']['require_student_password'] ?? true);
        if ($requirePassword) {
            $inputPassword = strtoupper(trim((string)($input['password'] ?? '')));
            foreach ($db['students'] as $st) {
                if (trim((string)($st['nis'] ?? '')) === $nis) {
                    $stPassword = strtoupper(trim((string)($st['password'] ?? '')));
                    if ($stPassword !== '' && ($inputPassword === '' || !hash_equals($stPassword, $inputPassword))) {
                        Response::error('Autentikasi siswa gagal: Password tidak valid.', 401);
                    }
                    break;
                }
            }
        }

        // Cek jika siswa sudah memiliki sesi aktif yang sedang berjalan untuk kuis ini
        foreach ($db['active_attempts'] as $existingKey => $existingAttempt) {
            if (
                (string)($existingAttempt['nis'] ?? '') === $nis &&
                (string)($existingAttempt['quiz_id'] ?? '') === $quizId &&
                empty($existingAttempt['finished']) &&
                (int)($existingAttempt['ends_at'] ?? 0) > time()
            ) {
                $tokenToSend = $existingAttempt['token'] ?? '';
                if ($tokenToSend === '') {
                    $tokenToSend = bin2hex(random_bytes(32));
                    $newHash = Utils::attemptKey($tokenToSend);
                    $db['active_attempts'][$newHash] = $existingAttempt;
                    $db['active_attempts'][$newHash]['token'] = $tokenToSend;
                    $db['active_attempts'][$newHash]['token_hash'] = $newHash;
                    if ($newHash !== $existingKey) unset($db['active_attempts'][$existingKey]);
                    Database::save($db);
                }
                Response::success([
                    'resumed' => true,
                    'attempt_token' => $tokenToSend,
                    'quiz' => ScoringEngine::publicAttemptQuiz($quiz, $existingAttempt),
                    'server_now' => time(),
                    'ends_at' => $existingAttempt['ends_at'],
                    'answers' => $existingAttempt['answers'] ?? []
                ]);
            }
        }

        $permissionKey = $nis . '_' . $quizId;
        $permission = $db['retake_permissions'][$permissionKey] ?? null;
        $retakeAllowed = is_array($permission)
            ? ((int)($permission['remaining'] ?? 0) > 0 && (empty($permission['expires_at']) || strtotime($permission['expires_at']) >= time()))
            : !empty($permission);

        foreach ($db['results'] as $r) {
            if ((string)($r['nis'] ?? '') === $nis && (string)($r['code'] ?? '') === $quizId && !$retakeAllowed) {
                Response::conflict('Ujian ini sudah pernah dikerjakan.');
            }
        }

        $totalQuestions = count($quiz['questions']);
        $maxQuestions = isset($quiz['max_questions']) ? (int)$quiz['max_questions'] : 0;
        if ($maxQuestions <= 0 && isset($quiz['question_count'])) {
            $maxQuestions = (int)$quiz['question_count'];
        }

        $order = Utils::shuffledIndices($totalQuestions);
        if ($maxQuestions > 0 && $maxQuestions < $totalQuestions) {
            $order = array_slice($order, 0, $maxQuestions);
        }

        $token = bin2hex(random_bytes(32));
        $optionOrder = [];
        foreach ($order as $qid) {
            if (is_array($quiz['questions'][$qid]['options'] ?? null)) {
                $optionOrder[$qid] = Utils::shuffledIndices(count($quiz['questions'][$qid]['options']));
            }
        }

        $attempt = [
            'token' => $token,
            'token_hash' => Utils::attemptKey($token),
            'quiz_id' => $quizId,
            'quiz_title' => $quiz['title'] ?? $quizId,
            'nis' => $nis,
            'name' => $name,
            'class' => $class,
            'question_order' => $order,
            'option_order' => $optionOrder,
            'answers' => [],
            'started_at' => time(),
            'ends_at' => time() + max(1, (int)($quiz['duration'] ?? 1)) * 60,
            'updated_at' => time()
        ];

        $tokenHash = Utils::attemptKey($token);
        $db['active_attempts'][$tokenHash] = $attempt;

        $db['student_sessions'] = $db['student_sessions'] ?? [];
        $prev = $db['student_sessions'][$nis] ?? [];
        $db['student_sessions'][$nis] = array_merge($prev, [
            'nis' => $nis,
            'name' => $name,
            'class' => $class,
            'quiz_id' => $quizId,
            'quiz_title' => $quiz['title'] ?? $quizId,
            'status' => 'WORKING',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'login_at' => $prev['login_at'] ?? time(),
            'started_at' => time(),
            'ends_at' => $attempt['ends_at'],
            'last_seen' => time(),
            'attempt_token_hash' => $tokenHash
        ]);

        AuditService::log($db, 'Mulai ujian', "{$nis} - {$name}", 'Paket: ' . ($quiz['title'] ?? $quizId));
        Database::save($db);

        Response::success([
            'attempt_token' => $token,
            'nis' => $nis,
            'name' => $name,
            'class' => $class,
            'quiz' => ScoringEngine::publicAttemptQuiz($quiz, $attempt),
            'server_now' => time(),
            'ends_at' => $attempt['ends_at'],
            'answers' => []
        ]);
    }

    public static function getAttempt(): void {
        $token = (string)($_GET['token'] ?? '');
        $db = Database::load();
        $key = Utils::attemptKey($token);
        $attempt = $db['active_attempts'][$key] ?? null;

        if (!$attempt) {
            Response::notFound('Sesi ujian tidak ditemukan.');
        }

        if (!empty($attempt['reset_allowed'])) {
            Response::json([
                'status' => 'needs_login',
                'message' => 'Sesi ujian Anda telah direset oleh Pengawas. Silakan login kembali dan masukkan token aktif terbaru.'
            ], 403);
        }

        $quiz = null;
        foreach ($db['questions'] as $candidate) {
            if ((string)($candidate['id'] ?? '') === (string)$attempt['quiz_id']) {
                $quiz = $candidate;
                break;
            }
        }

        if (!$quiz) {
            Response::notFound('Kuis tidak ditemukan.');
        }

        Response::success([
            'attempt_token' => $token,
            'nis' => (string)($attempt['nis'] ?? ''),
            'name' => (string)($attempt['name'] ?? ''),
            'class' => (string)($attempt['class'] ?? ''),
            'quiz' => ScoringEngine::publicAttemptQuiz($quiz, $attempt),
            'answers' => $attempt['answers'] ?? [],
            'server_now' => time(),
            'ends_at' => $attempt['ends_at'],
            'finished' => !empty($attempt['finished']),
            'violations_count' => (int)($attempt['violations_count'] ?? 0)
        ]);
    }

    public static function heartbeat(): void {
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $attemptToken = (string)($input['attempt_token'] ?? '');
        $quizId = trim((string)($input['quiz_id'] ?? ''));

        $db = Database::load();
        $dirty = false;

        if ($nis !== '') {
            $db['student_sessions'] = $db['student_sessions'] ?? [];
            if (isset($db['student_sessions'][$nis])) {
                $db['student_sessions'][$nis]['last_seen'] = time();
                if ($quizId !== '' && empty($db['student_sessions'][$nis]['quiz_id'])) {
                    $db['student_sessions'][$nis]['quiz_id'] = $quizId;
                }
                $dirty = true;
            }
        }

        if ($attemptToken !== '') {
            $key = Utils::attemptKey($attemptToken);
            if (isset($db['active_attempts'][$key])) {
                $db['active_attempts'][$key]['updated_at'] = time();
                $dirty = true;
            }
        }

        if ($dirty) Database::save($db);
        Response::success(['server_now' => time()]);
    }

    public static function saveAnswers(): void {
        $input = Utils::getJsonInput();
        $token = (string)($input['attempt_token'] ?? '');
        $db = Database::load();
        $key = Utils::attemptKey($token);
        $attempt = $db['active_attempts'][$key] ?? null;

        if (!$attempt || !empty($attempt['finished'])) {
            Response::notFound('Sesi ujian tidak aktif.');
        }

        if (time() > (int)$attempt['ends_at']) {
            Response::forbidden('Waktu ujian telah berakhir.');
        }

        $answers = Utils::normalizeAnswers($input['answers'] ?? []);
        $allowed = count($attempt['question_order']);
        foreach ($answers as $position => $answer) {
            if ($position < 0 || $position >= $allowed) {
                unset($answers[$position]);
            }
        }

        $db['active_attempts'][$key]['answers'] = $answers;
        $db['active_attempts'][$key]['updated_at'] = time();

        $nis = (string)($attempt['nis'] ?? '');
        if ($nis !== '' && isset($db['student_sessions'][$nis])) {
            $db['student_sessions'][$nis]['last_seen'] = time();
            $db['student_sessions'][$nis]['status'] = 'WORKING';
        }

        Database::save($db);
        Response::success([
            'message' => 'Jawaban tersimpan.',
            'server_now' => time()
        ]);
    }

    public static function submitResult(): void {
        $input = Utils::getJsonInput();
        $db = Database::load();
        $attemptToken = (string)($input['attempt_token'] ?? '');
        $attemptKey = Utils::attemptKey($attemptToken);
        $attempt = $db['active_attempts'][$attemptKey] ?? null;

        if (!$attempt || !empty($attempt['finished'])) {
            Response::conflict('Sesi ujian tidak aktif atau sudah selesai.');
        }

        $quizId = (string)$attempt['quiz_id'];
        $nis = (string)$attempt['nis'];
        $quiz = null;
        foreach ($db['questions'] as $candidate) {
            if ((string)($candidate['id'] ?? '') === $quizId) {
                $quiz = $candidate;
                break;
            }
        }

        if (!$quiz || $nis === '') {
            Response::error('Data ujian tidak valid.', 400);
        }

        $questionOrder = $attempt['question_order'];
        $answers = Utils::normalizeAnswers($attempt['answers'] ?? []);

        foreach ($answers as $position => &$answer) {
            $qid = $questionOrder[(int)$position] ?? null;
            $map = $attempt['option_order'][$qid] ?? [];
            if (is_array($answer)) {
                $answer = array_values(array_filter(array_map(fn($v) => $map[(int)$v] ?? null, $answer), fn($v) => $v !== null));
            } elseif (is_numeric($answer) && isset($map[(int)$answer])) {
                $answer = $map[(int)$answer];
            }
        }
        unset($answer);

        $missing = [];
        foreach ($questionOrder as $pos => $_qid) {
            $v = $answers[$pos] ?? null;
            if ($v === null || $v === '' || (is_array($v) && !$v)) {
                $missing[] = $pos + 1;
            }
        }

        $isExpired = (time() >= (int)($attempt['ends_at'] ?? 0)) || !empty($input['force_submit']);
        if ($missing && !$isExpired) {
            Response::error('Masih ada jawaban kosong.', 400, ['empty_questions' => $missing]);
        }

        [$score, $correct, $wrong, $breakdowns] = ScoringEngine::calculateSubmission($quiz, $questionOrder, $answers);

        $token = bin2hex(random_bytes(32));
        $recordId = 'res_' . bin2hex(random_bytes(16));
        $record = [
            'id' => $recordId,
            'nis' => $nis,
            'name' => (string)$attempt['name'],
            'class' => (string)$attempt['class'],
            'code' => $quizId,
            'title' => (string)($quiz['title'] ?? ''),
            'score' => $score,
            'correct' => $correct,
            'wrong' => $wrong,
            'date' => date('d/m/Y H:i:s'),
            'review_token' => $token,
            'question_order' => $questionOrder,
            'answers' => $answers,
            'breakdowns' => $breakdowns
        ];

        $same = array_values(array_filter($db['results'], function($r) use ($nis, $quizId) {
            return (string)($r['nis'] ?? '') === $nis && (string)($r['code'] ?? '') === $quizId;
        }));

        if (count($same) >= MAX_STUDENT_HISTORY) {
            for ($i = count($db['results']) - 1; $i >= 0; $i--) {
                if ((string)($db['results'][$i]['nis'] ?? '') === $nis && (string)($db['results'][$i]['code'] ?? '') === $quizId) {
                    array_splice($db['results'], $i, 1);
                    break;
                }
            }
        }

        array_unshift($db['results'], $record);
        $db['active_attempts'][$attemptKey]['finished'] = true;
        $db['active_attempts'][$attemptKey]['result_token'] = $token;
        $db['active_attempts'][$attemptKey]['score'] = $score;

        $permissionKey = $nis . '_' . $quizId;
        if (isset($db['retake_permissions'][$permissionKey]) && is_array($db['retake_permissions'][$permissionKey])) {
            $db['retake_permissions'][$permissionKey]['remaining'] = max(0, (int)$db['retake_permissions'][$permissionKey]['remaining'] - 1);
            if (!$db['retake_permissions'][$permissionKey]['remaining']) {
                unset($db['retake_permissions'][$permissionKey]);
            }
        } else {
            unset($db['retake_permissions'][$permissionKey]);
        }

        $db['student_sessions'] = $db['student_sessions'] ?? [];
        $prev = $db['student_sessions'][$nis] ?? [];
        $db['student_sessions'][$nis] = array_merge($prev, [
            'nis' => $nis,
            'name' => (string)($attempt['name'] ?? ($prev['name'] ?? $nis)),
            'class' => (string)($attempt['class'] ?? ($prev['class'] ?? '')),
            'quiz_id' => $quizId,
            'quiz_title' => (string)($quiz['title'] ?? $quizId),
            'status' => 'FINISHED',
            'finished_at' => time(),
            'score' => $score,
            'last_seen' => time()
        ]);

        AuditService::log($db, 'Selesai ujian', "{$nis} - " . (string)($attempt['name'] ?? ''), "Nilai: {$score} ({$correct} Benar, {$wrong} Salah) - " . ($quiz['title'] ?? $quizId));
        Database::save($db);

        Response::success([
            'message' => 'Jawaban berhasil terkirim ke server',
            'score' => $score,
            'correct' => $correct,
            'wrong' => $wrong,
            'review_token' => $token
        ]);
    }
}
