<?php
/**
 * ExamLAN Pro - General Helper Utilities
 */

class Utils {
    public static function generateStudentPassword(int $length = 6): string {
        $letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $digits = '23456789';
        $all = $letters . $digits;
        $pass = $letters[random_int(0, strlen($letters) - 1)] . $digits[random_int(0, strlen($digits) - 1)];
        for ($i = 2; $i < $length; $i++) {
            $pass .= $all[random_int(0, strlen($all) - 1)];
        }
        return str_shuffle($pass);
    }

    public static function attemptKey($token): string {
        return hash('sha256', (string)$token);
    }

    public static function shuffledIndices(int $count): array {
        if ($count < 1) return [];
        $a = range(0, $count - 1);
        for ($i = count($a) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$a[$i], $a[$j]] = [$a[$j], $a[$i]];
        }
        return $a;
    }

    public static function normalizeAnswers($value): array {
        if (!is_array($value)) return [];
        $out = [];
        foreach ($value as $k => $v) {
            $out[(int)$k] = is_array($v) ? array_map('intval', $v) : $v;
        }
        return $out;
    }

    public static function normalizeCauseEffectKey($key): string {
        if ($key === null) return '';
        $v = strtolower(trim((string)$key));
        if ($v === '') return '';

        $clean = preg_replace('/[^a-z0-9]/', '', $v);

        // Option A (Pernyataan & Alasan Benar, Berhubungan Sebab Akibat)
        if (in_array($clean, [
            'a', '1', '0',
            'bothcorrectconnected', 'bothtrueconnected', 'bothcorrectrelated',
            'bothcorrect', 'bothtrue',
            'keduanyabenarberhubungan', 'keduanyabenardansalingberhubungan',
            'benarbenarberhubungan', 'keduanyabenar'
        ], true)) {
            return 'both_correct_connected';
        }

        // Option B (Pernyataan & Alasan Benar, TIDAK Berhubungan)
        if (in_array($clean, [
            'b', '2',
            'bothcorrectnotconnected', 'bothtruenotconnected', 'bothcorrectunconnected',
            'keduanyabenartidakberhubungan', 'keduanyabenartetapitidakberhubungan',
            'benarbenartidakberhubungan'
        ], true)) {
            return 'both_correct_not_connected';
        }

        // Option C (Pernyataan BENAR dan Alasan SALAH)
        if (in_array($clean, [
            'c', '3',
            'statementtruereasonfalse',
            'statementcorrectreasonwrong',
            'statementtruereasonwrong',
            'statementcorrectreasonfalse',
            'pernyataanbenaralasansalah',
            'pernyataanbenardanalasansalah',
            'benarsalah'
        ], true)) {
            return 'statement_true_reason_false';
        }

        // Option D (Pernyataan SALAH dan Alasan BENAR)
        if (in_array($clean, [
            'd', '4',
            'statementfalsereasontrue',
            'statementwrongreasoncorrect',
            'statementwrongreasontrue',
            'statementfalsereasoncorrect',
            'pernyataansalahalasanbenar',
            'pernyataansalahdanalasanbenar',
            'salahbenar'
        ], true)) {
            return 'statement_false_reason_true';
        }

        // Option E (Pernyataan dan Alasan keduanya SALAH)
        if (in_array($clean, [
            'e', '5',
            'bothfalse',
            'bothwrong',
            'keduanyasalah',
            'salahsalah',
            'pernyataandanalasankeduanyasalah'
        ], true)) {
            return 'both_false';
        }

        return $v;
    }

    public static function answerText($q, $answer, bool $correct = false): string {
        $type = $q['type'] ?? 'mc';

        if ($type === 'mc' || $type === 'case_analysis') {
            if ($answer === null || $answer === '') return 'Tidak dijawab';
            $i = (int)$answer;
            return isset($q['options'][$i]) ? chr(65 + $i) . '. ' . $q['options'][$i] : 'Tidak dijawab';
        }

        if ($type === 'complex') {
            $vals = is_array($answer) ? $answer : [];
            if (!$vals) return 'Tidak dijawab';
            return implode('<br>', array_map(function($i) use ($q) {
                return isset($q['options'][$i]) ? chr(65 + $i) . '. ' . $q['options'][$i] : '';
            }, $vals));
        }

        if ($type === 'matching') {
            $premises = $q['premises'] ?? [];
            $targets = $q['targets'] ?? [];
            $pairs = is_array($answer) ? $answer : [];
            if (!$pairs) return 'Tidak dijawab';
            $out = [];
            foreach ($pairs as $pIdx => $tIdx) {
                $pText = $premises[(int)$pIdx] ?? ('Premis ' . ((int)$pIdx + 1));
                $tText = $targets[(int)$tIdx] ?? ('Pasangan ' . ((int)$tIdx + 1));
                $out[] = "<b>$pText</b> ➔ $tText";
            }
            return $out ? implode('<br>', $out) : 'Tidak dijawab';
        }

        if ($type === 'short_answer') {
            return ($answer !== null && $answer !== '') ? htmlspecialchars((string)$answer) : 'Tidak dijawab';
        }

        if ($type === 'essay') {
            return ($answer !== null && $answer !== '') ? nl2br(htmlspecialchars((string)$answer)) : 'Tidak dijawab';
        }

        if ($type === 'cause_effect') {
            $canonical = self::normalizeCauseEffectKey($answer);
            $labels = [
                'both_correct_connected' => 'Pernyataan & alasan benar, berhubungan sebab akibat (A)',
                'both_correct_not_connected' => 'Pernyataan & alasan benar, TIDAK berhubungan (B)',
                'statement_true_reason_false' => 'Pernyataan benar, alasan salah (C)',
                'statement_false_reason_true' => 'Pernyataan salah, alasan benar (D)',
                'both_false' => 'Keduanya salah (E)'
            ];
            return $labels[$canonical] ?? (($answer !== null && $answer !== '') ? htmlspecialchars((string)$answer) : 'Tidak dijawab');
        }

        if ($type === 'scaled') {
            $opt = isset($q['options'][(int)$answer]) ? $q['options'][(int)$answer] : null;
            return $opt ? ($opt['text'] . ' (Poin: ' . $opt['score'] . ')') : 'Tidak dijawab';
        }

        return ($answer !== null && $answer !== '') ? htmlspecialchars((string)$answer) : 'Tidak dijawab';
    }

    public static function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}
