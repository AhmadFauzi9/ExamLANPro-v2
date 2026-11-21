/**
 * ExamLAN Pro - Exam Attempts, Submissions & Monitoring API
 */

import { apiRequest, API_BASE_URL } from './apiClient.js';

export const examApi = {
    /**
     * Memulai sesi ujian baru dengan token ujian / PIN
     */
    async startAttempt(payload) {
        return apiRequest('start_attempt', {
            method: 'POST',
            data: payload
        });
    },

    /**
     * Memulihkan status pengerjaan attempt yang sedang berjalan
     */
    async getAttempt(token) {
        return apiRequest('get_attempt', {
            data: { token }
        });
    },

    /**
     * Menyimpan berkala seluruh jawaban siswa ke server
     */
    async saveAnswers(attemptToken, answers) {
        return apiRequest('save_attempt_answers', {
            method: 'POST',
            data: {
                attempt_token: attemptToken,
                answers: answers
            }
        });
    },

    /**
     * Menyelesaikan dan mengumpulkan jawaban ujian
     */
    async submitResult(payload) {
        return apiRequest('submit_result', {
            method: 'POST',
            data: payload
        });
    },

    /**
     * Melaporkan kecurangan / pelanggaran layar ujian secara real-time
     */
    async reportViolation(payload) {
        try {
            const res = await apiRequest('report_student_violation', {
                method: 'POST',
                data: payload,
                keepalive: true
            });
            return res;
        } catch (err) {
            if (navigator.sendBeacon) {
                try {
                    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                    navigator.sendBeacon(`${API_BASE_URL}?action=report_student_violation`, blob);
                } catch (be) {}
            }
            return { ok: false, data: null };
        }
    },

    /**
     * Mengajukan permintaan perpanjangan waktu ke guru pengawas
     */
    async requestExtension(attemptToken, nis = '') {
        return apiRequest('request_extension', {
            method: 'POST',
            data: {
                attempt_token: attemptToken,
                nis: nis
            }
        });
    },

    /**
     * Mengecek status persetujuan perpanjangan waktu
     */
    async checkExtensionStatus(attemptToken, nis = '') {
        return apiRequest('check_extension_status', {
            data: {
                token: attemptToken,
                nis: nis
            }
        });
    }
};
