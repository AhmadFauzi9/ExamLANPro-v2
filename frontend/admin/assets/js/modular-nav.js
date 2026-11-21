/**
 * ExamLAN Pro - Universal Modular Navbar & Sidebar Navigation Component
 * 
 * Satu komponen navbar & sidebar terpadu yang dapat digunakan di:
 * 1. Seluruh halaman Guru / Admin (dengan mode: 'admin')
 * 2. Halaman Siswa / Portal Utama (dengan mode: 'student')
 */

(function(global) {
    'use strict';

    // 1. Deteksi APP_ROOT dan ADMIN_BASE secara mandiri
    function getAppRoot() {
        if (typeof global.APP_ROOT === 'string' && global.APP_ROOT) {
            return global.APP_ROOT;
        }
        const p = window.location.pathname;
        const idx = p.indexOf('/frontend');
        if (idx !== -1) return p.substring(0, idx) + '/';
        const idx2 = p.indexOf('/admin');
        if (idx2 !== -1) return p.substring(0, idx2) + '/';
        const lastSlash = p.lastIndexOf('/');
        if (lastSlash > 0) {
            return p.substring(0, lastSlash + 1);
        }
        return '/';
    }

    function getAdminBase() {
        if (typeof global.GURU_BASE === 'string' && global.GURU_BASE) {
            return global.GURU_BASE;
        }
        const p = window.location.pathname;
        const idx = p.indexOf('/admin');
        if (idx !== -1) {
            return p.substring(0, idx + 6) + '/';
        }
        const idx2 = p.indexOf('/guru');
        if (idx2 !== -1) {
            return p.substring(0, idx2 + 5) + '/';
        }
        return getAppRoot() + 'frontend/admin/';
    }

    // 2. Deteksi Mode Navbar ('student' atau 'admin')
    function detectMode(targetElement = null) {
        if (targetElement && targetElement.getAttribute('data-mode')) {
            return targetElement.getAttribute('data-mode').toLowerCase();
        }
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/admin') || path.includes('/guru')) {
            return 'admin';
        }
        return 'student';
    }

    // 3. Daftar Menu Standar Dashboard Guru / Admin
    const MENU_ITEMS = [
        { key: 'bank-soal', title: 'Bank Soal', icon: 'fa-folder-plus', path: 'bank-soal/' },
        { key: 'data-siswa', title: 'Data Siswa', icon: 'fa-users', path: 'data-siswa/' },
        { key: 'hasil-ujian', title: 'Hasil Ujian', icon: 'fa-chart-line', path: 'hasil-ujian/' },
        { key: 'monitoring', title: 'Monitoring Ujian', icon: 'fa-tower-broadcast', path: 'monitoring/' },
        { key: 'notifikasi', title: 'Permintaan Waktu', icon: 'fa-clock-rotate-left', path: 'notifikasi/', badgeId: 'sidebar-notif-badge' },
        { key: 'audit-log', title: 'Audit Log', icon: 'fa-shield-halved', path: 'audit-log/' },
        { key: 'pengaturan', title: 'Pengaturan', icon: 'fa-gear', path: 'pengaturan/' }
    ];

    // 4. Tentukan Menu Aktif Berdasarkan URL
    function detectActiveMenu() {
        const path = window.location.pathname.toLowerCase();
        for (const m of MENU_ITEMS) {
            if (path.includes('/' + m.key)) return m.key;
        }
        if (path.includes('/permintaan-waktu')) return 'notifikasi';
        return 'hasil-ujian';
    }

    // 5. Template Generator Navbar (Mendukung Admin & Student)
    function createNavbarHTML(options = {}) {
        const mode = options.mode || 'admin';
        const adminBase = getAdminBase();
        const version = options.version || 'v2.0';
        const subtitle = options.subtitle || (mode === 'admin' 
            ? 'Server Evaluasi Lab Komputer' 
            : 'Sistem Evaluasi Lab Komputer Terintegrasi');

        let rightSideHTML = '';

        if (mode === 'student') {
            rightSideHTML = `
                <!-- Profil Peserta di Kanan Navbar (NIS, Kelas, Nama, & Logout) -->
                <div id="navbar-student-profile" class="hidden items-center gap-1.5 sm:gap-2.5 bg-slate-800/80 border border-slate-700/80 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl ml-auto min-w-0 max-w-[68%] sm:max-w-none shadow-xs">
                    <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 text-brand-300 flex items-center justify-center font-bold text-xs shrink-0">
                        <i class="fa-solid fa-user-graduate text-xs sm:text-sm"></i>
                    </div>
                    <div class="text-left leading-tight min-w-0 flex-1">
                        <div id="nav-student-name" class="font-bold text-[11px] sm:text-sm text-white truncate max-w-full sm:max-w-[220px]">-</div>
                        <div class="text-[9px] sm:text-[11px] text-slate-400 flex items-center gap-1 sm:gap-1.5 mt-0.5 font-mono min-w-0">
                            <span class="hidden sm:inline text-slate-500">NIS:</span>
                            <span id="nav-student-nis" class="text-brand-300 font-semibold shrink-0">-</span>
                            <span class="text-slate-600 shrink-0">•</span>
                            <span id="nav-student-class" class="text-slate-300 truncate min-w-0">-</span>
                        </div>
                    </div>
                    <!-- Tombol Logout Siswa -->
                    <div class="h-5 sm:h-6 w-px bg-slate-700 mx-0.5 sm:mx-1 shrink-0"></div>
                    <button type="button" id="btn-navbar-student-logout" onclick="window.handleStudentLogout ? window.handleStudentLogout() : (window.ModularNav ? window.ModularNav.handleStudentLogout() : null)" class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group shrink-0" title="Logout / Keluar dari Akun Siswa">
                        <i class="fa-solid fa-right-from-bracket text-xs text-rose-400 group-hover:text-white transition-colors"></i>
                        <span class="hidden sm:inline">Logout</span>
                    </button>
                </div>
            `;
        } else {
            rightSideHTML = `
                <div class="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
                    <!-- Admin Extension Bell (Permintaan Waktu Siswa) -->
                    <a id="admin-bell-btn" href="${adminBase}notifikasi/" class="relative p-2 px-2.5 sm:px-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition focus:outline-none" title="Permintaan Waktu Siswa">
                        <i class="fa-solid fa-bell text-sm sm:text-base"></i>
                        <span id="admin-bell-dot" class="hidden absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse"></span>
                    </a>

                    <!-- Panduan Jaringan LAN -->
                    <button type="button" onclick="window.AdminNav ? window.AdminNav.openLanGuide() : null" class="relative p-2 px-2.5 sm:px-3 hover:text-white hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer" title="Informasi IP Server & Akses LAN Siswa">
                        <i class="fa-solid fa-circle-question text-sm sm:text-base"></i>
                        <span class="hidden sm:inline text-[11px] text-slate-300">Info LAN</span>
                    </button>
                </div>
            `;
        }

        return `
            <header class="bg-slate-900 text-white shadow-md sticky top-0 z-30">
                <div class="w-full px-2.5 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex justify-between items-center gap-1.5 sm:gap-3">
                    <div class="flex items-center space-x-1.5 sm:space-x-2 shrink-0 min-w-0">
                        <div class="bg-brand-600 p-1.5 sm:p-2 sm:px-2.5 rounded-lg text-white flex items-center justify-center shadow-xs shrink-0">
                            <i class="fa-solid fa-network-wired text-base sm:text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <h1 class="font-bold text-sm sm:text-lg leading-tight flex items-center gap-1.5 whitespace-nowrap">
                                <span>ExamLAN Pro</span>
                                <span class="hidden sm:inline-block bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">${version}</span>
                            </h1>
                            <p class="text-xs text-slate-400 hidden sm:block truncate">${subtitle}</p>
                        </div>
                    </div>

                    ${rightSideHTML}
                </div>
            </header>
        `;
    }

    // 6. Template Generator Sidebar
    function createSidebarHTML(activeKey = null) {
        const adminBase = getAdminBase();
        const currentActive = activeKey || detectActiveMenu();

        return `
            <nav class="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-row md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible custom-scrollbar">
                ${MENU_ITEMS.map(m => {
                    const isActive = m.key === currentActive;
                    const activeClass = isActive
                        ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 font-medium hover:text-slate-900';
                    const iconColor = isActive ? 'text-brand-600' : 'text-slate-400';
                    return `
                        <a href="${adminBase}${m.path}" class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition shrink-0 md:shrink ${activeClass}">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <i class="fa-solid ${m.icon} w-4 text-center text-sm ${iconColor}"></i>
                                <span class="whitespace-nowrap">${m.title}</span>
                            </div>
                            ${m.badgeId ? `<span id="${m.badgeId}" class="hidden ml-auto bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">0</span>` : ''}
                        </a>
                    `;
                }).join('')}
                <hr class="hidden md:block my-1.5 border-slate-100">
                <button type="button" onclick="window.AdminNav ? window.AdminNav.handleLogout() : null" class="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-medium transition w-full text-left cursor-pointer">
                    <i class="fa-solid fa-right-from-bracket w-4 text-center text-sm text-rose-500"></i>
                    <span>Logout</span>
                </button>
            </nav>
        `;
    }

    // 7. Injeksi Modal Terpadu (Hanya untuk Admin)
    function ensureModals() {
        if (!document.getElementById('server-auth-modal')) {
            const authDiv = document.createElement('div');
            authDiv.id = 'server-auth-modal';
            authDiv.className = 'hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4';
            authDiv.innerHTML = `
                <div class="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                    <div class="text-center space-y-1.5">
                        <div class="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto text-xl">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <h3 class="text-base font-bold text-slate-800">Login Guru / Server</h3>
                        <p class="text-xs text-slate-500">Masukkan password pengawas ujian untuk membuka dashboard.</p>
                    </div>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">Password Guru</label>
                            <input type="text" id="server-password-input" name="server_auth_key" required autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other" onkeydown="if(event.key === 'Enter') (typeof verifyServerPassword === 'function' ? verifyServerPassword(event) : null)" style="-webkit-text-security: disc; text-security: disc;" placeholder="Masukkan password..." class="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs">
                        </div>
                        <button type="button" onclick="typeof verifyServerPassword === 'function' ? verifyServerPassword(event) : null" class="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
                            Masuk Dashboard
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(authDiv);
        }

        if (!document.getElementById('lan-guide-modal')) {
            const lanDiv = document.createElement('div');
            lanDiv.id = 'lan-guide-modal';
            lanDiv.className = 'hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4';
            const portalUrl = `http://${window.location.hostname || 'IP_SERVER'}${getAppRoot()}`;
            lanDiv.innerHTML = `
                <div class="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    <div class="flex items-center justify-between border-b pb-2.5">
                        <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <i class="fa-solid fa-network-wired text-brand-600"></i> Informasi Jaringan LAN
                        </h3>
                        <button type="button" onclick="window.AdminNav ? window.AdminNav.closeLanGuide() : null" class="text-slate-400 hover:text-slate-600 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="space-y-2 text-xs text-slate-600">
                        <p>Agar siswa di lab dapat mengakses ujian melalui jaringan LAN, bagikan alamat berikut kepada siswa:</p>
                        <div class="p-2.5 bg-slate-100 rounded-xl font-mono text-xs font-bold text-brand-700 text-center select-all">
                            ${portalUrl}
                        </div>
                        <p class="text-[11px] text-slate-500">Pastikan perangkat server dan komputer siswa terhubung ke Switch/Access Point yang sama.</p>
                        <div class="p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-sky-900 space-y-1.5 mt-2">
                            <p class="font-bold text-[11px] flex items-center gap-1.5">
                                <i class="fa-solid fa-shield-halved text-sky-600"></i> Mode Kiosk 100% Terkunci (Tanpa Tombol X & Anti-ESC):
                            </p>
                            <p class="text-[10px] text-slate-600 leading-relaxed">
                                Jalankan ujian di PC lab menggunakan parameter Kiosk resmi agar tombol X atas hilang total dan penekanan/penahanan tombol ESC tidak dapat keluar dari ujian:
                            </p>
                            <button type="button" onclick="window.AdminNav ? window.AdminNav.downloadKioskLauncher() : null" class="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs">
                                <i class="fa-solid fa-download"></i> Unduh Launcher Kiosk Siswa (.bat)
                            </button>
                        </div>
                    </div>
                    <div class="flex justify-end pt-2 border-t">
                        <button type="button" onclick="window.AdminNav ? window.AdminNav.closeLanGuide() : null" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer">Tutup</button>
                    </div>
                </div>
            `;
            document.body.appendChild(lanDiv);
        }
    }

    // 8. Core Navigation Controller Object
    const AdminNav = {
        getAppRoot,
        getAdminBase,
        MENU_ITEMS,
        detectActiveMenu,
        detectMode,

        renderNavbar(container, options = {}) {
            const target = typeof container === 'string' ? document.getElementById(container) : container;
            if (target) {
                target.classList.add('sticky', 'top-0', 'z-30');
                const mode = options.mode || detectMode(target);
                target.innerHTML = createNavbarHTML({ ...options, mode });
            }
        },

        renderSidebar(container, activeKey = null) {
            const target = typeof container === 'string' ? document.getElementById(container) : container;
            if (target) {
                target.innerHTML = createSidebarHTML(activeKey);
            }
        },

        updateStudentProfile(name = '', nis = '', classId = '') {
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
        },

        openLanGuide() {
            ensureModals();
            const modal = document.getElementById('lan-guide-modal');
            if (modal) modal.classList.remove('hidden');
        },

        closeLanGuide() {
            const modal = document.getElementById('lan-guide-modal');
            if (modal) modal.classList.add('hidden');
        },

        downloadKioskLauncher() {
            const portalUrl = `http://${window.location.hostname || 'localhost'}${getAppRoot()}`;
            const batContent = `@echo off\r\n` +
                `title ExamLAN Pro - Mode Kiosk Resmi CBT\r\n` +
                `echo ====================================================\r\n` +
                `echo Membuka ExamLAN Pro dalam Mode Kiosk Resmi CBT...\r\n` +
                `echo ====================================================\r\n` +
                `where msedge >nul 2>&1\r\n` +
                `if %ERRORLEVEL% equ 0 (\r\n` +
                `    start "" msedge --kiosk "${portalUrl}" --edge-kiosk-type=fullscreen --no-first-run\r\n` +
                `    exit\r\n` +
                `)\r\n` +
                `where chrome >nul 2>&1\r\n` +
                `if %ERRORLEVEL% equ 0 (\r\n` +
                `    start "" chrome --kiosk "${portalUrl}" --no-first-run\r\n` +
                `    exit\r\n` +
                `)\r\n` +
                `start "${portalUrl}"\r\n` +
                `exit\r\n`;
            const blob = new Blob([batContent], { type: 'application/x-bat' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = "Buka-Ujian-Siswa-Kiosk.bat";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        handleLogout() {
            if (typeof global.handleLogout === 'function') {
                global.handleLogout();
                return;
            }
            if (confirm('Apakah Anda yakin ingin logout dari Dashboard Guru?')) {
                try {
                    sessionStorage.removeItem('examlan_server_authenticated');
                    localStorage.removeItem('examlan_server_authenticated');
                } catch (e) {}
                window.location.reload();
            }
        },

        handleStudentLogout() {
            if (typeof global.handleStudentLogout === 'function') {
                global.handleStudentLogout();
                return;
            }
            if (typeof global.resetStudentView === 'function') {
                if (confirm('Apakah Anda yakin ingin logout dari akun peserta ujian?')) {
                    global.resetStudentView();
                }
                return;
            }
            if (confirm('Apakah Anda yakin ingin logout dari akun peserta ujian?')) {
                try {
                    sessionStorage.clear();
                    localStorage.removeItem('examlan_active_attempt');
                    localStorage.removeItem('examlan_pending_exam_info');
                    localStorage.removeItem('examlan_student_session');
                    localStorage.removeItem('examlan_pending_resume_info');
                    localStorage.removeItem('examlan_pending_answers');
                } catch (e) {}
                window.location.reload();
            }
        },

        init() {
            // Temukan target Navbar (mendukung placeholder modular standar dan legacy)
            const navbarTarget = document.getElementById('navbar-placeholder')
                || document.getElementById('admin-navbar')
                || document.getElementById('navbar')
                || document.getElementById('guru-header-placeholder')
                || document.querySelector('[data-modular-navbar]');

            if (navbarTarget) {
                const mode = detectMode(navbarTarget);
                this.renderNavbar(navbarTarget, { mode });

                // Injeksi modal hanya untuk admin
                if (mode === 'admin') {
                    ensureModals();
                }
            }

            // Temukan target Sidebar (mendukung placeholder modular standar dan legacy)
            const sidebarTarget = document.getElementById('sidebar-placeholder')
                || document.getElementById('admin-sidebar')
                || document.getElementById('sidebar')
                || document.getElementById('guru-sidebar-placeholder')
                || document.querySelector('[data-modular-sidebar]');

            if (sidebarTarget) {
                this.renderSidebar(sidebarTarget);
            }
        }
    };

    // Ekspor ke window global
    global.AdminNav = AdminNav;
    global.ModularNav = AdminNav;

    // Auto-initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AdminNav.init());
    } else {
        AdminNav.init();
    }
})(typeof window !== 'undefined' ? window : this);
