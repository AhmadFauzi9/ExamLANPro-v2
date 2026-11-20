/**
 * ExamLAN Pro - Shared Header & Sidebar Navigation Component (Backward Compatible Alias)
 * Menggunakan modular-nav.js sebagai komponen inti terpadu.
 */
(function() {
    // Muat modular-nav.js jika belum termuat
    if (typeof window.AdminNav === 'undefined' && typeof window.ModularNav === 'undefined') {
        const script = document.createElement('script');
        script.src = '../assets/js/modular-nav.js';
        script.onload = () => {
            if (window.AdminNav) window.AdminNav.init();
        };
        document.head.appendChild(script);
    } else {
        if (window.AdminNav) window.AdminNav.init();
    }
})();
