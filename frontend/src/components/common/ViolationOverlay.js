/**
 * ExamLAN Pro - Violation & Mode Kiosk Overlay Component
 */

import {
    resumeFullScreenAndExam,
    activateFullScreenFromOverlay,
    handleKioskShortcut,
    closeKioskModalAndContinue,
    exitKioskMode
} from '../../hooks/useAntiCheat.js';

export function initViolationOverlay() {
    window.resumeFullScreenAndExam = resumeFullScreenAndExam;
    window.activateFullScreenFromOverlay = activateFullScreenFromOverlay;
    window.handleKioskShortcut = handleKioskShortcut;
    window.closeKioskModalAndContinue = closeKioskModalAndContinue;
    window.exitKioskMode = exitKioskMode;
}
