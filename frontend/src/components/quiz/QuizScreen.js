/**
 * ExamLAN Pro - Quiz Screen & Active Attempt Lifecycle Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { StudentContext } from '../../context/StudentContext.js';
import { Storage } from '../../utils/storage.js';
import { examApi } from '../../api/examApi.js';
import { authApi } from '../../api/authApi.js';
import { enterFullScreen, initAntiCheat, stopAntiCheat, checkAndEnforceFullScreen, setReloadIntended } from '../../hooks/useAntiCheat.js';
import { startTimer } from '../../hooks/useTimer.js';
import { syncAnswers, setSaveStatus } from '../../hooks/useAutoSave.js';
import { renderCurrentQuestion } from './QuestionCard.js';
import { updateNavbarStudentProfile } from '../common/Header.js';
import { showToast } from '../common/Toast.js';
import { appAlert, closeConfirmReloadModal } from '../common/Modal.js';
import { resetStudentView } from '../result/ResultScreen.js';

export function saveActiveAttempt() {
    const attemptToken = ExamContext.attemptToken;
    const activeStudent = StudentContext.activeStudent;
    const pendingInfo = ExamContext.pendingExamInfo;

    Storage.setActiveAttempt({
        token: attemptToken,
        nis: activeStudent?.nis || pendingInfo?.nis || '',
        name: activeStudent?.name || pendingInfo?.name || '',
        classId: activeStudent?.classId || pendingInfo?.classId || ''
    });
}

export function clearActiveAttempt() {
    stopAntiCheat();
    Storage.clearActiveAttempt();
    ExamContext.setAttemptToken(null);
}

export function hydrateAttempt(data) {
    Storage.clearPendingExamInfo();
    Storage.clearPendingResumeInfo();
    ExamContext.setPendingExamInfo(null);
    ExamContext.setPendingResumeData(null);

    enterFullScreen();
    initAntiCheat(data.violations_count || 0);

    ExamContext.setAttemptToken(data.attempt_token || data.token);
    ExamContext.setCurrentQuiz(data.quiz);
    ExamContext.setAnswers(data.answers || {});

    const studentData = {
        nis: data.nis || StudentContext.activeStudent.nis || '',
        name: data.name || StudentContext.activeStudent.name || '',
        classId: data.class || data.classId || StudentContext.activeStudent.classId || ''
    };
    StudentContext.setStudent(studentData);
    saveActiveAttempt();
    updateNavbarStudentProfile(studentData.name, studentData.nis, studentData.classId);

    const infoEl = document.getElementById('active-student-info');
    if (infoEl && studentData.name && studentData.nis) {
        infoEl.innerText = `NIS: ${studentData.nis} | Siswa: ${studentData.name} | Kelas: ${studentData.classId}`;
    }

    StudentContext.setReviewToken(null);
    ExamContext.setResult(null);
    ExamContext.setAnswerReviewVisible(false);
    ExamContext.setQuestionIndex(0);

    document.getElementById('student-login-card')?.classList.add('hidden');
    document.getElementById('student-exam-info-screen')?.classList.add('hidden');
    document.getElementById('student-resume-token-screen')?.classList.add('hidden');
    document.getElementById('student-result-screen')?.classList.add('hidden');
    document.getElementById('student-quiz-screen')?.classList.remove('hidden');

    const titleEl = document.getElementById('active-quiz-title');
    if (titleEl) titleEl.innerText = data.quiz?.title || 'Ujian CBT';

    const totalNumEl = document.getElementById('total-questions-num');
    if (totalNumEl) totalNumEl.innerText = (data.quiz?.questions || []).length;

    const remaining = Math.max(0, Number(data.ends_at) - Number(data.server_now));
    ExamContext.setTimeRemaining(remaining);
    startTimer();
    renderCurrentQuestion();
    setSaveStatus('✓ Jawaban tersimpan', 'text-emerald-600');

    setTimeout(() => {
        checkAndEnforceFullScreen();
    }, 300);
}

export async function restoreActiveAttemptAfterRefresh() {
    if (ExamContext.currentStudentResult) return false;

    // Membaca sesi aktif dari sessionStorage (BUKAN localStorage)
    const saved = Storage.getActiveAttempt();
    if (!saved || !saved.token) return false;

    if (saved.name && saved.nis) {
        StudentContext.setStudent({
            nis: saved.nis,
            name: saved.name,
            classId: saved.classId || ''
        });
        updateNavbarStudentProfile(saved.name, saved.nis, saved.classId);
    }

    try {
        const res = await examApi.getAttempt(saved.token);
        const d = res.data;

        if (!res.ok || d?.finished || d?.status === 'needs_login') {
            clearActiveAttempt();
            if (d?.status === 'needs_login' && d?.message) {
                showToast(d.message);
            }
            return false;
        }

        hydrateAttempt(d);
        return true;
    } catch (e) {
        setSaveStatus('⚠ Koneksi terputus — jawaban lokal akan disinkronkan.', 'text-amber-600');
        return false;
    }
}

export async function executeLiveReload() {
    closeConfirmReloadModal();
    const btn = document.getElementById('btn-header-reload');
    const prevHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> <span class="hidden sm:inline">Memuat...</span>`;
    }
    setSaveStatus('⟳ Menyinkronkan…', 'text-amber-500');

    try {
        // 1. Simpan jawaban lokal terlebih dahulu jika server online
        await syncAnswers();

        // 2. Refresh attempt data dari server via API
        if (ExamContext.attemptToken) {
            const res = await examApi.getAttempt(ExamContext.attemptToken);
            const d = res.data;
            if (res.ok && d?.status === 'success' && !d.finished) {
                hydrateAttempt(d);
                setSaveStatus('✓ Jawaban tersimpan', 'text-emerald-600');
                showToast('✓ Data ujian berhasil dimuat ulang & tetap dalam layar penuh!', 'success');
                return;
            } else if (d?.status === 'needs_login') {
                appAlert(d?.message || 'Sesi ujian telah direset oleh Pengawas.', 'Sesi Berakhir');
                resetStudentView();
                return;
            }
        }

        const studentDataRes = await authApi.getStudentData();
        if (studentDataRes.ok && studentDataRes.data) {
            ExamContext.setQuizzes(studentDataRes.data.questions || []);
            StudentContext.setRegisteredStudents(studentDataRes.data.students || []);
        }
        showToast('✓ Data kuis berhasil disinkronkan!', 'success');
    } catch (err) {
        setSaveStatus('⚠ Koneksi offline — jawaban lokal aman', 'text-amber-600');
        showToast('Koneksi server terputus. Jawaban lokal tetap tersimpan aman.', 'warning');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = prevHtml;
        }
    }
}

export function executeHardBrowserReload() {
    setReloadIntended(true);
    try {
        syncAnswers();
    } catch (e) {}
    window.location.reload();
}

window.executeLiveReload = executeLiveReload;
window.executeHardBrowserReload = executeHardBrowserReload;
