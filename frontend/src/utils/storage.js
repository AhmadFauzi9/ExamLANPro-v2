/**
 * ExamLAN Pro - Secure Session Storage Utility
 * 
 * PENTING UNTUK KEAMANAN:
 * Aplikasi sengaja TIDAK menggunakan window.localStorage untuk menjaga keamanan data ujian
 * di lingkungan laboratorium komputer bersama. Data di localStorage akan bertahan selamanya
 * dan dapat diakses siswa berikutnya.
 * 
 * Seluruh data pengerjaan, sesi siswa, dan token ujian disimpan di sessionStorage
 * (yang otomatis musnah ketika tab atau jendela browser ditutup).
 */

const memoryStore = new Map();

/**
 * Cek apakah sessionStorage didukung dan dapat diakses
 */
function isSessionStorageAvailable() {
    try {
        const testKey = '__examlan_test__';
        window.sessionStorage.setItem(testKey, testKey);
        window.sessionStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

const hasSessionStorage = typeof window !== 'undefined' && isSessionStorageAvailable();

export const Storage = {
    KEYS: {
        ACTIVE_ATTEMPT: 'examlan_active_attempt',
        PENDING_ANSWERS: 'examlan_pending_answers',
        STUDENT_SESSION: 'examlan_student_session',
        PENDING_EXAM_INFO: 'examlan_pending_exam_info',
        PENDING_RESUME_INFO: 'examlan_pending_resume_info'
    },

    /**
     * Bersihkan sisa data legacy localStorage dari komputer lab jika ada
     */
    purgeLegacyLocalStorage() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const keysToRemove = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k && k.startsWith('examlan_')) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => {
                    try { window.localStorage.removeItem(k); } catch (e) {}
                });
            }
        } catch (e) {
            console.warn('Gagal membersihkan legacy localStorage:', e);
        }
    },

    get(key) {
        try {
            if (hasSessionStorage) {
                const item = window.sessionStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            }
            return memoryStore.get(key) || null;
        } catch (e) {
            console.warn(`Gagal membaca key ${key} dari sessionStorage:`, e);
            return null;
        }
    },

    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            if (hasSessionStorage) {
                window.sessionStorage.setItem(key, serialized);
            }
            memoryStore.set(key, value);
        } catch (e) {
            console.warn(`Gagal menyimpan key ${key} ke sessionStorage:`, e);
            memoryStore.set(key, value);
        }
    },

    remove(key) {
        try {
            if (hasSessionStorage) {
                window.sessionStorage.removeItem(key);
            }
            memoryStore.delete(key);
        } catch (e) {}
    },

    // --- Helper Khusus untuk Sesi Siswa & Ujian ---

    getActiveAttempt() {
        return this.get(this.KEYS.ACTIVE_ATTEMPT);
    },

    setActiveAttempt(attemptData) {
        if (!attemptData) {
            this.clearActiveAttempt();
            return;
        }
        this.set(this.KEYS.ACTIVE_ATTEMPT, attemptData);
    },

    clearActiveAttempt() {
        this.remove(this.KEYS.ACTIVE_ATTEMPT);
    },

    getPendingAnswers() {
        return this.get(this.KEYS.PENDING_ANSWERS);
    },

    setPendingAnswers(answers) {
        if (!answers) {
            this.clearPendingAnswers();
            return;
        }
        this.set(this.KEYS.PENDING_ANSWERS, answers);
    },

    clearPendingAnswers() {
        this.remove(this.KEYS.PENDING_ANSWERS);
    },

    getStudentSession() {
        return this.get(this.KEYS.STUDENT_SESSION);
    },

    setStudentSession(sessionData) {
        if (!sessionData) {
            this.clearStudentSession();
            return;
        }
        this.set(this.KEYS.STUDENT_SESSION, sessionData);
    },

    clearStudentSession() {
        this.remove(this.KEYS.STUDENT_SESSION);
    },

    getPendingExamInfo() {
        return this.get(this.KEYS.PENDING_EXAM_INFO);
    },

    setPendingExamInfo(info) {
        if (!info) {
            this.clearPendingExamInfo();
            return;
        }
        this.set(this.KEYS.PENDING_EXAM_INFO, info);
    },

    clearPendingExamInfo() {
        this.remove(this.KEYS.PENDING_EXAM_INFO);
    },

    getPendingResumeInfo() {
        return this.get(this.KEYS.PENDING_RESUME_INFO);
    },

    setPendingResumeInfo(info) {
        if (!info) {
            this.clearPendingResumeInfo();
            return;
        }
        this.set(this.KEYS.PENDING_RESUME_INFO, info);
    },

    clearPendingResumeInfo() {
        this.remove(this.KEYS.PENDING_RESUME_INFO);
    },

    clearAllExamData() {
        Object.values(this.KEYS).forEach(k => this.remove(k));
    }
};

// Segera bersihkan legacy localStorage saat modul dimuat
Storage.purgeLegacyLocalStorage();
