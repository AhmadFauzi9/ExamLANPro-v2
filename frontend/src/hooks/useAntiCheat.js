/**
 * ExamLAN Pro - Anti-Cheat & Mode Kiosk Resmi Hook
 * Menggunakan pengamanan Mode Kiosk Resmi dengan kombinasi tombol pembuka/pengawas: CTRL + C + B
 */

import { ExamContext } from '../context/ExamContext.js';
import { StudentContext } from '../context/StudentContext.js';
import { examApi } from '../api/examApi.js';
import { isProhibitedKeyCombo, isReloadKeyCombo } from '../utils/security.js';
import { show, hide, setText } from '../utils/dom.js';
import { showToast } from '../components/common/Toast.js';

let isInitialized = false;
let lastViolationReportTime = 0;
let isReloadingIntended = false;
let isAntiCheatActive = true;

// State kombinasi tombol CTRL + C + B
let lastCtrlCDownTime = 0;
let isCHeld = false;

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
        let p = null;
        if (docEl.requestFullscreen) {
            p = docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
            p = docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
            p = docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
            p = docEl.msRequestFullscreen();
        }

        const lockAllSystemKeys = () => {
            hide('#fullscreen-restore-overlay');
            // Kunci seluruh tombol sistem (Windows Key / Meta, Escape, Alt, Tab, ContextMenu)
            if (navigator.keyboard && typeof navigator.keyboard.lock === 'function') {
                navigator.keyboard.lock().catch(() => {
                    navigator.keyboard.lock(['MetaLeft', 'MetaRight', 'Escape', 'F11', 'Tab', 'AltLeft', 'AltRight', 'ContextMenu']).catch(() => {});
                });
            }
        };

        if (p && typeof p.then === 'function') {
            p.then(lockAllSystemKeys).catch(() => {
                checkAndEnforceFullScreen();
            });
        } else {
            lockAllSystemKeys();
        }
    } catch (e) {
        checkAndEnforceFullScreen();
    }
}

export function exitFullScreen() {
    try {
        if (navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
            navigator.keyboard.unlock();
        }
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

    // Jika overlay pelanggaran sudah terbuka, jangan kirim spam pelanggaran beruntun
    const violationOverlay = document.getElementById('violation-overlay');
    if (violationOverlay && !violationOverlay.classList.contains('hidden')) {
        return;
    }

    const now = Date.now();
    if (now - lastViolationReportTime < 2000) {
        return;
    }
    lastViolationReportTime = now;
    ExamContext.incrementViolation();

    const count = ExamContext.violationCount;
    setText('#violation-overlay-count', count);
    setText(
        '#violation-overlay-msg',
        `Terdeteksi: ${details}. Layar ujian dikunci dalam Mode Kiosk Resmi dan dilaporkan secara langsung ke Pengawas Ujian.`
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
    try { window.focus(); } catch (e) {}
    hide('#violation-overlay');
    hide('#fullscreen-restore-overlay');
}

export function activateFullScreenFromOverlay() {
    enterFullScreen();
    try { window.focus(); } catch (e) {}
    hide('#fullscreen-restore-overlay');
    hide('#violation-overlay');
}

/**
 * Handler Kombinasi Tombol Resmi Pengawas: CTRL + C + B
 * Langsung keluar dari Mode Kiosk seketika tanpa modal konfirmasi
 */
export function handleKioskShortcut() {
    if (!isExamActive()) return;
    exitKioskMode();
}

export function closeKioskModalAndContinue() {
    enterFullScreen();
}

export function exitKioskMode() {
    stopAntiCheat();
    showToast('Mode Kiosk dinonaktifkan oleh Pengawas.', 'warning');
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
            reportStudentViolation('tab_switch', 'Pindah tab atau meminimalkan jendela Mode Kiosk');
        } else {
            if (!isFullScreen()) {
                enterFullScreen();
                reportStudentViolation('exit_fullscreen', 'Keluar dari Mode Kiosk Resmi (Layar Penuh)');
            }
        }
    });

    // 2. Deteksi Berpindah ke Aplikasi Lain / Jendela Browser Lain (window.onblur)
    window.addEventListener('blur', () => {
        isCHeld = false;
        if (!isExamActive()) return;

        // Segera ambil kembali fokus browser agar Start Menu Windows / pop-up OS otomatis tertutup
        try { window.focus(); } catch (err) {}
        setTimeout(() => {
            try { window.focus(); } catch (err) {}
        }, 30);
        setTimeout(() => {
            try { window.focus(); } catch (err) {}
        }, 100);

        reportStudentViolation('app_switch', 'Fokus jendela Mode Kiosk berpindah ke aplikasi lain');
    });

    // 3. Deteksi Keluar dari FullScreen (Tangani ESC / Batalkan Layar Penuh)
    const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    fsEvents.forEach(evt => {
        document.addEventListener(evt, () => {
            if (!isExamActive()) return;
            if (!isFullScreen()) {
                // Langsung kunci tampilan dengan overlay agar soal tidak terlihat di luar fullscreen
                const violationOverlay = document.getElementById('violation-overlay');
                if (!violationOverlay || violationOverlay.classList.contains('hidden')) {
                    show('#fullscreen-restore-overlay');
                }
                reportStudentViolation('exit_fullscreen', 'Keluar dari Mode Kiosk Resmi (Layar Penuh)');
            } else {
                hide('#fullscreen-restore-overlay');
                if (navigator.keyboard && typeof navigator.keyboard.lock === 'function') {
                    navigator.keyboard.lock().catch(() => {
                        navigator.keyboard.lock(['MetaLeft', 'MetaRight', 'Escape', 'F11', 'Tab', 'AltLeft', 'AltRight', 'ContextMenu']).catch(() => {});
                    });
                }
            }
        });
    });

    // 4. Deteksi Kombinasi Tombol Pengawas (CTRL + C + B) & Blokir Pintasan Terlarang
    window.addEventListener('keydown', (e) => {
        if (!isExamActive()) return;

        // Tangkal tombol Escape agar tidak membatalkan Mode Kiosk
        if (e.key === 'Escape' || e.keyCode === 27) {
            e.preventDefault();
            e.stopPropagation();
            if (!isFullScreen()) {
                enterFullScreen();
            }
            return false;
        }

        // Tangkal dan netralkan tombol Windows / Meta (Start Menu) seketika
        const isMetaKey = (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight' || e.keyCode === 91 || e.keyCode === 92);
        if (isMetaKey) {
            e.preventDefault();
            e.stopPropagation();
            try { window.focus(); } catch (err) {}
            reportStudentViolation('key_shortcut', 'Menekan tombol Windows (Start Menu)');
            return false;
        }

        // Jika terlepas dari fullscreen, penekanan tombol non-ctrl akan memicu masuk kembali
        if (!isFullScreen() && !e.ctrlKey && !e.metaKey) {
            enterFullScreen();
        }

        const isCtrl = e.ctrlKey || e.metaKey;
        const key = (e.key || '').toLowerCase();
        const code = e.code || '';

        // Deteksi Kombinasi CTRL + C + B
        if (isCtrl) {
            if (key === 'c' || code === 'KeyC') {
                lastCtrlCDownTime = Date.now();
                isCHeld = true;
                // Cegah copy teks soal saat ujian, tapi catat urutan untuk CTRL+C+B
                e.preventDefault();
                return;
            }

            if (key === 'b' || code === 'KeyB') {
                const elapsed = Date.now() - lastCtrlCDownTime;
                if (isCHeld || elapsed < 3000) {
                    e.preventDefault();
                    e.stopPropagation();
                    lastCtrlCDownTime = 0;
                    isCHeld = false;
                    handleKioskShortcut();
                    return false;
                }
            } else if (key !== 'control' && key !== 'meta' && key !== 'shift') {
                lastCtrlCDownTime = 0;
            }
        }

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

    window.addEventListener('keyup', (e) => {
        const key = (e.key || '').toLowerCase();
        const code = e.code || '';
        if (key === 'c' || code === 'KeyC') {
            isCHeld = false;
        }

        // Tangkal pelepasan tombol Windows agar Start Menu tidak sempat dipicu
        const isMetaKey = (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight' || e.keyCode === 91 || e.keyCode === 92);
        if (isMetaKey) {
            e.preventDefault();
            e.stopPropagation();
            try { window.focus(); } catch (err) {}
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
    }, true);

    // 7. Peringatan beforeunload jika browser dipaksa refresh/tutup
    window.addEventListener('beforeunload', (e) => {
        if (isReloadingIntended) return;
        if (isExamActive()) {
            e.preventDefault();
            e.returnValue = 'Ujian sedang berlangsung! Memuat ulang halaman akan membatalkan Mode Kiosk Resmi.';
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
