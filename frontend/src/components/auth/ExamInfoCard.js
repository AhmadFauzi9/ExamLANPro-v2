/**
 * ExamLAN Pro - Exam Information Screen Component
 */

import { ExamContext } from '../../context/ExamContext.js';
import { StudentContext } from '../../context/StudentContext.js';
import { Storage } from '../../utils/storage.js';
import { examApi } from '../../api/examApi.js';
import { formatIndonesianDate, TYPE_LABELS } from '../../utils/formatters.js';
import { enterFullScreen } from '../../hooks/useAntiCheat.js';
import { updateNavbarStudentProfile } from '../common/Header.js';
import { appAlert } from '../common/Modal.js';
import { hydrateAttempt } from '../quiz/QuizScreen.js';

export function checkQuizNeedsToken(quiz) {
    if (!quiz) return false;
    if (quiz.has_token !== undefined) return Boolean(quiz.has_token);
    if (quiz.pin_enabled !== undefined) return Boolean(quiz.pin_enabled);
    if (quiz.pin !== undefined) return Boolean(quiz.pin && String(quiz.pin).trim() !== '');
    return false;
}

export function renderExamInfoScreen(info) {
    if (!info) return;

    ExamContext.setPendingExamInfo(info);
    Storage.setPendingExamInfo(info);
    updateNavbarStudentProfile(info.name, info.nis, info.classId);

    const quizzes = ExamContext.quizzes || [];
    const selectedQuiz = info.quiz || quizzes.find(q => q.id === info.quizId);
    if (selectedQuiz) info.quiz = selectedQuiz;

    const nameEl = document.getElementById('info-student-name');
    const nisEl = document.getElementById('info-student-nis');
    const classEl = document.getElementById('info-student-class');
    const titleEl = document.getElementById('info-quiz-title');
    const questionsEl = document.getElementById('info-quiz-questions');
    const kkmEl = document.getElementById('info-quiz-kkm');
    const typesEl = document.getElementById('info-quiz-types');
    const dateEl = document.getElementById('info-exam-date');

    const durationEl = document.getElementById('info-quiz-duration');
    const subtitleEl = document.getElementById('info-exam-subtitle');

    if (nameEl) nameEl.innerText = info.name || '-';
    if (nisEl) nisEl.innerText = info.nis || '-';
    if (classEl) classEl.innerText = info.classId || '-';

    if (selectedQuiz) {
        if (titleEl) titleEl.innerText = selectedQuiz.title || '-';
        const totalQ = (selectedQuiz.questions || []).length;
        const maxQ = (selectedQuiz.max_questions && selectedQuiz.max_questions > 0) ? parseInt(selectedQuiz.max_questions) : 0;
        if (questionsEl) {
            if (maxQ > 0 && maxQ < totalQ) {
                questionsEl.innerHTML = `<span>${maxQ} Soal Acak</span><span class="block text-[10px] text-slate-400 font-normal">dari total ${totalQ} soal</span>`;
            } else {
                questionsEl.innerHTML = `<span>${totalQ} Soal</span>`;
            }
        }
        if (durationEl) {
            durationEl.innerText = `${selectedQuiz.duration || 0} Menit`;
        }

        const kkmVal = (selectedQuiz.kkm !== undefined && selectedQuiz.kkm !== null && !isNaN(Number(selectedQuiz.kkm))) ? Number(selectedQuiz.kkm) : 75;
        if (kkmEl) kkmEl.innerText = `KKM: ${kkmVal}`;

        const uniqueTypes = Array.from(new Set((selectedQuiz.questions || []).map(q => q.type || 'mc')));
        if (typesEl) {
            typesEl.innerHTML = uniqueTypes.map(t => 
                `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">${TYPE_LABELS[t] || t}</span>`
            ).join('');
        }
    }

    if (dateEl) {
        dateEl.innerHTML = `<i class="fa-regular fa-calendar text-slate-400 mr-1.5"></i><span>${formatIndonesianDate(new Date())}</span>`;
    }

    const hasToken = checkQuizNeedsToken(selectedQuiz);
    const tokenCard = document.getElementById('student-exam-token-container') || document.getElementById('exam-token-input')?.closest('.rounded-2xl');
    if (tokenCard) {
        if (!hasToken) {
            tokenCard.classList.add('hidden');
        } else {
            tokenCard.classList.remove('hidden');
        }
    }

    if (subtitleEl) {
        if (hasToken) {
            subtitleEl.innerText = 'Periksa kelengkapan data peserta dan masukkan Token Ujian dari guru pengawas';
        } else {
            subtitleEl.innerText = 'Periksa kelengkapan data peserta sebelum memulai ujian';
        }
    }

    const tokenInput = document.getElementById('exam-token-input');
    if (tokenInput && !tokenInput.value) tokenInput.value = '';

    const pwdInputEl = document.getElementById('student-auth-code');
    if (pwdInputEl) pwdInputEl.value = '';

    document.getElementById('student-login-card')?.classList.add('hidden');
    document.getElementById('student-resume-token-screen')?.classList.add('hidden');
    document.getElementById('student-quiz-screen')?.classList.add('hidden');
    document.getElementById('student-result-screen')?.classList.add('hidden');
    document.getElementById('student-exam-info-screen')?.classList.remove('hidden');

    if (hasToken && tokenInput) setTimeout(() => tokenInput.focus(), 150);
}

export function backToStudentLogin() {
    Storage.clearPendingExamInfo();
    Storage.clearPendingResumeInfo();
    ExamContext.setPendingExamInfo(null);
    ExamContext.setPendingResumeData(null);

    document.documentElement.classList.remove('has-active-session');
    updateNavbarStudentProfile('', '', '');

    document.getElementById('student-exam-info-screen')?.classList.add('hidden');
    document.getElementById('student-resume-token-screen')?.classList.add('hidden');
    document.getElementById('student-login-card')?.classList.remove('hidden');
}

export async function submitExamTokenAndStart() {
    enterFullScreen();
    const pendingSession = ExamContext.pendingExamInfo || Storage.getPendingExamInfo();
    if (!pendingSession) {
        backToStudentLogin();
        return;
    }

    const { quizId, nis, name, classId, password } = pendingSession;
    const quizzes = ExamContext.quizzes || [];
    const selectedQuiz = pendingSession.quiz || quizzes.find(q => q.id === quizId);
    const hasToken = checkQuizNeedsToken(selectedQuiz);

    const tokenInput = document.getElementById('exam-token-input');
    const pin = tokenInput ? tokenInput.value.trim().toUpperCase() : '';

    if (hasToken && !pin) {
        appAlert("Silakan masukkan Token Ujian terlebih dahulu!\nToken diberikan oleh guru pengawas ruang melalui halaman Bank Soal.", "Token Diperlukan");
        tokenInput?.focus();
        return;
    }

    try {
        const res = await examApi.startAttempt({
            quiz_id: quizId,
            nis: nis,
            name: name,
            class: classId,
            password: password || '',
            pin: pin
        });
        const d = res.data;

        if (!res.ok || d?.status !== 'success') {
            appAlert(d?.message || 'Token ujian tidak valid atau terjadi kendala.', 'Validasi Token Gagal');
            tokenInput?.select();
            return;
        }

        ExamContext.setAttemptToken(d.attempt_token);
        Storage.setActiveAttempt({
            token: d.attempt_token,
            nis: nis,
            name: name,
            classId: classId
        });
        Storage.clearPendingExamInfo();
        ExamContext.setPendingExamInfo(null);

        hydrateAttempt(d);
    } catch (err) {
        appAlert('Tidak dapat memulai ujian. Periksa koneksi LAN lalu coba lagi.', 'Koneksi Error');
    }
}

export function restorePendingStudentSessionAfterRefresh() {
    if (ExamContext.currentStudentResult || ExamContext.attemptToken) return false;
    try {
        const saved = Storage.getPendingExamInfo();
        if (!saved || !saved.nis || !saved.quizId) return false;

        const quizzes = ExamContext.quizzes || [];
        if (quizzes.length) {
            const freshQuiz = quizzes.find(q => q.id === saved.quizId);
            if (freshQuiz) saved.quiz = freshQuiz;
        }

        renderExamInfoScreen(saved);
        return true;
    } catch (e) {
        console.warn('Gagal memulihkan informasi ujian:', e);
        return false;
    }
}
