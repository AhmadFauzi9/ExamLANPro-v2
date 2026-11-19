/**
 * ExamLAN Pro - Anti-Cheat & Fullscreen Enforcement Hook
 */

import { ExamContext } from '../context/ExamContext.js';
import { StudentContext } from '../context/StudentContext.js';
import { examApi } from '../api/examApi.js';
import { isProhibitedKeyCombo, isReloadKeyCombo } from '../utils/security.js';
import { show, hide, setText } from '../utils/dom.js';

let isInitialized = false;
let lastViolationReportTime = 0;
let isReloadingIntended = false;
let isAntiCheatActive = true;

export function setReloadIntended(val) {
    isReloadingIntended = !!val;
}

export function isFullScreen() {
    return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );
}

export function enterFullScreen() {
    const docEl = document.documentElement;
    try {
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen().catch(() => {});
        } else if (docEl.mozRequestFullScreen) {
            docEl.mozRequestFullScreen().catch(() => {});
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen().catch(() => {});
        }
    } catch (e) {}
}

export function exitFullScreen() {
    try {
        if (isFullScreen()) {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen().catch(() => {});
            else if (document.msExitFullscreen) document.msExitFullscreen().catch(() => {});
        }
    } catch (e) {}
}

export function isExamActive() {
    if (!isAntiCheatActive) return false;
    const quizScreen = document.getElementById('student-quiz-screen');
    return ExamContext.isExamActive() && quizScreen && !quizScreen.classList.contains('hidden');
}

export function checkAndEnforceFullScreen() {
    if (!isExamActive()) {
        hide('#fullscreen-restore-overlay');
        return;
    }
    if (!isFullScreen()) {
        const violationOverlay = document.getElementById('violation-overlay');
        if (!violationOverlay || violationOverlay.classList.contains('hidden')) {
            show('#fullscreen-restore-overlay');
        }
    } else {
        hide('#fullscreen-restore-overlay');
    }
}

export async function reportStudentViolation(type, details) {
    if (!isExamActive()) return;

    const now = Date.now();
    if (now - lastViolationReportTime < 1500) {
        return;
    }
    lastViolationReportTime = now;
    ExamContext.incrementViolation();

    const count = ExamContext.violationCount;
    setText('#violation-overlay-count', count);
    setText(
        '#violation-overlay-msg',
        `Terdeteksi: ${details}. Aktivitas kecurangan telah dicatat ke audit log server dan dikirim ke Pengawas Ujian secara langsung.`
    );
    show('#violation-overlay');

    const nis = StudentContext.activeStudent.nis || ExamContext.pendingExamInfo?.nis || '';
    const payload = {
        attempt_token: ExamContext.attemptToken,
        nis: nis,
        type: type,
        details: details
    };

    const res = await examApi.reportViolation(payload);
    if (res?.data?.violations_count !== undefined) {
        ExamContext.setViolationCount(Number(res.data.violations_count));
        setText('#violation-overlay-count', ExamContext.violationCount);
    }
}

export function resumeFullScreenAndExam() {
    enterFullScreen();
    hide('#violation-overlay');
    hide('#fullscreen-restore-overlay');
}

export function activateFullScreenFromOverlay() {
    enterFullScreen();
    hide('#fullscreen-restore-overlay');
}

export function initAntiCheat(initialViolations = 0) {
    isAntiCheatActive = true;
    ExamContext.setViolationCount(Number(initialViolations) || 0);
    if (isInitialized) return;
    isInitialized = true;

    // 1. Deteksi Pindah Tab / Minimized (visibilitychange)
    document.addEventListener('visibilitychange', () => {
        if (!isExamActive()) return;
        if (document.hidden) {
            reportStudentViolation('tab_switch', 'Pindah tab atau meminimalkan jendela browser');
        } else {
            if (!isFullScreen()) {
                reportStudentViolation('exit_fullscreen', 'Keluar dari mode layar penuh (Full Screen)');
            }
        }
    });

    // 2. Deteksi Berpindah ke Aplikasi Lain / Jendela Browser Lain (window.onblur)
    window.addEventListener('blur', () => {
        if (!isExamActive()) return;
        reportStudentViolation('app_switch', 'Fokus layar berpindah ke aplikasi lain atau jendela browser lain');
    });

    // 3. Deteksi Keluar dari FullScreen
    const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    fsEvents.forEach(evt => {
        document.addEventListener(evt, () => {
            if (!isExamActive()) return;
            if (!isFullScreen()) {
                reportStudentViolation('exit_fullscreen', 'Keluar dari mode layar penuh (Full Screen)');
            } else {
                hide('#fullscreen-restore-overlay');
            }
        });
    });

    // 4. Blokir Tombol Pintasan Keyboard yang Dipakai untuk Mencontek / Keluar / Refresh
    window.addEventListener('keydown', (e) => {
        if (!isExamActive()) return;

        // Penanganan F5 & Ctrl+R saat ujian aktif: Tampilkan Modal Konfirmasi Muat Ulang
        if (isReloadKeyCombo(e)) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.promptReloadExam === 'function') {
                window.promptReloadExam();
            }
            return false;
        }

        const prohibitedCheck = isProhibitedKeyCombo(e);
        if (prohibitedCheck.prohibited) {
            e.preventDefault();
            e.stopPropagation();
            reportStudentViolation('key_shortcut', prohibitedCheck.reason);
            return false;
        }
    }, true);

    // 5. Blokir Klik Kanan (Context Menu) saat Ujian
    window.addEventListener('contextmenu', (e) => {
        if (isExamActive()) {
            e.preventDefault();
            return false;
        }
    }, true);

    // 6. Klik Layar Otomatis Masuk Kembali ke Layar Penuh jika Terlepas
    document.addEventListener('click', () => {
        if (isExamActive() && !isFullScreen()) {
            enterFullScreen();
            hide('#fullscreen-restore-overlay');
        }
    });

    // 7. Peringatan beforeunload jika browser dipaksa refresh/tutup
    window.addEventListener('beforeunload', (e) => {
        if (isReloadingIntended) return;
        if (isExamActive()) {
            e.preventDefault();
            e.returnValue = 'Ujian sedang berlangsung! Memuat ulang halaman akan membatalkan mode layar penuh.';
            return e.returnValue;
        }
    });
}

export function stopAntiCheat() {
    isAntiCheatActive = false;
    exitFullScreen();
    hide('#violation-overlay');
    hide('#fullscreen-restore-overlay');
}
