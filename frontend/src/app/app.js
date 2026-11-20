/**
 * ExamLAN Pro - Application Bootstrap & Controller
 */

import { StudentContext } from '../context/StudentContext.js';
import { ExamContext } from '../context/ExamContext.js';
import { Storage } from '../utils/storage.js';
import { authApi } from '../api/authApi.js';

// Hooks
import {
    initAntiCheat,
    resumeFullScreenAndExam,
    activateFullScreenFromOverlay,
    handleKioskShortcut,
    closeKioskModalAndContinue,
    exitKioskMode,
    checkAndEnforceFullScreen
} from '../hooks/useAntiCheat.js';
import { initAutoSaveNetworkListener } from '../hooks/useAutoSave.js';
import { initGlobalTooltipSystem } from '../hooks/useTooltip.js';

// Components
import { initHeader, updateNavbarStudentProfile } from '../components/common/Header.js';
import { appAlert, appConfirm, closeAppModal, resolveAppModal, promptReloadExam, closeConfirmReloadModal } from '../components/common/Modal.js';
import { showToast } from '../components/common/Toast.js';
import { initViolationOverlay } from '../components/common/ViolationOverlay.js';
import {
    handleNisInput,
    handleStudentLogin,
    toggleStudentLoginPassword,
    populateQuizDropdowns
} from '../components/auth/LoginCard.js';
import {
    renderExamInfoScreen,
    backToStudentLogin,
    submitExamTokenAndStart,
    restorePendingStudentSessionAfterRefresh
} from '../components/auth/ExamInfoCard.js';
import {
    showResumeTokenScreen,
    cancelResumeTokenScreen,
    submitResumeToken,
    restorePendingResumeSessionAfterRefresh
} from '../components/auth/ResumeTokenModal.js';
import {
    restoreActiveAttemptAfterRefresh,
    executeLiveReload,
    executeHardBrowserReload
} from '../components/quiz/QuizScreen.js';
import {
    saveStudentAnswer,
    saveComplexAnswer,
    saveMatchingAnswer
} from '../components/quiz/OptionRenderer.js';
import { jumpToQuestion } from '../components/quiz/QuestionPalette.js';
import { navigateQuestion, confirmSubmitQuiz } from '../components/quiz/QuizNavigation.js';
import { requestTimeExtension, submitFinalTimeOut } from '../components/quiz/TimeoutOverlay.js';
import {
    renderResultScreen,
    restoreStudentResultAfterRefresh,
    resetStudentView
} from '../components/result/ResultScreen.js';

// Expose functions globally for backward-compatibility with inline HTML attributes
window.handleNisInput = handleNisInput;
window.handleStudentLogin = handleStudentLogin;
window.toggleStudentLoginPassword = toggleStudentLoginPassword;
window.backToStudentLogin = backToStudentLogin;
window.submitExamTokenAndStart = submitExamTokenAndStart;
window.showResumeTokenScreen = showResumeTokenScreen;
window.cancelResumeTokenScreen = cancelResumeTokenScreen;
window.submitResumeToken = submitResumeToken;
window.promptReloadExam = promptReloadExam;
window.closeConfirmReloadModal = closeConfirmReloadModal;
window.executeLiveReload = executeLiveReload;
window.executeHardBrowserReload = executeHardBrowserReload;
window.navigateQuestion = navigateQuestion;
window.jumpToQuestion = jumpToQuestion;
window.saveStudentAnswer = saveStudentAnswer;
window.saveComplexAnswer = saveComplexAnswer;
window.saveMatchingAnswer = saveMatchingAnswer;
window.confirmSubmitQuiz = confirmSubmitQuiz;
window.requestTimeExtension = requestTimeExtension;
window.submitFinalTimeOut = submitFinalTimeOut;
window.resumeFullScreenAndExam = resumeFullScreenAndExam;
window.activateFullScreenFromOverlay = activateFullScreenFromOverlay;
window.handleKioskShortcut = handleKioskShortcut;
window.closeKioskModalAndContinue = closeKioskModalAndContinue;
window.exitKioskMode = exitKioskMode;
window.resetStudentView = resetStudentView;
window.appAlert = appAlert;
window.appConfirm = appConfirm;
window.closeAppModal = closeAppModal;
window.resolveAppModal = resolveAppModal;
window.showToast = showToast;

/**
 * Fetch and populate base student and quiz data
 */
export async function fetchDataFromAPI() {
    try {
        const res = await authApi.getStudentData();
        if (!res.ok || !res.data) throw new Error('Gagal mengambil data ujian');

        const data = res.data;
        ExamContext.setQuizzes(data.questions || []);
        StudentContext.setRegisteredStudents(data.students || []);

        // Cek pengaturan apakah login siswa mewajibkan password
        const reqPassword = data.settings?.require_student_password !== false;
        StudentContext.setRequirePassword(reqPassword);

        const passContainer = document.getElementById('student-password-container');
        const passInput = document.getElementById('student-auth-code');
        if (passContainer && passInput) {
            if (!reqPassword) {
                passContainer.classList.add('hidden');
                passInput.removeAttribute('required');
            } else {
                passContainer.classList.remove('hidden');
                passInput.setAttribute('required', 'required');
            }
        }

        const nisEl = document.getElementById('student-nis');
        if (nisEl && nisEl.value) {
            handleNisInput(nisEl);
        }

        populateQuizDropdowns();
    } catch (error) {
        console.error('Gagal mengambil data ujian:', error);
    }
}

window.fetchDataFromAPI = fetchDataFromAPI;

/**
 * Main application initialization
 */
export async function initApp() {
    // 1. Inisialisasi sub-sistem
    initHeader();
    initGlobalTooltipSystem();
    initAutoSaveNetworkListener();
    initViolationOverlay();

    // 2. Sembunyikan login card lebih awal jika siswa memiliki sesi aktif (pengerjaan kuis / informasi ujian)
    try {
        const activeAttempt = Storage.getActiveAttempt();
        const pendingInfo = Storage.getPendingExamInfo();
        const pendingResume = Storage.getPendingResumeInfo();

        if (activeAttempt) {
            document.getElementById('student-login-card')?.classList.add('hidden');
            document.getElementById('student-quiz-screen')?.classList.remove('hidden');
            if (activeAttempt.name || activeAttempt.nis) {
                updateNavbarStudentProfile(activeAttempt.name, activeAttempt.nis, activeAttempt.classId);
            }
        } else if (pendingInfo) {
            document.getElementById('student-login-card')?.classList.add('hidden');
            document.getElementById('student-exam-info-screen')?.classList.remove('hidden');
            if (pendingInfo.name || pendingInfo.nis) {
                updateNavbarStudentProfile(pendingInfo.name, pendingInfo.nis, pendingInfo.classId);
            }
        } else if (pendingResume) {
            document.getElementById('student-login-card')?.classList.add('hidden');
            document.getElementById('student-resume-token-screen')?.classList.remove('hidden');
            const student = pendingResume.student || pendingResume;
            if (student.name || student.nis) {
                updateNavbarStudentProfile(student.name, student.nis, student.class || student.classId);
            }
        }
    } catch (e) {}

    // 4. Pulihkan tampilan hasil terlebih dahulu jika ada
    const resultRestored = restoreStudentResultAfterRefresh();

    // 5. Muat data bank kuis dan siswa dari server
    await fetchDataFromAPI();

    // 6. Pulihkan pengerjaan aktif jika ada
    const attemptRestored = await restoreActiveAttemptAfterRefresh();
    if (attemptRestored) {
        checkAndEnforceFullScreen();
    }

    // 7. Jika bukan hasil selesai dan bukan pengerjaan aktif, pulihkan status info / resume token
    if (!resultRestored && !attemptRestored && !ExamContext.currentStudentResult && !ExamContext.attemptToken) {
        const infoRestored = restorePendingStudentSessionAfterRefresh();
        const resumeRestored = restorePendingResumeSessionAfterRefresh();
        if (!infoRestored && !resumeRestored) {
            document.getElementById('student-exam-info-screen')?.classList.add('hidden');
            document.getElementById('student-resume-token-screen')?.classList.add('hidden');
            document.getElementById('student-login-card')?.classList.remove('hidden');
        }
    }
}

// Jalankan inisialisasi saat DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
