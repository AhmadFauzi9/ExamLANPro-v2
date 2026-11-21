/**
 * ExamLAN Pro - Time Out & Extension Request Overlay Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { StudentContext } from '../../context/StudentContext.js';
import { Storage } from '../../utils/storage.js';
import { examApi } from '../../api/examApi.js';
import { startTimer } from '../../hooks/useTimer.js';
import { setSaveStatus } from '../../hooks/useAutoSave.js';
import { showToast } from '../common/Toast.js';
import { submitQuiz } from './QuizNavigation.js';

let pollExtensionInterval = null;

export function showTimeoutOverlay() {
    const overlay = document.getElementById('timeout-overlay');
    if (overlay) overlay.classList.remove('hidden');

    const reqBtn = document.getElementById('btn-request-extension');
    if (reqBtn) {
        reqBtn.disabled = false;
        reqBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> <span>Minta Perpanjangan Waktu</span>';
    }

    const msg = document.getElementById('extension-status-msg');
    if (msg) msg.classList.add('hidden');
}

export async function requestTimeExtension() {
    const btn = document.getElementById('btn-request-extension');
    const msg = document.getElementById('extension-status-msg');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menunggu Persetujuan Admin...</span>';
    }
    if (msg) {
        msg.textContent = 'Permintaan telah dikirim ke guru/admin. Menunggu persetujuan...';
        msg.classList.remove('hidden');
    }

    try {
        const attemptToken = ExamContext.attemptToken || Storage.getActiveAttempt()?.token || '';
        const studentNis = StudentContext.activeStudent?.nis || Storage.getActiveAttempt()?.nis || '';
        const res = await examApi.requestExtension(attemptToken, studentNis);
        const data = res.data;

        if (!res.ok || data?.status !== 'success') {
            if (msg) msg.textContent = data?.message || 'Gagal mengajukan perpanjangan.';
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> <span>Coba Minta Waktu Lagi</span>';
            }
            return;
        }

        clearInterval(pollExtensionInterval);
        pollExtensionInterval = setInterval(checkExtensionStatusPoll, 3000);
    } catch (err) {
        if (msg) msg.textContent = 'Gagal menghubungi server. Periksa jaringan LAN.';
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> <span>Coba Minta Waktu Lagi</span>';
        }
    }
}

export async function checkExtensionStatusPoll() {
    try {
        const attemptToken = ExamContext.attemptToken || Storage.getActiveAttempt()?.token || '';
        const studentNis = StudentContext.activeStudent?.nis || Storage.getActiveAttempt()?.nis || '';
        const res = await examApi.checkExtensionStatus(attemptToken, studentNis);
        const data = res.data;
        if (!res.ok || !data) return;

        if (data.extension_status === 'APPROVED') {
            clearInterval(pollExtensionInterval);
            document.getElementById('timeout-overlay')?.classList.add('hidden');
            const remaining = Math.max(0, Number(data.ends_at) - Number(data.server_now));
            ExamContext.setTimeRemaining(remaining);
            startTimer();
            showToast('Perpanjangan waktu telah disetujui guru! Silakan lanjutkan pengerjaan.', 'success');
            setSaveStatus('✓ Waktu diperpanjang', 'text-emerald-600');
        } else if (data.extension_status === 'REJECTED') {
            clearInterval(pollExtensionInterval);
            const btn = document.getElementById('btn-request-extension');
            const msg = document.getElementById('extension-status-msg');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-ban"></i> <span>Permintaan Ditolak</span>';
            if (msg) msg.textContent = 'Permintaan perpanjangan waktu ditolak oleh guru. Silakan klik "Lihat Hasil Ujian".';
        }
    } catch (err) {}
}

export function submitFinalTimeOut() {
    clearInterval(pollExtensionInterval);
    document.getElementById('timeout-overlay')?.classList.add('hidden');
    submitQuiz(true);
}

window.requestTimeExtension = requestTimeExtension;
window.submitFinalTimeOut = submitFinalTimeOut;
