<?php
// backend/controllers/MonitoringController.php

require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Utils.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../services/Database.php';
require_once __DIR__ . '/../services/AuditService.php';
require_once __DIR__ . '/../services/ScoringEngine.php';

class MonitoringController {

    public static function dashboard() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();

        $quizMap = [];
        foreach ($db['questions'] as $q) {
            if (!empty($q['id'])) $quizMap[(string)$q['id']] = $q['title'] ?? $q['id'];
        }
        foreach ($db['trash']['questions'] ?? [] as $q) {
            $qid = (string)($q['id'] ?? '');
            if ($qid !== '' && empty($quizMap[$qid])) $quizMap[$qid] = $q['title'] ?? $qid;
        }
        foreach ($db['results'] ?? [] as $r) {
            $qid = (string)($r['code'] ?? $r['quiz_id'] ?? '');
            if ($qid !== '' && empty($quizMap[$qid]) && !empty($r['title'])) $quizMap[$qid] = $r['title'];
        }

        $backupDir = EXAMLAN_BACKUP_DIR;
        if (is_dir($backupDir)) {
            $bFiles = glob($backupDir . '/*.json');
            if ($bFiles) {
                foreach ($bFiles as $bf) {
                    $bc = @file_get_contents($bf);
                    if ($bc) {
                        $bd = json_decode($bc, true);
                        if (!empty($bd['questions']) && is_array($bd['questions'])) {
                            foreach ($bd['questions'] as $bq) {
                                $bqid = (string)($bq['id'] ?? '');
                                if ($bqid !== '' && empty($quizMap[$bqid]) && !empty($bq['title'])) {
                                    $quizMap[$bqid] = $bq['title'];
                                }
                            }
                        }
                    }
                }
            }
        }

        $fallbackTitles = [
            'quiz-1789790671156' => 'UB STS Ganjil Kelas 7',
            'quiz-1791161243662' => 'Soal STS Ganjil 2026-2027',
            'quiz-1791169015921' => 'Soal STS Ganjil 2026-2027',
            'quiz-1794792463299' => 'UB SAS GANJIL 2026-2027',
            'quiz-1794805923538' => 'UB SAS GANJIL 26-27'
        ];
        foreach ($fallbackTitles as $fId => $fTitle) {
            if (empty($quizMap[$fId])) $quizMap[$fId] = $fTitle;
        }

        $monitoring = [];
        $trackedAttemptKeys = [];
        $studentsWithAttempt = [];

        $db['student_sessions'] = $db['student_sessions'] ?? [];
        $db['active_attempts'] = $db['active_attempts'] ?? [];
        $db['time_extension_requests'] = $db['time_extension_requests'] ?? [];

        // Peta permintaan perpanjangan waktu yang sedang PENDING
        $pendingExtensionMap = [];
        foreach ($db['time_extension_requests'] as $req) {
            if (($req['status'] ?? '') === 'PENDING') {
                $th = (string)($req['token_hash'] ?? '');
                $rn = (string)($req['nis'] ?? '');
                if ($th !== '') $pendingExtensionMap[$th] = true;
                if ($rn !== '') $pendingExtensionMap[$rn] = true;
            }
        }

        // Hitung urutan attempt per siswa & per kuis (untuk mendeteksi pengerjaan remedial / attempt ke-2 dst)
        $attemptsByStudentQuiz = [];
        foreach ($db['active_attempts'] as $attKey => $a) {
            $aNis = (string)($a['nis'] ?? '');
            $qid = (string)($a['quiz_id'] ?? '');
            if ($aNis === '') continue;
            $sqKey = $aNis . '_' . $qid;
            if (!isset($attemptsByStudentQuiz[$sqKey])) {
                $attemptsByStudentQuiz[$sqKey] = [];
            }
            $attemptsByStudentQuiz[$sqKey][] = [
                'key' => $attKey,
                'started_at' => (int)($a['started_at'] ?? 0)
            ];
        }

        $attemptNumberMap = [];
        foreach ($attemptsByStudentQuiz as $sqKey => $list) {
            usort($list, fn($x, $y) => $x['started_at'] <=> $y['started_at']);
            foreach ($list as $idx => $item) {
                $attemptNumberMap[$item['key']] = [
                    'number' => $idx + 1,
                    'total' => count($list),
                    'is_retake' => ($idx > 0)
                ];
            }
        }

        // 1. Masukkan semua pengerjaan ujian (attempt) dari active_attempts
        // Menampilkan baik ujian utama maupun ujian ulang/remedial secara lengkap mandiri
        $cutoffTime = time() - (7 * 86400); // 7 hari terakhir
        foreach ($db['active_attempts'] as $attKey => $a) {
            $aNis = (string)($a['nis'] ?? '');
            if ($aNis === '') continue;

            $aStart = (int)($a['started_at'] ?? 0);
            $aUpdated = (int)($a['updated_at'] ?? $aStart);
            if ($aStart > 0 && $aStart < $cutoffTime && $aUpdated < $cutoffTime) {
                continue;
            }

            $qid = (string)($a['quiz_id'] ?? '');
            $title = (!empty($a['quiz_title']) && $a['quiz_title'] !== $qid) ? $a['quiz_title'] : ($quizMap[$qid] ?? ($qid !== '' ? $qid : '-'));
            $endsAt = (int)($a['ends_at'] ?? 0);

            // Sinkronkan data real-time dari student_sessions jika sesi aktif siswa mengarah ke attempt ini
            $sess = $db['student_sessions'][$aNis] ?? null;
            $isCurrentSession = ($sess && (($sess['attempt_token_hash'] ?? '') === $attKey || empty($sess['attempt_token_hash'])));
            $lastSeen = $isCurrentSession ? (int)($sess['last_seen'] ?? $aUpdated) : $aUpdated;
            $ip = $isCurrentSession ? (string)($sess['ip'] ?? ($a['ip'] ?? '')) : (string)($a['ip'] ?? '');
            $violationsCount = $isCurrentSession ? (int)($sess['violations_count'] ?? ($a['violations_count'] ?? 0)) : (int)($a['violations_count'] ?? 0);

            $status = 'WORKING';
            $statusLabel = 'Sedang Mengerjakan';

            if (!empty($a['finished']) || ($isCurrentSession && ($sess['status'] ?? '') === 'FINISHED')) {
                $status = 'FINISHED';
                $statusLabel = 'Selesai';
            } elseif ($endsAt > 0 && time() > $endsAt) {
                $status = 'TIME_OVER';
                $statusLabel = 'Waktu Habis';
            } elseif (time() - $lastSeen > 90) {
                $status = 'OFFLINE';
                $statusLabel = 'Terputus';
            }

            $ansCount = 0;
            $totalQ = count($a['question_order'] ?? []);
            if (!empty($a['answers']) && is_array($a['answers'])) {
                foreach ($a['answers'] as $ansVal) {
                    if ($ansVal !== null && $ansVal !== '' && $ansVal !== []) {
                        $ansCount++;
                    }
                }
            }

            $attMeta = $attemptNumberMap[$attKey] ?? ['number' => 1, 'total' => 1, 'is_retake' => false];

            $monitoring[] = [
                'attempt_id' => $attKey,
                'nis' => $aNis,
                'name' => (string)($a['name'] ?? ($sess['name'] ?? $aNis)),
                'class' => (string)($a['class'] ?? ($sess['class'] ?? '-')),
                'quiz_id' => $qid,
                'quiz_title' => $title,
                'attempt_number' => $attMeta['number'],
                'total_attempts' => $attMeta['total'],
                'is_retake' => $attMeta['is_retake'],
                'status' => $status,
                'status_label' => $statusLabel,
                'question' => $totalQ > 0 ? "{$ansCount} / {$totalQ}" : '-',
                'answered_count' => $ansCount,
                'total_questions' => $totalQ,
                'score' => $a['score'] ?? ($sess['score'] ?? null),
                'started_at' => $aStart,
                'ends_at' => $endsAt,
                'updated_at' => $lastSeen,
                'login_at' => (int)($sess['login_at'] ?? $aStart),
                'finished_at' => !empty($a['finished']) ? $aUpdated : 0,
                'time_remaining' => ($status === 'WORKING' && $endsAt > time()) ? ($endsAt - time()) : 0,
                'has_extension_request' => !empty($pendingExtensionMap[$attKey]) || !empty($pendingExtensionMap[$aNis]),
                'violations_count' => $violationsCount,
                'ip' => $ip
            ];

            $trackedAttemptKeys[$attKey] = true;
            if ($status === 'WORKING' || $status === 'OFFLINE') {
                $studentsWithAttempt[$aNis] = true;
            }
        }

        // 2. Sertakan siswa yang berstatus STANDBY (sudah login tapi belum mulai ujian / baru klik izinkan ujian)
        foreach ($db['student_sessions'] as $nisKey => $sess) {
            $sNis = (string)($sess['nis'] ?? $nisKey);
            if ($sNis === '') continue;

            $sessAttHash = (string)($sess['attempt_token_hash'] ?? '');
            if ($sessAttHash !== '' && isset($trackedAttemptKeys[$sessAttHash])) {
                continue;
            }

            // Jika siswa sudah memiliki attempt aktif yang sedang berjalan, jangan buat duplikat baris standby
            if (!empty($studentsWithAttempt[$sNis])) {
                continue;
            }

            $rawStatus = strtoupper((string)($sess['status'] ?? 'STANDBY'));
            if ($rawStatus === 'FINISHED' && $sessAttHash !== '') {
                continue;
            }

            $qid = (string)($sess['quiz_id'] ?? '');
            $title = (!empty($sess['quiz_title']) && $sess['quiz_title'] !== $qid) ? $sess['quiz_title'] : ($quizMap[$qid] ?? ($qid !== '' ? $qid : '-'));
            $lastSeen = (int)($sess['last_seen'] ?? ($sess['login_at'] ?? time()));
            $startedAt = (int)($sess['started_at'] ?? ($sess['login_at'] ?? 0));

            $status = 'STANDBY';
            $statusLabel = 'Login / Standby';
            if (time() - $lastSeen > 180) {
                $status = 'OFFLINE';
                $statusLabel = 'Terputus';
            }

            $monitoring[] = [
                'attempt_id' => '',
                'nis' => $sNis,
                'name' => (string)($sess['name'] ?? $sNis),
                'class' => (string)($sess['class'] ?? '-'),
                'quiz_id' => $qid,
                'quiz_title' => $title,
                'attempt_number' => 1,
                'total_attempts' => 1,
                'is_retake' => false,
                'status' => $status,
                'status_label' => $statusLabel,
                'question' => '-',
                'answered_count' => 0,
                'total_questions' => 0,
                'score' => $sess['score'] ?? null,
                'started_at' => $startedAt,
                'ends_at' => (int)($sess['ends_at'] ?? 0),
                'updated_at' => $lastSeen,
                'login_at' => (int)($sess['login_at'] ?? $startedAt),
                'finished_at' => (int)($sess['finished_at'] ?? 0),
                'time_remaining' => 0,
                'has_extension_request' => !empty($pendingExtensionMap[$sNis]),
                'ip' => (string)($sess['ip'] ?? ''),
                'violations_count' => (int)($sess['violations_count'] ?? 0)
            ];
        }

        // Urutkan peserta: aktivitas terbaru di atas
        usort($monitoring, function($a, $b) {
            return ($b['updated_at'] ?? 0) <=> ($a['updated_at'] ?? 0);
        });

        // Ringkasan jumlah per status
        $counts = [
            'total' => count($monitoring),
            'working' => 0,
            'standby' => 0,
            'finished' => 0,
            'offline' => 0,
            'time_over' => 0
        ];
        foreach ($monitoring as $item) {
            $st = $item['status'];
            if ($st === 'WORKING') $counts['working']++;
            elseif ($st === 'STANDBY') $counts['standby']++;
            elseif ($st === 'FINISHED') $counts['finished']++;
            elseif ($st === 'OFFLINE') $counts['offline']++;
            elseif ($st === 'TIME_OVER') $counts['time_over']++;
        }

        $scores = array_map(fn($r)=>(int)($r['score']??0), $db['results']);
        Response::json([
            'status' => 'success',
            'monitoring' => $monitoring,
            'counts' => $counts,
            'quizzes' => array_values(array_map(function($q) {
                return [
                    'id' => (string)($q['id'] ?? ''),
                    'title' => (string)($q['title'] ?? ''),
                    'pin' => (string)($q['pin'] ?? ''),
                    'pin_enabled' => !empty($q['pin']) && !empty($q['pin_enabled']),
                    'pin_auto_refresh' => !empty($q['pin']) && filter_var($q['pin_auto_refresh'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    'pin_updated_at' => (int)($q['pin_updated_at'] ?? 0),
                    'status' => (string)($q['status'] ?? 'ACTIVE')
                ];
            }, $db['questions'] ?? [])),
            'audit_logs' => array_slice(array_reverse($db['audit_logs']), 0, 200),
            'summary' => [
                'students' => count($db['students']),
                'quizzes' => count($db['questions']),
                'results' => count($db['results']),
                'average' => $scores ? (int)round(array_sum($scores)/count($scores)) : 0
            ]
        ]);
    }

    public static function reportViolation() {
        $input = Utils::getJsonInput();
        $token = (string)($input['attempt_token'] ?? '');
        $nisInput = trim((string)($input['nis'] ?? ''));
        $type = (string)($input['type'] ?? 'tab_switch');
        $details = (string)($input['details'] ?? 'Pindah tab / aplikasi');
        $db = Database::load();
        $key = Utils::attemptKey($token);
        $attempt = $db['active_attempts'][$key] ?? null;

        if (!$attempt && $nisInput !== '') {
            foreach ($db['active_attempts'] as $aKey => $a) {
                if ((string)($a['nis'] ?? '') === $nisInput && empty($a['finished'])) {
                    $key = $aKey;
                    $attempt = $a;
                    break;
                }
            }
        }

        $count = 0;
        $vLogItem = [
            'time' => date('d/m/Y H:i:s'),
            'timestamp' => time(),
            'type' => $type,
            'details' => $details,
            'count' => 0
        ];

        if ($attempt) {
            $count = (int)($db['active_attempts'][$key]['violations_count'] ?? 0) + 1;
            $vLogItem['count'] = $count;
            $db['active_attempts'][$key]['violations_count'] = $count;
            $db['active_attempts'][$key]['last_violation_at'] = time();
            $db['active_attempts'][$key]['last_violation_type'] = $type;
            if (!isset($db['active_attempts'][$key]['violations_log'])) $db['active_attempts'][$key]['violations_log'] = [];
            $db['active_attempts'][$key]['violations_log'][] = $vLogItem;
            if (count($db['active_attempts'][$key]['violations_log']) > 200) {
                $db['active_attempts'][$key]['violations_log'] = array_slice($db['active_attempts'][$key]['violations_log'], -200);
            }

            $nis = (string)($attempt['nis'] ?? $nisInput);
            if ($nis !== '' && isset($db['student_sessions'][$nis])) {
                $db['student_sessions'][$nis]['violations_count'] = $count;
                $db['student_sessions'][$nis]['last_violation_at'] = time();
                $db['student_sessions'][$nis]['last_violation_type'] = $type;
                if (!isset($db['student_sessions'][$nis]['violations_log'])) $db['student_sessions'][$nis]['violations_log'] = [];
                $db['student_sessions'][$nis]['violations_log'][] = $vLogItem;
                if (count($db['student_sessions'][$nis]['violations_log']) > 200) {
                    $db['student_sessions'][$nis]['violations_log'] = array_slice($db['student_sessions'][$nis]['violations_log'], -200);
                }
            }
            $name = (string)($attempt['name'] ?? ($db['student_sessions'][$nis]['name'] ?? $nis));
            AuditService::log($db, 'Peringatan Kecurangan', "Siswa {$name} (NIS: {$nis}) terdeteksi: {$details} (ke-{$count})");
            Database::save($db);
        } elseif ($nisInput !== '' && isset($db['student_sessions'][$nisInput])) {
            $count = (int)($db['student_sessions'][$nisInput]['violations_count'] ?? 0) + 1;
            $vLogItem['count'] = $count;
            $db['student_sessions'][$nisInput]['violations_count'] = $count;
            $db['student_sessions'][$nisInput]['last_violation_at'] = time();
            $db['student_sessions'][$nisInput]['last_violation_type'] = $type;
            if (!isset($db['student_sessions'][$nisInput]['violations_log'])) $db['student_sessions'][$nisInput]['violations_log'] = [];
            $db['student_sessions'][$nisInput]['violations_log'][] = $vLogItem;
            if (count($db['student_sessions'][$nisInput]['violations_log']) > 200) {
                $db['student_sessions'][$nisInput]['violations_log'] = array_slice($db['student_sessions'][$nisInput]['violations_log'], -200);
            }
            $name = (string)($db['student_sessions'][$nisInput]['name'] ?? $nisInput);
            AuditService::log($db, 'Peringatan Kecurangan', "Siswa {$name} (NIS: {$nisInput}) terdeteksi: {$details} (ke-{$count})");
            Database::save($db);
        }
        Response::json(['status' => 'success', 'violations_count' => $count]);
    }

    public static function getStudentViolations() {
        AuthMiddleware::teacherOnly();
        $nis = trim((string)($_GET['nis'] ?? ''));
        if ($nis === '') {
            Response::error('NIS tidak valid', 400);
        }
        $db = Database::load();
        
        $name = $nis;
        $class = '-';
        $quizTitle = '-';
        $violationsCount = 0;
        $violations = [];

        // 1. Dari student_sessions
        if (isset($db['student_sessions'][$nis])) {
            $st = $db['student_sessions'][$nis];
            $name = (string)($st['name'] ?? $name);
            $class = (string)($st['class'] ?? $class);
            $quizTitle = (string)($st['quiz_title'] ?? $quizTitle);
            $violationsCount = (int)($st['violations_count'] ?? 0);
            if (!empty($st['violations_log']) && is_array($st['violations_log'])) {
                $violations = $st['violations_log'];
            }
        }

        // 2. Dari active_attempts
        foreach (($db['active_attempts'] ?? []) as $att) {
            if ((string)($att['nis'] ?? '') === $nis) {
                $name = (string)($att['name'] ?? $name);
                $class = (string)($att['class'] ?? $class);
                $quizTitle = (string)($att['quiz_title'] ?? $quizTitle);
                $violationsCount = max($violationsCount, (int)($att['violations_count'] ?? 0));
                if (!empty($att['violations_log']) && is_array($att['violations_log'])) {
                    foreach ($att['violations_log'] as $vl) {
                        $violations[] = $vl;
                    }
                }
            }
        }

        // 3. Fallback nama dari master data students
        if ($name === $nis) {
            foreach (($db['students'] ?? []) as $s) {
                if ((string)($s['nis'] ?? '') === $nis) {
                    $name = (string)($s['name'] ?? $name);
                    $class = (string)($s['class'] ?? $class);
                    break;
                }
            }
        }

        // 4. Dari audit_logs
        $auditLogs = $db['audit_logs'] ?? [];
        $nisPattern = '(NIS: ' . $nis . ')';
        foreach ($auditLogs as $a) {
            if (($a['action'] ?? '') === 'Peringatan Kecurangan' && strpos((string)($a['target'] ?? ''), $nisPattern) !== false) {
                $target = (string)$a['target'];
                $details = $target;
                $count = null;
                if (preg_match('/terdeteksi:\s*(.+?)(?:\s*\(ke-(\d+)\))?$/i', $target, $m)) {
                    $details = trim($m[1]);
                    $count = isset($m[2]) ? (int)$m[2] : null;
                }
                $t = $a['time'] ?? '';
                $timeFormatted = $t ? date('d/m/Y H:i:s', strtotime($t)) : '-';
                $type = 'other';
                if (stripos($details, 'layar penuh') !== false || stripos($details, 'fullscreen') !== false) {
                    $type = 'fullscreen_exit';
                } elseif (stripos($details, 'pindah tab') !== false || stripos($details, 'minimalkan') !== false) {
                    $type = 'tab_switch';
                } elseif (stripos($details, 'fokus') !== false || stripos($details, 'aplikasi') !== false) {
                    $type = 'window_blur';
                } elseif (stripos($details, 'pintasan') !== false || stripos($details, 'shortcut') !== false) {
                    $type = 'blocked_shortcut';
                } elseif (stripos($details, 'klik kanan') !== false) {
                    $type = 'contextmenu';
                }

                $violations[] = [
                    'time' => $timeFormatted,
                    'timestamp' => $t ? strtotime($t) : 0,
                    'type' => $type,
                    'details' => $details,
                    'count' => $count
                ];
            }
        }

        // Deduplikasi catatan
        $unique = [];
        $seen = [];
        foreach ($violations as $v) {
            $sig = ($v['time'] ?? '') . '|' . ($v['details'] ?? '') . '|' . ($v['count'] ?? '');
            if (!isset($seen[$sig])) {
                $seen[$sig] = true;
                $unique[] = $v;
            }
        }

        // Urutkan waktu terbaru di atas
        usort($unique, function($a, $b) {
            $tA = (int)($a['timestamp'] ?? 0);
            $tB = (int)($b['timestamp'] ?? 0);
            if ($tA === $tB) {
                return ($b['count'] ?? 0) - ($a['count'] ?? 0);
            }
            return $tB - $tA;
        });

        if ($violationsCount <= 0) {
            $violationsCount = count($unique);
        }

        Response::json([
            'status' => 'success',
            'nis' => $nis,
            'name' => $name,
            'class' => $class,
            'quiz_title' => $quizTitle,
            'violations_count' => $violationsCount,
            'violations' => $unique
        ]);
    }

    public static function resetStudentViolations() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        if ($nis === '') {
            Response::error('NIS tidak valid', 400);
        }
        $db = Database::load();
        if (isset($db['student_sessions'][$nis])) {
            $db['student_sessions'][$nis]['violations_count'] = 0;
            $db['student_sessions'][$nis]['violations_log'] = [];
        }
        foreach ($db['active_attempts'] as &$att) {
            if ((string)($att['nis'] ?? '') === $nis) {
                $att['violations_count'] = 0;
                $att['violations_log'] = [];
            }
        }
        unset($att);
        AuditService::log($db, 'Reset Pelanggaran', "NIS: {$nis}", "Jumlah pelanggaran direset ke 0 oleh guru");
        Database::save($db);
        Response::json(['status'=>'success','message'=>'Riwayat pelanggaran siswa berhasil direset.']);
    }

    public static function resetStudentSession() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $attemptId = trim((string)($input['attempt_id'] ?? ''));
        $db = Database::load();
        $stName = $nis;

        if ($attemptId !== '' && isset($db['active_attempts'][$attemptId])) {
            $db['active_attempts'][$attemptId]['reset_allowed'] = true;
            if ($nis === '') $nis = (string)($db['active_attempts'][$attemptId]['nis'] ?? '');
            $stName = $db['active_attempts'][$attemptId]['name'] ?? $stName;
        }

        if (isset($db['student_sessions'][$nis])) {
            $stName = $db['student_sessions'][$nis]['name'] ?? $stName;
            $db['student_sessions'][$nis]['reset_allowed'] = true;
            $db['student_sessions'][$nis]['is_locked'] = false;
            $db['student_sessions'][$nis]['status'] = 'STANDBY';
            $db['student_sessions'][$nis]['last_seen'] = time();
        }

        foreach ($db['active_attempts'] as $ak => &$av) {
            if ((string)($av['nis'] ?? '') === $nis && empty($av['finished'])) {
                $av['reset_allowed'] = true;
            }
        }
        unset($av);

        AuditService::log($db, 'Reset sesi siswa', "{$nis} - {$stName}", 'Kunci sesi dibuka agar siswa dapat login ulang tanpa kehilangan jawaban');
        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => "Sesi siswa {$stName} ({$nis}) berhasil direset. Siswa dapat login kembali dari komputer lab dan langsung melanjutkan ujian dari nomor terakhir tanpa kehilangan jawaban."
        ]);
    }

    public static function forceFinishStudentSession() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $attemptId = trim((string)($input['attempt_id'] ?? ''));
        $db = Database::load();

        $matchedAttempt = null;
        $matchedKey = null;

        if ($attemptId !== '' && isset($db['active_attempts'][$attemptId])) {
            $cand = $db['active_attempts'][$attemptId];
            if ((string)($cand['nis'] ?? '') === $nis || $nis === '') {
                $matchedAttempt = $cand;
                $matchedKey = $attemptId;
                if ($nis === '') $nis = (string)($cand['nis'] ?? '');
            }
        }

        if (!$matchedAttempt) {
            foreach ($db['active_attempts'] as $ak => $cand) {
                if ((string)($cand['nis'] ?? '') === $nis && empty($cand['finished'])) {
                    $matchedAttempt = $cand;
                    $matchedKey = $ak;
                    break;
                }
            }
        }

        if (!$matchedAttempt) {
            Response::notFound('Tidak ditemukan sesi ujian aktif yang sedang berjalan untuk siswa ini.');
        }

        $quizId = (string)$matchedAttempt['quiz_id'];
        $quiz = null;
        foreach ($db['questions'] as $q) {
            if ((string)($q['id'] ?? '') === $quizId) { $quiz = $q; break; }
        }
        if (!$quiz) {
            Response::notFound('Data paket kuis tidak ditemukan.');
        }

        $questionOrder = $matchedAttempt['question_order'];
        $answers = Utils::normalizeAnswers($matchedAttempt['answers'] ?? []);
        foreach ($answers as $position => &$answer) {
            $qid = $questionOrder[(int)$position] ?? null;
            $q = ($qid !== null && isset($quiz['questions'][$qid])) ? $quiz['questions'][$qid] : null;
            $qType = $q['type'] ?? 'mc';
            $map = $matchedAttempt['option_order'][$qid] ?? [];
            if (!empty($map)) {
                if ($qType === 'complex' && is_array($answer)) {
                    $answer = array_values(array_filter(array_map(fn($v) => $map[(int)$v] ?? null, $answer), fn($v) => $v !== null));
                } elseif (($qType === 'mc' || $qType === 'case_analysis' || is_numeric($answer)) && isset($map[(int)$answer])) {
                    $answer = $map[(int)$answer];
                }
            }
        }
        unset($answer);

        [$score, $correct, $wrong, $breakdowns] = ScoringEngine::calculateSubmission($quiz, $questionOrder, $answers);
        $token = bin2hex(random_bytes(32));
        $recordId = 'res_' . bin2hex(random_bytes(16));
        $record = [
            'id' => $recordId,
            'nis' => $nis,
            'name' => (string)$matchedAttempt['name'],
            'class' => (string)$matchedAttempt['class'],
            'code' => $quizId,
            'title' => (string)($quiz['title'] ?? ''),
            'score' => $score,
            'correct' => $correct,
            'wrong' => $wrong,
            'date' => date('d/m/Y H:i:s'),
            'review_token' => $token,
            'question_order' => $questionOrder,
            'answers' => $answers,
            'breakdowns' => $breakdowns,
            'submitted_by' => 'Guru Pengawas (Selesai Paksa)'
        ];
        array_unshift($db['results'], $record);

        $db['active_attempts'][$matchedKey]['finished'] = true;
        $db['active_attempts'][$matchedKey]['score'] = $score;

        if (isset($db['student_sessions'][$nis])) {
            if (empty($db['student_sessions'][$nis]['attempt_token_hash']) || $db['student_sessions'][$nis]['attempt_token_hash'] === $matchedKey) {
                $db['student_sessions'][$nis]['status'] = 'FINISHED';
                $db['student_sessions'][$nis]['finished_at'] = time();
                $db['student_sessions'][$nis]['score'] = $score;
            }
        }

        AuditService::log($db, 'Selesaikan paksa ujian', "{$nis} - " . (string)$matchedAttempt['name'], "Diselesaikan oleh guru pengawas. Nilai: {$score}");
        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => "Ujian siswa {$matchedAttempt['name']} ({$nis}) berhasil dikumpulkan paksa. Nilai akhir: {$score}."
        ]);
    }

    public static function deleteStudentSession() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $nis = trim((string)($input['nis'] ?? ''));
        $attemptId = trim((string)($input['attempt_id'] ?? ''));
        if ($nis === '' && $attemptId === '') {
            Response::error('Identitas sesi siswa tidak valid.', 400);
        }

        $db = Database::load();
        $studentName = $nis;

        if ($attemptId !== '') {
            // Hapus HANYA attempt spesifik ini
            if (isset($db['active_attempts'][$attemptId])) {
                $studentName = $db['active_attempts'][$attemptId]['name'] ?? $studentName;
                if ($nis === '') $nis = (string)($db['active_attempts'][$attemptId]['nis'] ?? '');
                unset($db['active_attempts'][$attemptId]);
            }
            if (isset($db['student_sessions'][$nis]) && ($db['student_sessions'][$nis]['attempt_token_hash'] ?? '') === $attemptId) {
                unset($db['student_sessions'][$nis]);
            }
            AuditService::log($db, 'Hapus sesi attempt monitoring', "{$nis} - {$studentName}", "Attempt {$attemptId} dihapus dari monitoring");
        } else {
            // Hapus seluruh sesi monitoring siswa ini
            if (isset($db['student_sessions'][$nis])) {
                $studentName = $db['student_sessions'][$nis]['name'] ?? $nis;
                unset($db['student_sessions'][$nis]);
            }

            foreach ($db['active_attempts'] as $ak => $av) {
                if ((string)($av['nis'] ?? '') === $nis) {
                    if ($studentName === $nis && !empty($av['name'])) {
                        $studentName = $av['name'];
                    }
                    unset($db['active_attempts'][$ak]);
                }
            }

            if (isset($db['time_extension_requests'][$nis])) {
                unset($db['time_extension_requests'][$nis]);
            }
            AuditService::log($db, 'Hapus sesi monitoring', "{$nis} - {$studentName}", 'Dihapus dari layar monitoring');
        }

        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => "Sesi monitoring siswa {$studentName} ({$nis}) berhasil dihapus."
        ]);
    }

    public static function deleteStudentSessions() {
        AuthMiddleware::teacherOnly();
        $input = Utils::getJsonInput();
        $items = $input['items'] ?? $input['nis_list'] ?? [];
        if (!is_array($items) || empty($items)) {
            Response::error('Tidak ada siswa yang dipilih.', 400);
        }

        $db = Database::load();
        $deletedCount = 0;

        foreach ($items as $item) {
            $nis = '';
            $attemptId = '';
            if (is_array($item)) {
                $nis = trim((string)($item['nis'] ?? ''));
                $attemptId = trim((string)($item['attempt_id'] ?? ''));
            } else {
                $raw = trim((string)$item);
                if (strpos($raw, '::') !== false) {
                    [$nis, $attemptId] = explode('::', $raw, 2);
                } else {
                    $nis = $raw;
                }
            }

            if ($nis === '' && $attemptId === '') continue;

            if ($attemptId !== '') {
                if (isset($db['active_attempts'][$attemptId])) {
                    unset($db['active_attempts'][$attemptId]);
                    $deletedCount++;
                }
                if ($nis !== '' && isset($db['student_sessions'][$nis]) && ($db['student_sessions'][$nis]['attempt_token_hash'] ?? '') === $attemptId) {
                    unset($db['student_sessions'][$nis]);
                }
            } else {
                if (isset($db['student_sessions'][$nis])) {
                    unset($db['student_sessions'][$nis]);
                    $deletedCount++;
                }
                foreach ($db['active_attempts'] as $ak => $av) {
                    if ((string)($av['nis'] ?? '') === $nis) {
                        unset($db['active_attempts'][$ak]);
                        $deletedCount++;
                    }
                }
                if (isset($db['time_extension_requests'][$nis])) {
                    unset($db['time_extension_requests'][$nis]);
                }
            }
        }

        AuditService::log($db, 'Hapus sesi monitoring terpilih', "{$deletedCount} pengerjaan/sesi siswa dihapus");
        Database::save($db);
        Response::json([
            'status' => 'success',
            'message' => "{$deletedCount} data monitoring siswa berhasil dihapus."
        ]);
    }

    public static function clearStudentSessions() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $db['student_sessions'] = [];
        foreach ($db['active_attempts'] as $ak => $av) {
            if (!empty($av['finished']) || (int)($av['ends_at'] ?? 0) < time()) {
                unset($db['active_attempts'][$ak]);
            }
        }
        AuditService::log($db, 'Bersihkan sesi monitoring', 'Semua siswa', 'Oleh guru');
        Database::save($db);
        Response::json(['status' => 'success', 'message' => 'Semua riwayat monitoring berhasil dibersihkan.']);
    }

    public static function examAnalytics() {
        AuthMiddleware::teacherOnly();
        $db = Database::load();
        $quizId = trim((string)($_GET['quiz_id'] ?? ''));
        $results = array_values(array_filter($db['results'], fn($r) => $quizId === '' || (string)($r['code'] ?? '') === $quizId));
        $scores = array_map(fn($r)=>(int)($r['score']??0), $results);
        $distribution = ['0-59'=>0,'60-69'=>0,'70-79'=>0,'80-89'=>0,'90-100'=>0];
        foreach ($scores as $s) {
            $distribution[$s<60?'0-59':($s<70?'60-69':($s<80?'70-79':($s<90?'80-89':'90-100')))]++;
        }
        $questions = [];
        foreach ($results as $r) {
            foreach (($r['breakdowns'] ?? []) as $i => $b) {
                $key = (string)($b['question']['id'] ?? ($r['code'] . '-' . $i));
                if (!isset($questions[$key])) {
                    $questions[$key] = [
                        'number' => $i + 1,
                        'question' => $b['question']['question'] ?? $b['question']['statement'] ?? 'Soal',
                        'correct' => 0,
                        'total' => 0,
                        'options' => [],
                        'key' => $b['correctAnswerText'] ?? '-'
                    ];
                }
                $questions[$key]['total']++;
                if (!empty($b['isCorrect'])) $questions[$key]['correct']++;
                $answer = $b['studentAnswerText'] ?? 'Tidak dijawab';
                $questions[$key]['options'][$answer] = ($questions[$key]['options'][$answer] ?? 0) + 1;
            }
        }
        Response::json([
            'status' => 'success',
            'summary' => [
                'participants' => count($results),
                'average' => $scores ? (int)round(array_sum($scores) / count($scores)) : 0,
                'highest' => $scores ? max($scores) : 0,
                'lowest' => $scores ? min($scores) : 0,
                'distribution' => $distribution
            ],
            'questions' => array_values($questions)
        ]);
    }
}
