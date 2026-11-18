/**
 * ExamLAN Pro - Toast Notification Component
 */

export function showToast(message, type = 'warning') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass =
        type === 'danger'
            ? 'bg-rose-600 text-white'
            : type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-amber-500 text-slate-950';

    const icon =
        type === 'danger'
            ? 'fa-triangle-exclamation'
            : type === 'success'
            ? 'fa-circle-check'
            : 'fa-clock';

    toast.className = `p-4 rounded-xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold transition-all transform duration-300 pointer-events-auto ${bgClass}`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i> <span class="flex-1">${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}
