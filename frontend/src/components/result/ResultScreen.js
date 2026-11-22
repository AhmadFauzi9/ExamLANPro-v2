/**
 * ExamLAN Pro - Result Screen & Session Reset Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { StudentContext } from '../../context/StudentContext.js';
import { Storage } from '../../utils/storage.js';
import { updateNavbarStudentProfile } from '../common/Header.js';
import { stopReviewPermissionPolling, startReviewPermissionPolling } from './QuestionBreakdown.js';
import { authApi } from '../../api/authApi.js';
import { populateQuizDropdowns } from '../auth/LoginCard.js';
import { setText } from '../../utils/dom.js';

export function renderResultScreen(sub) {
    if (!sub) return;

    const student = StudentContext.activeStudent;
    if (student && (student.name || student.nis)) {
        updateNavbarStudentProfile(student.name, student.nis, student.classId);
    }

    document.getElementById('student-login-card')?.classList.add('hidden');
    document.getElementById('student-exam-info-screen')?.classList.add('hidden');
    document.getElementById('student-quiz-screen')?.classList.add('hidden');
    document.getElementById('student-result-screen')?.classList.remove('hidden');

    setText('#res-score', sub.score || 0);
    setText('#res-correct', sub.correct || 0);
    setText('#res-incorrect', sub.wrong || 0);
    setText('#res-percentage', `${sub.score || 0}%`);

    // Evaluasi Status Kelulusan KKM
    const currentQuiz = ExamContext.currentQuiz;
    const kkmVal = (currentQuiz && currentQuiz.kkm !== undefined && currentQuiz.kkm !== null && !isNaN(Number(currentQuiz.kkm))) ? Number(currentQuiz.kkm) : 70;
    const scoreVal = Number(sub.score || 0);
    const isPassed = scoreVal >= kkmVal;

    const bannerEl = document.getElementById('res-kkm-status-banner');
    const iconEl = document.getElementById('res-kkm-status-icon');
    const textEl = document.getElementById('res-kkm-status-text');
    if (bannerEl && textEl && iconEl) {
        if (isPassed) {
            bannerEl.className = 'max-w-md mx-auto py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs';
            iconEl.className = 'fa-solid fa-circle-check text-emerald-600';
            textEl.innerText = `TUNTAS KKM (Batas KKM: ${kkmVal})`;
        } else {
            bannerEl.className = 'max-w-md mx-auto py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border bg-amber-50 text-amber-800 border-amber-200 shadow-2xs';
            iconEl.className = 'fa-solid fa-triangle-exclamation text-amber-600';
            textEl.innerText = `REMEDIAL / BELUM TUNTAS KKM (Batas KKM: ${kkmVal})`;
        }
    }

    const listContainer = document.getElementById('breakdown-list');
    const reviewStatus = document.getElementById('answer-review-status');
    ExamContext.setAnswerReviewVisible(false);

    if (listContainer) {
        listContainer.classList.add('hidden');
        listContainer.innerHTML = '';
        delete listContainer.dataset.loaded;
    }
    if (reviewStatus) {
        reviewStatus.innerText = 'Jawaban benar dan pembahasan disembunyikan oleh guru.';
    }
}

export function restoreStudentResultAfterRefresh() {
    try {
        // Membaca sesi dari sessionStorage (BUKAN localStorage)
        const saved = Storage.getStudentSession();
        if (!saved || !saved.result || !saved.activeStudent || !saved.quizId) return false;

        document.getElementById('view-student')?.classList.remove('hidden');
        document.getElementById('student-login-card')?.classList.add('hidden');
        document.getElementById('student-quiz-screen')?.classList.add('hidden');
        document.getElementById('student-result-screen')?.classList.remove('hidden');

        StudentContext.setStudent(saved.activeStudent);
        updateNavbarStudentProfile(saved.activeStudent.name, saved.activeStudent.nis, saved.activeStudent.classId);

        const quizzes = ExamContext.quizzes || [];
        const quiz = quizzes.find(q => q.id === saved.quizId) || { id: saved.quizId };
        ExamContext.setCurrentQuiz(quiz);

        StudentContext.setReviewToken(saved.reviewToken || null);
        ExamContext.setResult(saved.result);
        ExamContext.setAnswers({});
        ExamContext.setAnswerReviewVisible(false);

        renderResultScreen(saved.result);

        if (saved.reviewToken) {
            startReviewPermissionPolling();
        }
        return true;
    } catch (err) {
        console.warn('Gagal memulihkan sesi hasil ujian:', err);
        return false;
    }
}

export async function resetStudentView() {
    stopReviewPermissionPolling();

    Storage.clearStudentSession();
    Storage.clearPendingExamInfo();
    Storage.clearPendingResumeInfo();
    Storage.clearActiveAttempt();
    Storage.clearPendingAnswers();

    StudentContext.clear();
    ExamContext.clearExam();

    document.getElementById('student-result-screen')?.classList.add('hidden');
    document.getElementById('student-quiz-screen')?.classList.add('hidden');
    document.getElementById('student-exam-info-screen')?.classList.add('hidden');
    document.getElementById('student-resume-token-screen')?.classList.add('hidden');
    document.getElementById('violation-overlay')?.classList.add('hidden');
    document.getElementById('fullscreen-restore-overlay')?.classList.add('hidden');
    document.getElementById('timeout-overlay')?.classList.add('hidden');
    document.getElementById('modal-confirm-reload')?.classList.add('hidden');
    document.getElementById('student-login-card')?.classList.remove('hidden');

    const nisInput = document.getElementById('student-nis');
    if (nisInput) {
        nisInput.value = '';
        nisInput.readOnly = false;
        nisInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }
    const nameInput = document.getElementById('student-name');
    if (nameInput) {
        nameInput.value = '';
        nameInput.readOnly = false;
        nameInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }
    const classInput = document.getElementById('student-class');
    if (classInput) {
        classInput.value = '';
        classInput.readOnly = false;
        classInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }
    const authInput = document.getElementById('student-auth-code');
    if (authInput) authInput.value = '';

    const tokenInput = document.getElementById('exam-token-input');
    if (tokenInput) tokenInput.value = '';

    document.documentElement.classList.remove('has-active-session');
    updateNavbarStudentProfile('', '', '');

    try {
        const res = await authApi.getStudentData();
        if (res.ok && res.data) {
            ExamContext.setQuizzes(res.data.questions || []);
            StudentContext.setRegisteredStudents(res.data.students || []);
            populateQuizDropdowns();
        }
    } catch (e) {}
}

window.resetStudentView = resetStudentView;
