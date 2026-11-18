/**
 * ExamLAN Pro - Client Security & Anti-Cheating Helpers
 */

export function isProhibitedKeyCombo(e) {
    const key = (e.key || '').toLowerCase();

    // F12 (DevTools), F11 (Toggle Fullscreen)
    if (e.key === 'F12' || e.keyCode === 123 || e.key === 'F11' || e.keyCode === 122) {
        return { prohibited: true, reason: 'Menekan tombol fungsi ' + e.key };
    }

    // Ctrl+N (new window), Ctrl+T (new tab), Ctrl+W (close tab), Ctrl+Shift+I (devtools), Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U (view source)
    if ((e.ctrlKey || e.metaKey) && ['n', 't', 'w', 'i', 'j', 'u'].includes(key)) {
        return { prohibited: true, reason: 'Mencoba tombol pintasan Ctrl+' + key.toUpperCase() };
    }

    return { prohibited: false };
}

export function isReloadKeyCombo(e) {
    const key = (e.key || '').toLowerCase();
    return e.key === 'F5' || e.keyCode === 116 || ((e.ctrlKey || e.metaKey) && key === 'r');
}
