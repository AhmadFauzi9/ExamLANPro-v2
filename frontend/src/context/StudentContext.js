/**
 * ExamLAN Pro - Student Session Context
 */

class StudentContextState {
    constructor() {
        this.activeStudent = { nis: '', name: '', classId: '' };
        this.registeredStudents = [];
        this.requirePassword = true;
        this.reviewToken = null;
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(fn => {
            try { fn(this); } catch (e) { console.error(e); }
        });
    }

    setStudent(student) {
        this.activeStudent = {
            nis: student?.nis || '',
            name: student?.name || '',
            classId: student?.classId || student?.class || ''
        };
        this.notify();
    }

    setRegisteredStudents(students) {
        this.registeredStudents = Array.isArray(students) ? students : [];
        this.notify();
    }

    setRequirePassword(required) {
        this.requirePassword = required !== false;
        this.notify();
    }

    setReviewToken(token) {
        this.reviewToken = token || null;
        this.notify();
    }

    clear() {
        this.activeStudent = { nis: '', name: '', classId: '' };
        this.reviewToken = null;
        this.notify();
    }
}

export const StudentContext = new StudentContextState();
