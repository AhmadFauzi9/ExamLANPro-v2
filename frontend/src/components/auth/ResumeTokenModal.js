/**
 * ExamLAN Pro - Resume Token Verification Screen Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { Storage } from '../../utils/storage.js';
import { authApi } from '../../api/authApi.js';
import { enterFullScreen } from '../../hooks/useAntiCheat.js';
import { updateNavbarStudentProfile } from '../common/Header.js';
import { appAlert } from '../common/Modal.js';
import { showToast } from '../common/Toast.js';
import { hydrateAttempt } from '../quiz/QuizScreen.js';

export function showResumeTokenScreen(info) {
    if (!info) return;

    ExamContext.setPendingResumeData(info);
    Storage.setPendingResumeInfo(info);

    const studentName = info.student?.name || info.name || '';
    const studentNis = info.student?.nis || info.nis || '';
    const studentClass = info.student?.class || info.classId || '';

    updateNavbarStudentProfile(studentName, studentNis, studentClass);

    document.getElementById('student-login-card')?.classList.add('hidden');
    document.getElementById('student-exam-info-screen')?.classList.add('hidden');

    const nameEl = document.getElementById('resume-student-name');
    const nisEl = document.getElementById('resume-student-nis');
    const titleEl = document.getElementById('resume-quiz-title');
    const inputEl = document.getElementById('resume-token-input');

    if (nameEl) nameEl.textContent = studentName || '-';
    if (nisEl) nisEl.textContent = studentNis || '-';
    if (titleEl) titleEl.textContent = info.quiz?.title || 'Ujian Berjalan';
    if (inputEl && !inputEl.value) inputEl.value = '';

    document.getElementById('student-resume-token-screen')?.classList.remove('hidden');
    if (inputEl) setTimeout(() => inputEl.focus(), 150);
}

export function cancelResumeTokenScreen() {
    Storage.clearPendingResumeInfo();
    ExamContext.setPendingResumeData(null);
    updateNavbarStudentProfile('', '', '');

    document.getElementById('student-resume-token-screen')?.classList.add('hidden');
    document.getElementById('student-login-card')?.classList.remove('hidden');
}

export async function submitResumeToken(e) {
    if (e && e.preventDefault) e.preventDefault();
    enterFullScreen();

    const pendingResumeData = ExamContext.pendingResumeData || Storage.getPendingResumeInfo();
    if (!pendingResumeData) {
        cancelResumeTokenScreen();
        return;
    }

    const inputEl = document.getElementById('resume-token-input');
    const pin = inputEl ? inputEl.value.trim().toUpperCase() : '';

    if (!pin || pin.length < 6) {
        appAlert("Silakan ketikkan 6 karakter Token Ujian aktif yang diberikan oleh guru pengawas!", "Token Diperlukan");
        inputEl?.focus();
        return;
    }

    const btn = document.getElementById('btn-submit-resume-token');
    const prevText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Memvalidasi Token...</span>`;
    }

    try {
        const res = await authApi.studentLogin({
            nis: pendingResumeData.nis,
            password: pendingResumeData.password || '',
            quiz_id: pendingResumeData.quiz?.id || '',
            pin: pin
        });
        const data = res.data;

        if (!res.ok || data?.status !== 'success') {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = prevText;
            }
            appAlert(data?.message || 'Token ujian tidak valid atau sudah kedaluwarsa. Silakan minta token aktif terbaru dari pengawas.', 'Validasi Token Gagal');
            inputEl?.select();
            return;
        }

        if (data.resume_attempt && data.attempt) {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = prevText;
            }
            Storage.clearPendingResumeInfo();
            ExamContext.setPendingResumeData(null);
            document.getElementById('student-resume-token-screen')?.classList.add('hidden');

            hydrateAttempt(data.attempt);
            showToast(data.message || 'Sesi ujian berhasil dipulihkan!');
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = prevText;
            }
            appAlert('Terjadi kendala saat memulihkan sesi ujian. Silakan coba kembali.');
        }
    } catch (err) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = prevText;
        }
        appAlert('Tidak dapat menghubungi server. Periksa koneksi LAN Anda lalu coba kembali.', 'Koneksi Error');
    }
}

export function restorePendingResumeSessionAfterRefresh() {
    if (ExamContext.currentStudentResult || ExamContext.attemptToken) return false;
    try {
        const saved = Storage.getPendingResumeInfo();
        if (!saved || !saved.nis) return false;
        showResumeTokenScreen(saved);
        return true;
    } catch (e) {
        return false;
    }
}
