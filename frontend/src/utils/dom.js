/**
 * ExamLAN Pro - DOM Utility Helpers
 */

export function $(selector, parent = document) {
    if (typeof selector !== 'string') return selector;
    return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
    if (typeof selector !== 'string') return [selector];
    return Array.from(parent.querySelectorAll(selector));
}

export function show(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.classList.remove('hidden');
}

export function hide(element) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.classList.add('hidden');
}

export function toggle(element, shouldShow) {
    const el = typeof element === 'string' ? $(element) : element;
    if (!el) return;
    if (shouldShow === undefined) {
        el.classList.toggle('hidden');
    } else if (shouldShow) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

export function setText(element, text) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.textContent = text !== null && text !== undefined ? String(text) : '';
}

export function setHtml(element, html) {
    const el = typeof element === 'string' ? $(element) : element;
    if (el) el.innerHTML = html !== null && html !== undefined ? String(html) : '';
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
