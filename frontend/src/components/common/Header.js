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

    if (nameEl) nameEl.textContent = name || '-';
    if (nisEl) nisEl.textContent = nis ? `NIS: ${nis}` : '-';
    if (classEl) classEl.textContent = classId ? `Kelas: ${classId}` : '-';

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
