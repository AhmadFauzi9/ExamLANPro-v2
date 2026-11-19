<?php
// backend/Router.php

require_once __DIR__ . '/helpers/Response.php';
require_once __DIR__ . '/controllers/TeacherAuthController.php';
require_once __DIR__ . '/controllers/StudentAuthController.php';
require_once __DIR__ . '/controllers/ExamAttemptController.php';
require_once __DIR__ . '/controllers/MonitoringController.php';
require_once __DIR__ . '/controllers/TimeExtensionController.php';
require_once __DIR__ . '/controllers/QuizManagementController.php';
require_once __DIR__ . '/controllers/StudentManagementController.php';
require_once __DIR__ . '/controllers/ResultManagementController.php';
require_once __DIR__ . '/controllers/ReviewController.php';
require_once __DIR__ . '/controllers/SystemController.php';

class Router {

    /**
     * Route mapping action -> [ControllerClass, methodName]
     */
    protected static array $routes = [
        // Teacher Auth
        'teacher_login'               => [TeacherAuthController::class, 'login'],
        'change_teacher_password'     => [TeacherAuthController::class, 'changePassword'],
        'teacher_logout'              => [TeacherAuthController::class, 'logout'],
        'teacher_status'              => [TeacherAuthController::class, 'status'],
        'check_session'               => [TeacherAuthController::class, 'status'],

        // Student Auth & Public
        'student_login'               => [StudentAuthController::class, 'login'],
        'get_student_data'            => [StudentAuthController::class, 'getStudentData'],
        'get_public_settings'         => [StudentAuthController::class, 'getPublicSettings'],
        'check_attempt'               => [StudentAuthController::class, 'checkAttempt'],

        // Exam Attempts
        'start_attempt'               => [ExamAttemptController::class, 'startAttempt'],
        'get_attempt'                 => [ExamAttemptController::class, 'getAttempt'],
        'student_heartbeat'           => [ExamAttemptController::class, 'heartbeat'],
        'save_attempt_answers'        => [ExamAttemptController::class, 'saveAnswers'],
        'submit_result'               => [ExamAttemptController::class, 'submitResult'],

        // Monitoring
        'teacher_dashboard'           => [MonitoringController::class, 'dashboard'],
        'report_student_violation'    => [MonitoringController::class, 'reportViolation'],
        'get_student_violations'      => [MonitoringController::class, 'getStudentViolations'],
        'reset_student_violations'    => [MonitoringController::class, 'resetStudentViolations'],
        'reset_student_session'       => [MonitoringController::class, 'resetStudentSession'],
        'force_finish_student_session'=> [MonitoringController::class, 'forceFinishStudentSession'],
        'delete_student_session'      => [MonitoringController::class, 'deleteStudentSession'],
        'delete_student_sessions'     => [MonitoringController::class, 'deleteStudentSessions'],
        'clear_student_sessions'      => [MonitoringController::class, 'clearStudentSessions'],
        'exam_analytics'              => [MonitoringController::class, 'examAnalytics'],

        // Time Extensions
        'request_extension'           => [TimeExtensionController::class, 'request'],
        'check_extension_requests'    => [TimeExtensionController::class, 'checkRequests'],
        'approve_extension'           => [TimeExtensionController::class, 'approve'],
        'reject_extension'            => [TimeExtensionController::class, 'reject'],
        'clear_extension_history'     => [TimeExtensionController::class, 'clearHistory'],
        'check_extension_status'      => [TimeExtensionController::class, 'checkStatus'],

        // Quiz Management
        'get_data'                    => [QuizManagementController::class, 'getData'],
        'save_questions'              => [QuizManagementController::class, 'saveQuestions'],
        'import_questions_file'       => [QuizManagementController::class, 'importQuestionsFile'],
        'allow_retake'                => [QuizManagementController::class, 'allowRetake'],

        // Student Management
        'get_students'                => [StudentManagementController::class, 'getStudents'],
        'save_student'                => [StudentManagementController::class, 'saveStudent'],
        'update_student'              => [StudentManagementController::class, 'saveStudent'],
        'delete_student'              => [StudentManagementController::class, 'deleteStudent'],
        'delete_students'             => [StudentManagementController::class, 'deleteStudent'],
        'import_students'             => [StudentManagementController::class, 'importStudents'],

        // Result Management
        'delete_result'               => [ResultManagementController::class, 'deleteResult'],
        'delete_results'              => [ResultManagementController::class, 'deleteResults'],
        'clear_results'               => [ResultManagementController::class, 'clearResults'],
        'get_result_detail'           => [ResultManagementController::class, 'getResultDetail'],

        // Review
        'get_review'                  => [ReviewController::class, 'getReview'],
        'set_review_state'            => [ReviewController::class, 'setReviewState'],
        'get_review_states'           => [ReviewController::class, 'getReviewStates'],

        // System
        'save_system_settings'        => [SystemController::class, 'saveSettings'],
        'system_status'               => [SystemController::class, 'status'],
        'get_trash'                   => [SystemController::class, 'getTrash'],
        'restore_trash'               => [SystemController::class, 'restoreTrash'],
        'create_backup'               => [SystemController::class, 'createBackup'],
        'delete_backup'               => [SystemController::class, 'deleteBackup'],
    ];

    /**
     * Dispatch the current request
     */
    public static function dispatch() {
        $action = trim((string)($_GET['action'] ?? $_POST['action'] ?? ''));

        if ($action === '' || !isset(self::$routes[$action])) {
            Response::notFound('Aksi API tidak ditemukan.');
        }

        [$controller, $method] = self::$routes[$action];

        if (!is_callable([$controller, $method])) {
            Response::error('Handler aksi API tidak tersedia.', 500);
        }

        call_user_func([$controller, $method]);
    }
}
