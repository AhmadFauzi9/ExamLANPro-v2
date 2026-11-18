<?php
/**
 * ExamLAN Pro - Scoring & Exam Engine Service
 */

class ScoringEngine {
    public static function quizValidationErrors(array $quiz): array {
        $errors = [];
        $questions = $quiz['questions'] ?? [];

        if (trim((string)($quiz['title'] ?? '')) === '') $errors[] = 'Judul wajib diisi';
        if ((int)($quiz['duration'] ?? 0) < 1) $errors[] = 'Durasi belum valid';
        if (!$questions) $errors[] = 'Minimal satu soal diperlukan';

        foreach ($questions as $i => $q) {
            $type = $q['type'] ?? 'mc';
            $num = $i + 1;

            switch ($type) {
                case 'mc':
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks pertanyaan wajib diisi';
                    if (empty($q['options']) || !is_array($q['options'])) $errors[] = 'Opsi soal ' . $num . ' belum lengkap';
                    if (!array_key_exists('answer', $q) || $q['answer'] === null || $q['answer'] === '') $errors[] = 'Kunci soal ' . $num . ' belum diisi';
                    break;

                case 'complex':
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks pertanyaan wajib diisi';
                    if (empty($q['options']) || !is_array($q['options'])) $errors[] = 'Opsi soal ' . $num . ' belum lengkap';
                    if (empty($q['answers']) || !is_array($q['answers'])) $errors[] = 'Kunci soal ' . $num . ' belum diisi';
                    break;

                case 'cause_effect':
                    $stmt = trim((string)($q['statement'] ?? ''));
                    $qText = trim((string)($q['question'] ?? ''));
                    $reason = trim((string)($q['reason'] ?? ''));
                    if ($stmt === '' && $qText === '') $errors[] = 'Soal ' . $num . ' belum lengkap: pernyataan wajib diisi';
                    if ($reason === '') $errors[] = 'Soal ' . $num . ' belum lengkap: alasan wajib diisi';
                    if (!array_key_exists('answer', $q) || $q['answer'] === null || $q['answer'] === '') $errors[] = 'Kunci soal ' . $num . ' belum diisi';
                    break;

                case 'case_analysis':
                    if (trim((string)($q['passage'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks kasus wajib diisi';
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: pertanyaan wajib diisi';
                    if (empty($q['options']) || !is_array($q['options'])) $errors[] = 'Opsi soal ' . $num . ' belum lengkap';
                    if (!array_key_exists('answer', $q) || $q['answer'] === null || $q['answer'] === '') $errors[] = 'Kunci soal ' . $num . ' belum diisi';
                    break;

                case 'scaled':
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks pertanyaan wajib diisi';
                    if (empty($q['options']) || !is_array($q['options'])) $errors[] = 'Opsi soal ' . $num . ' belum lengkap';
                    break;

                case 'matching':
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks pertanyaan menjodohkan wajib diisi';
                    if (empty($q['premises']) || empty($q['targets'])) $errors[] = 'Pasangan premis dan target pada soal ' . $num . ' belum lengkap';
                    break;

                case 'short_answer':
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks pertanyaan isian singkat wajib diisi';
                    if (!array_key_exists('answer', $q) || trim((string)$q['answer']) === '') $errors[] = 'Kunci jawaban isian singkat soal ' . $num . ' belum diisi';
                    break;

                case 'essay':
                    if (trim((string)($q['question'] ?? '')) === '') $errors[] = 'Soal ' . $num . ' belum lengkap: teks pertanyaan uraian/esai wajib diisi';
                    break;

                default:
                    $main = trim((string)($q['question'] ?? ''));
                    if ($main === '') $main = trim((string)($q['statement'] ?? ''));
                    if ($main === '') $errors[] = 'Soal ' . $num . ' belum lengkap';
                    break;
            }
        }
        return array_values(array_unique($errors));
    }

    public static function quizAvailableNow(array $quiz): ?string {
        if (($quiz['status'] ?? 'ACTIVE') !== 'ACTIVE') return 'Paket kuis belum aktif.';
        $now = time();
        if (!empty($quiz['start_at']) && strtotime($quiz['start_at']) > $now) return 'Ujian belum memasuki jadwal mulai.';
        if (!empty($quiz['end_at']) && strtotime($quiz['end_at']) < $now) return 'Masa akses ujian telah berakhir.';
        return null;
    }

    public static function publicAttemptQuiz(array $quiz, array $attempt): array {
        $out = [
            'id' => $quiz['id'],
            'title' => $quiz['title'] ?? '',
            'duration' => $quiz['duration'] ?? 0,
            'questions' => []
        ];

        foreach (($attempt['question_order'] ?? []) as $qid) {
            if (!isset($quiz['questions'][$qid])) continue;
            $q = $quiz['questions'][$qid];
            unset($q['answer'], $q['answers'], $q['explanation']);
            $q['_student_id'] = (string)$qid;

            if (isset($attempt['option_order'][$qid]) && is_array($q['options'] ?? null)) {
                $ordered = [];
                foreach ($attempt['option_order'][$qid] as $original) {
                    if (array_key_exists($original, $q['options'])) {
                        $ordered[] = $q['options'][$original];
                    }
                }
                $q['options'] = $ordered;
            }
            $out['questions'][] = $q;
        }
        return $out;
    }

    public static function findQuestionByStudentId(array $quiz, $studentId): ?array {
        $idx = (int)$studentId;
        return ($idx >= 0 && isset($quiz['questions'][$idx])) ? $quiz['questions'][$idx] : null;
    }

    public static function calculateSubmission(array $quiz, array $questionOrder, array $answers): array {
        $correctCount = 0;
        $incorrectCount = 0;
        $totalMaxScore = 0;
        $totalObtainedScore = 0;
        $breakdowns = [];

        foreach ($questionOrder as $studentPos => $studentId) {
            $q = self::findQuestionByStudentId($quiz, $studentId);
            if (!$q) continue;

            $studentAns = array_key_exists($studentPos, $answers) ? $answers[$studentPos] : null;
            $isCorrect = false;

            if ($q['type'] === 'mc' || $q['type'] === 'case_analysis') {
                $isCorrect = false;
                if ($studentAns !== null && $studentAns !== '') {
                    $rawAns = $q['answer'] ?? 0;
                    $sIdx = is_numeric($studentAns) ? (int)$studentAns : (ord(strtoupper(trim((string)$studentAns))[0]) - 65);
                    if (is_numeric($rawAns)) {
                        $eIdx = (int)$rawAns;
                    } else {
                        $eIdx = ord(strtoupper(trim((string)$rawAns))[0]) - 65;
                    }
                    $isCorrect = ($sIdx === $eIdx);
                }
            } elseif ($q['type'] === 'complex') {
                $expected = array_map(function($v) {
                    return is_numeric($v) ? (int)$v : (ord(strtoupper(trim((string)$v))[0]) - 65);
                }, $q['answers'] ?? []);
                $given = is_array($studentAns) ? array_map(function($v) {
                    return is_numeric($v) ? (int)$v : (ord(strtoupper(trim((string)$v))[0]) - 65);
                }, $studentAns) : [];
                sort($expected);
                sort($given);
                $isCorrect = !empty($expected) && $expected === $given;
            } elseif ($q['type'] === 'matching') {
                $expected = is_array($q['pairs'] ?? null) ? $q['pairs'] : (is_array($q['answer'] ?? null) ? $q['answer'] : []);
                $given = is_array($studentAns) ? $studentAns : [];
                $matchCount = 0;
                $totalPairs = count($expected);
                foreach ($expected as $pIdx => $tIdx) {
                    if (isset($given[$pIdx]) && (int)$given[$pIdx] === (int)$tIdx) {
                        $matchCount++;
                    }
                }
                $isCorrect = ($totalPairs > 0 && $matchCount === $totalPairs);
            } elseif ($q['type'] === 'short_answer') {
                $expRaw = trim((string)($q['answer'] ?? ''));
                $variants = array_map(fn($v) => strtolower(trim($v)), explode('|', $expRaw));
                $given = strtolower(trim((string)$studentAns));
                $isCorrect = ($given !== '' && in_array($given, $variants, true));
            } elseif ($q['type'] === 'essay') {
                $given = trim((string)$studentAns);
                $isCorrect = ($given !== '');
            } elseif ($q['type'] === 'cause_effect') {
                $sNorm = Utils::normalizeCauseEffectKey($studentAns);
                $kNorm = Utils::normalizeCauseEffectKey($q['answer'] ?? '');
                $isCorrect = ($studentAns !== null && $studentAns !== '' && $sNorm !== '' && $sNorm === $kNorm);
            } elseif ($q['type'] === 'scaled') {
                $selected = isset($q['options'][(int)$studentAns]) ? $q['options'][(int)$studentAns] : null;
                $score = $selected ? (int)$selected['score'] : 0;
                $max = 0;
                foreach (($q['options'] ?? []) as $o) {
                    $max = max($max, (int)($o['score'] ?? 0));
                }
                $totalObtainedScore += $score;
                $totalMaxScore += $max;
                $isCorrect = $score >= ($max / 2);
            }

            if ($isCorrect) $correctCount++; else $incorrectCount++;

            $correctAnswer = $q['type'] === 'complex' 
                ? ($q['answers'] ?? []) 
                : ($q['type'] === 'matching' ? ($q['pairs'] ?? $q['answer'] ?? []) : ($q['answer'] ?? null));

            $breakdowns[] = [
                'question' => $q,
                'studentAnswer' => $studentAns,
                'isCorrect' => $isCorrect,
                'studentAnswerText' => Utils::answerText($q, $studentAns),
                'correctAnswerText' => $q['type'] === 'scaled' ? 'Soal Evaluasi Skala' : Utils::answerText($q, $correctAnswer, true)
            ];
        }

        $totalQuestions = count($questionOrder);
        $hasScaled = false;
        foreach ($quiz['questions'] as $q) {
            if (($q['type'] ?? '') === 'scaled') {
                $hasScaled = true;
                break;
            }
        }

        $score = $hasScaled 
            ? ($totalMaxScore > 0 ? (int)round(($totalObtainedScore / $totalMaxScore) * 100) : 0)
            : ($totalQuestions > 0 ? (int)round(($correctCount / $totalQuestions) * 100) : 0);

        return [$score, $correctCount, $incorrectCount, $breakdowns];
    }
}
