/**
 * ExamLAN Pro - Violation Overlay Component
 */

import { resumeFullScreenAndExam, activateFullScreenFromOverlay } from '../../hooks/useAntiCheat.js';

export function initViolationOverlay() {
    window.resumeFullScreenAndExam = resumeFullScreenAndExam;
    window.activateFullScreenFromOverlay = activateFullScreenFromOverlay;
}
