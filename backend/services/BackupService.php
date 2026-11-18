<?php
/**
 * ExamLAN Pro - Backup Service
 */

class BackupService {
    public static function createBackup(string $reason = 'manual', ?string $fileDb = null, ?array &$db = null): ?string {
        $fileDb = $fileDb ?: EXAMLAN_DB_FILE;
        $dir = EXAMLAN_BACKUP_DIR;
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }

        $name = 'examlan-' . date('Ymd-His') . '-' . preg_replace('/[^a-z0-9_-]/i', '-', $reason) . '.json';
        $dest = $dir . '/' . $name;

        if (file_exists($fileDb) && @copy($fileDb, $dest)) {
            if ($db !== null) {
                $db['backups'] = $db['backups'] ?? [];
                $db['backups'][] = [
                    'file' => $name,
                    'time' => date('c'),
                    'reason' => $reason
                ];
            }
            return $name;
        }
        return null;
    }
}
