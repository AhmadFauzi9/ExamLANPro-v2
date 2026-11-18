/**
 * ExamLAN Pro - Authentication & Student Profile API
 */

import { apiRequest } from './apiClient.js';

export const authApi = {
    /**
     * Mengambil paket kuis dan data siswa terdaftar (tanpa kunci jawaban)
     */
    async getStudentData() {
        return apiRequest('get_student_data');
    },

    /**
     * Memvalidasi login siswa atau token resume ujian
     */
    async studentLogin(payload) {
        return apiRequest('student_login', {
            method: 'POST',
            data: payload
        });
    }
};
