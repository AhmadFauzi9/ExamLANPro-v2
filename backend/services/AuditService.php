<?php
/**
 * ExamLAN Pro - Audit Logging Service
 */

class AuditService {
    public static function log(array &$db, string $action, string $target = '', string $detail = '', string $user = 'guru'): void {
        if (!isset($db['audit_logs']) || !is_array($db['audit_logs'])) {
            $db['audit_logs'] = [];
        }

        $db['audit_logs'][] = [
            'time' => date('c'),
            'user' => $user,
            'action' => $action,
            'target' => $target,
            'detail' => $detail
        ];

        if (count($db['audit_logs']) > MAX_AUDIT_LOGS) {
            $db['audit_logs'] = array_slice($db['audit_logs'], -MAX_AUDIT_LOGS);
        }
    }
}
