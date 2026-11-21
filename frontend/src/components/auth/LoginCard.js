/**
 * ExamLAN Pro - Student Login Card Component
 */

import { StudentContext } from '../../context/StudentContext.js';
import { ExamContext } from '../../context/ExamContext.js';
import { authApi } from '../../api/authApi.js';
import { appAlert } from '../common/Modal.js';
import { showToast } from '../common/Toast.js';
import { renderExamInfoScreen } from './ExamInfoCard.js';
import { showResumeTokenScreen } from './ResumeTokenModal.js';
import { hydrateAttempt } from '../quiz/QuizScreen.js';

export function handleNisInput(input) {
    if (!input) return;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 6);
    const nis = input.value.trim();
    const nameInput = document.getElementById('student-name');
    const classInput = document.getElementById('student-class');
    if (!nameInput || !classInput) return;

    const students = StudentContext.registeredStudents || [];
    const matched = students.find(s => String(s.nis).trim() === nis);

    if (matched && nis !== '') {
        nameInput.value = matched.name || '';
        classInput.value = matched.class || '';
        nameInput.readOnly = true;
        classInput.readOnly = true;
        nameInput.classList.add('bg-slate-100', 'cursor-not-allowed');
        classInput.classList.add('bg-slate-100', 'cursor-not-allowed');
    } else {
        nameInput.value = '';
        classInput.value = '';
        nameInput.readOnly = false;
        classInput.readOnly = false;
        nameInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
        classInput.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }
}

export function populateQuizDropdowns() {
    const studentSelect = document.getElementById('student-quiz-select');
    if (!studentSelect) return;
    const quizzes = ExamContext.quizzes || [];
    studentSelect.innerHTML = quizzes.map(q => 
        `<option value="${q.id}">${q.title} (${(q.questions || []).length} Soal - ${q.duration} Menit)</option>`
    ).join('');
}

export function toggleStudentLoginPassword() {
    const input = document.getElementById('student-auth-code');
    const icon = document.getElementById('login-pass-icon');
    if (!input || !icon) return;
    const isMasked = (input.style.webkitTextSecurity !== 'none');
    if (isMasked) {
        input.style.webkitTextSecurity = 'none';
        icon.className = 'fa-solid fa-eye-slash text-sm text-brand-600';
    } else {
        input.style.webkitTextSecurity = 'disc';
        icon.className = 'fa-solid fa-eye text-sm text-slate-400';
    }
}

export async function handleStudentLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const quizId = document.getElementById('student-quiz-select')?.value;
    const nis = document.getElementById('student-nis')?.value.trim();
    const name = document.getElementById('student-name')?.value.trim();
    const classId = document.getElementById('student-class')?.value.trim();
    const passInput = document.getElementById('student-auth-code');
    const password = passInput ? passInput.value.trim() : '';
    const reqPassword = StudentContext.requirePassword;

    if (nis && nis.length > 6) {
        appAlert("NIS maksimal terdiri dari 6 digit angka!");
        return;
    }
    if (!nis || !name || !classId) {
        appAlert("Harap lengkapi semua data identitas peserta!");
        return;
    }
    if (reqPassword && !password) {
        appAlert("Harap masukkan kode akses / sandi siswa!\nKode sandi diperoleh dari guru pengawas ruang.", "Kode Sandi Diperlukan");
        passInput?.focus();
        return;
    }

    const quizzes = ExamContext.quizzes || [];
    const selectedQuiz = quizzes.find(q => q.id === quizId);
    if (!selectedQuiz || !selectedQuiz.questions || !selectedQuiz.questions.length) {
        appAlert('Kuis tidak ditemukan atau belum memiliki soal!');
        return;
    }

    // Bersihkan isi input dari DOM sekarang juga sebelum request untuk keamanan kredensial
    if (passInput) passInput.value = '';

    const loginBtn = document.getElementById('btn-student-login');
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sm"></i> <span>Memeriksa Akun...</span>`;
    }

    try {
        const res = await authApi.studentLogin({ nis, password, quiz_id: quizId, name, class: classId });
        const data = res.data;

        if (!res.ok || data?.status !== 'success') {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = `<span>Login</span> <i class="fa-solid fa-right-to-bracket text-sm"></i>`;
            }
            if (passInput) {
                passInput.value = password;
                passInput.select();
            }
            appAlert(data?.message || 'Login gagal. Periksa kembali NIS dan Kode Sandi.', 'Autentikasi Gagal');
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `<span>Login</span> <i class="fa-solid fa-right-to-bracket text-sm"></i>`;
        }

        // Skenario Pemulihan Sesi jika token aktif diperlukan oleh pengawas
        if (data.needs_resume_token) {
            showResumeTokenScreen({
                nis,
                password,
                student: data.student,
                quiz: data.quiz
            });
            return;
        }

        // Skenario Pemulihan Sesi Otomatis
        if (data.resume_attempt && data.attempt) {
            hydrateAttempt(data.attempt);
            showToast(data.message || 'Sesi ujian berhasil dipulihkan!');
            return;
        }

        // Tampilkan Informasi Ujian & Simpan ke Session Storage
        const mergedQuiz = {
            ...(selectedQuiz || {}),
            ...(data.quiz || {})
        };
        renderExamInfoScreen({
            quizId,
            nis,
            name: data.student?.name || name,
            classId: data.student?.class || classId,
            password: password,
            quiz: mergedQuiz
        });

    } catch (err) {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `<span>Login</span> <i class="fa-solid fa-right-to-bracket text-sm"></i>`;
        }
        appAlert('Gagal menghubungi server untuk memvalidasi login. Periksa koneksi LAN lalu coba lagi.', 'Koneksi Error');
    }
}
