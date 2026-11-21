/**
 * ExamLAN Pro - Header & Navbar Component
 */

import { StudentContext } from '../../context/StudentContext.js';

export function updateNavbarStudentProfile(name = '', nis = '', classId = '') {
    const container = document.getElementById('navbar-student-profile');
    if (!container) return;

    if (!name && !nis) {
        container.classList.add('hidden');
        container.classList.remove('flex');
        return;
    }

    const nameEl = document.getElementById('nav-student-name');
    const nisEl = document.getElementById('nav-student-nis');
    const classEl = document.getElementById('nav-student-class');

    const cleanNis = String(nis || '').replace(/^NIS:\s*/i, '');
    const cleanClass = String(classId || '').replace(/^Kelas:\s*/i, '');

    if (nameEl) {
        nameEl.textContent = name || '-';
        nameEl.title = name || '';
    }
    if (nisEl) {
        nisEl.textContent = cleanNis || '-';
        nisEl.title = cleanNis ? `NIS: ${cleanNis}` : '';
    }
    if (classEl) {
        classEl.textContent = cleanClass || '-';
        classEl.title = cleanClass ? `Kelas: ${cleanClass}` : '';
    }

    container.classList.remove('hidden');
    container.classList.add('flex');
}

export function initHeader() {
    if (typeof window !== 'undefined' && window.ModularNav && typeof window.ModularNav.init === 'function') {
        window.ModularNav.init();
    }
    StudentContext.subscribe((ctx) => {
        const student = ctx.activeStudent;
        updateNavbarStudentProfile(student.name, student.nis, student.classId);
    });
}

export function handleStudentLogout() {
    if (typeof window !== 'undefined' && typeof window.handleStudentLogout === 'function') {
        return window.handleStudentLogout();
    }
}
