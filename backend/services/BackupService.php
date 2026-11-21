<?php
/**
 * ExamLAN Pro - Backup Service
 */

class BackupService {
    /**
     * Membuat berkas cadangan database ke folder backups dan mencatatnya ke $db
     */
    public static function createBackup(string $reason = 'manual', ?string $fileDb = null, ?array &$db = null): ?string {
        $fileDb = $fileDb ?: EXAMLAN_DB_FILE;
        $dir = EXAMLAN_BACKUP_DIR;
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }

        $name = 'examlan-' . date('Ymd-His') . '-' . preg_replace('/[^a-z0-9_-]/i', '-', $reason) . '.json';
        $dest = $dir . '/' . $name;

        if (file_exists($fileDb) && @copy($fileDb, $dest)) {
            $record = [
                'file' => $name,
                'name' => $name,
                'time' => date('c'),
                'size' => filesize($dest),
                'reason' => $reason
            ];
            if ($db !== null) {
                $db['backups'] = $db['backups'] ?? [];
                $db['backups'][] = $record;
            }
            return $name;
        }
        return null;
    }

    /**
     * Membaca dan menyinkronkan seluruh berkas cadangan dari folder EXAMLAN_BACKUP_DIR
     */
    public static function getBackupsList(?array &$db = null): array {
        $dir = EXAMLAN_BACKUP_DIR;
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }

        $diskFiles = [];
        $files = glob($dir . '/examlan-*.json');
        if ($files) {
            foreach ($files as $f) {
                $base = basename($f);
                $diskFiles[$base] = [
                    'file' => $base,
                    'name' => $base,
                    'time' => date('c', filemtime($f)),
                    'size' => filesize($f),
                    'reason' => self::detectReason($base)
                ];
            }
        }

        $merged = [];
        if ($db !== null && !empty($db['backups']) && is_array($db['backups'])) {
            foreach ($db['backups'] as $b) {
                $fn = $b['file'] ?? $b['name'] ?? '';
                if ($fn !== '' && isset($diskFiles[$fn])) {
                    $merged[$fn] = array_merge($diskFiles[$fn], $b);
                    unset($diskFiles[$fn]);
                }
            }
        }

        foreach ($diskFiles as $fn => $info) {
            $merged[$fn] = $info;
        }

        // Urutkan berdasarkan waktu file ascending
        uasort($merged, function($a, $b) {
            return strcmp($a['file'], $b['file']);
        });

        $finalList = array_values($merged);
        if ($db !== null) {
            $db['backups'] = $finalList;
        }
        return $finalList;
    }

    private static function detectReason(string $filename): string {
        if (preg_match('/examlan-\d+-\d+-(.+)\.json$/i', $filename, $m)) {
            return str_replace('-', ' ', $m[1]);
        }
        return 'manual';
    }
}
