/**
 * ExamLAN Pro - Modal Dialogs Component
 */

let appModalResolve = null;

export function closeAppModal() {
    const modal = document.getElementById('app-modal');
    if (modal) modal.classList.add('hidden');
    if (appModalResolve) {
        const r = appModalResolve;
        appModalResolve = null;
        r(false);
    }
}

export function resolveAppModal(value) {
    const modal = document.getElementById('app-modal');
    if (modal) modal.classList.add('hidden');
    if (appModalResolve) {
        const r = appModalResolve;
        appModalResolve = null;
        r(value);
    }
}

export function appAlert(message, title = 'Informasi') {
    const modal = document.getElementById('app-modal');
    if (!modal) return;
    const titleEl = document.getElementById('app-modal-title');
    const msgEl = document.getElementById('app-modal-message');
    const actionsEl = document.getElementById('app-modal-actions');
    const iconEl = document.getElementById('app-modal-icon');

    if (iconEl) {
        iconEl.className = 'w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0';
        iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    }
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = String(message);
    if (actionsEl) {
        actionsEl.innerHTML = '<button type="button" id="btn-modal-close" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer">Tutup</button>';
        const btn = document.getElementById('btn-modal-close');
        if (btn) btn.onclick = closeAppModal;
    }
    modal.classList.remove('hidden');
}

export function appConfirm(message, title = 'Konfirmasi', cancelText = 'Batal', okText = 'Lanjutkan', okClass = 'bg-brand-600 hover:bg-brand-700 text-white') {
    return new Promise(resolve => {
        appModalResolve = resolve;
        const modal = document.getElementById('app-modal');
        if (!modal) return resolve(false);

        const titleEl = document.getElementById('app-modal-title');
        const msgEl = document.getElementById('app-modal-message');
        const actionsEl = document.getElementById('app-modal-actions');
        const iconEl = document.getElementById('app-modal-icon');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = String(message);

        const isDanger = okClass.includes('rose') || okClass.includes('red');
        if (iconEl) {
            if (isDanger) {
                iconEl.className = 'w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0';
                iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            } else {
                iconEl.className = 'w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0';
                iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
            }
        }

        if (actionsEl) {
            actionsEl.innerHTML = `
                <button type="button" id="btn-modal-cancel" class="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer">${cancelText}</button>
                <button type="button" id="btn-modal-ok" class="px-4 py-2 ${okClass} rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer">${okText}</button>
            `;
            const cancelBtn = document.getElementById('btn-modal-cancel');
            const okBtn = document.getElementById('btn-modal-ok');
            if (cancelBtn) cancelBtn.onclick = () => resolveAppModal(false);
            if (okBtn) okBtn.onclick = () => resolveAppModal(true);
        }
        modal.classList.remove('hidden');
    });
}

export function promptReloadExam() {
    const modal = document.getElementById('modal-confirm-reload');
    if (modal) modal.classList.remove('hidden');
}

export function closeConfirmReloadModal() {
    const modal = document.getElementById('modal-confirm-reload');
    if (modal) modal.classList.add('hidden');
}
