/**
 * ExamLAN Pro - Exam Countdown Timer Hook
 */

import { ExamContext } from '../context/ExamContext.js';
import { formatSeconds } from '../utils/formatters.js';
import { syncAnswers } from './useAutoSave.js';
import { showToast } from '../components/common/Toast.js';
import { showTimeoutOverlay } from '../components/quiz/TimeoutOverlay.js';
import { setText } from '../utils/dom.js';

let timerInterval = null;

export function updateTimerDisplay() {
    const formatted = formatSeconds(ExamContext.timeRemaining);
    setText('#quiz-timer', formatted);
}

export function startTimer() {
    stopTimer();
    const overlay = document.getElementById('timeout-overlay');
    if (overlay) overlay.classList.add('hidden');

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        let remaining = ExamContext.timeRemaining - 1;
        ExamContext.setTimeRemaining(remaining);

        if (remaining > 0 && remaining % 8 === 0) {
            syncAnswers();
        }

        updateTimerDisplay();

        // Peringatan sisa waktu 10 menit (600s) dan 5 menit (300s)
        if (remaining === 600) {
            showToast('Waktu Ujian: Sisa waktu 10 menit lagi!', 'warning');
        } else if (remaining === 300) {
            showToast('Peringatan: Sisa waktu ujian tinggal 5 menit lagi! Segera tuntaskan jawaban Anda.', 'danger');
        }

        if (remaining <= 0) {
            ExamContext.setTimeRemaining(0);
            stopTimer();
            updateTimerDisplay();
            syncAnswers();
            showTimeoutOverlay();
        }
    }, 1000);
}

export function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}
