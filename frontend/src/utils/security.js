/**
 * ExamLAN Pro - Client Security & Anti-Cheating Helpers (Mode Kiosk Resmi)
 */

export function isProhibitedKeyCombo(e) {
    const key = (e.key || '').toLowerCase();

    // F12 (DevTools), F11 (Toggle Fullscreen)
    if (e.key === 'F12' || e.keyCode === 123 || e.key === 'F11' || e.keyCode === 122) {
        return { prohibited: true, reason: 'Menekan tombol fungsi ' + e.key };
    }

    // Tombol Windows (Start Menu) / Meta Key
    if (e.key === 'Meta' || e.key === 'OS' || e.code === 'MetaLeft' || e.code === 'MetaRight' || e.keyCode === 91 || e.keyCode === 92) {
        return { prohibited: true, reason: 'Menekan tombol Windows (Start Menu)' };
    }

    // Ctrl+Shift+I / J / C (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)) {
        return { prohibited: true, reason: 'Mencoba membuka Developer Tools (Ctrl+Shift+' + key.toUpperCase() + ')' };
    }

    // Ctrl+N (new window), Ctrl+T (new tab), Ctrl+W (close tab), Ctrl+U (view source)
    if ((e.ctrlKey || e.metaKey) && ['n', 't', 'w', 'i', 'j', 'u'].includes(key)) {
        return { prohibited: true, reason: 'Mencoba tombol pintasan Ctrl+' + key.toUpperCase() };
    }

    return { prohibited: false };
}

export function isReloadKeyCombo(e) {
    const key = (e.key || '').toLowerCase();
    return e.key === 'F5' || e.keyCode === 116 || ((e.ctrlKey || e.metaKey) && key === 'r');
}

