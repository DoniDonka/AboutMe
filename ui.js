/**
 * DONI | DEV - UI Enhancements Module (v3.0)
 * Theme system, toast notifications, sound FX, PWA install,
 * header controls, and scroll progress. Loaded on every page.
 */

const UI = (() => {
    const THEME_KEY = 'doni_theme';
    const ACCENT_KEY = 'doni_accent';
    const SOUND_KEY = 'doni_sound';
    const ACCENTS = ['green', 'blue', 'purple', 'orange', 'pink', 'cyan'];
    const ACCENT_HEX = {
        green: '#22c55e', blue: '#3b82f6', purple: '#a855f7',
        orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4'
    };

    // -------------------------------------------------------
    // THEME MANAGER
    // -------------------------------------------------------
    const Theme = {
        get() { return document.documentElement.getAttribute('data-theme') || 'dark'; },
        getAccent() { return localStorage.getItem(ACCENT_KEY) || 'green'; },

        apply(theme) {
            const root = document.documentElement;
            if (theme === 'light') root.setAttribute('data-theme', 'light');
            else root.removeAttribute('data-theme');
            localStorage.setItem(THEME_KEY, theme);
            this.updateMeta();
            this.updateToggleIcon();
        },

        toggle() {
            const next = this.get() === 'light' ? 'dark' : 'light';
            this.apply(next);
            Sound.play('click');
            UI.toast(`${next === 'light' ? '☀️' : '🌙'} ${next[0].toUpperCase() + next.slice(1)} mode`, 'info');
            const flips = (parseInt(localStorage.getItem('doni_theme_flips') || '0', 10) || 0) + 1;
            localStorage.setItem('doni_theme_flips', String(flips));
            if (flips >= 10 && window.unlockBadge) window.unlockBadge('flipper');
            return next;
        },

        setAccent(accent) {
            if (!ACCENTS.includes(accent)) return;
            document.documentElement.setAttribute('data-accent', accent);
            localStorage.setItem(ACCENT_KEY, accent);
            this.updateMeta();
            document.querySelectorAll('.accent-swatch').forEach(s => {
                s.classList.toggle('selected', s.dataset.accent === accent);
            });
            const changes = (parseInt(localStorage.getItem('doni_palette_changes') || '0', 10) || 0) + 1;
            localStorage.setItem('doni_palette_changes', String(changes));
            if (changes >= 5 && window.unlockBadge) window.unlockBadge('palette');
        },

        updateMeta() {
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'theme-color';
                document.head.appendChild(meta);
            }
            meta.content = this.get() === 'light' ? '#f5f6f8' : '#000000';
        },

        updateToggleIcon() {
            const btn = document.getElementById('theme-toggle-btn');
            if (btn) btn.textContent = this.get() === 'light' ? '🌙' : '☀️';
        },

        init() {
            // data-theme / data-accent already set by inline head script (no flash)
            if (!document.documentElement.getAttribute('data-accent')) {
                document.documentElement.setAttribute('data-accent', this.getAccent());
            }
            this.updateMeta();
        }
    };

    // -------------------------------------------------------
    // SOUND MANAGER (WebAudio, no asset files)
    // -------------------------------------------------------
    const Sound = {
        ctx: null,
        enabled: localStorage.getItem(SOUND_KEY) === '1',

        ensureCtx() {
            if (!this.ctx) {
                try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
                catch (e) { this.ctx = null; }
            }
            return this.ctx;
        },

        toggle() {
            this.enabled = !this.enabled;
            localStorage.setItem(SOUND_KEY, this.enabled ? '1' : '0');
            const checkbox = document.getElementById('settings-sound-toggle');
            if (checkbox) checkbox.checked = this.enabled;
            if (this.enabled) this.play('success');
            UI.toast(this.enabled ? '🔊 Sound on' : '🔇 Sound off', 'info');
            return this.enabled;
        },

        play(type = 'click') {
            if (!this.enabled) return;
            const ctx = this.ensureCtx();
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();
            const freqs = { click: 440, success: 660, error: 200, lock: 320, open: 520 };
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freqs[type] || 440;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.19);
        }
    };

    // -------------------------------------------------------
    // TOAST SYSTEM
    // -------------------------------------------------------
    function ensureToastContainer() {
        let c = document.getElementById('toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    function toast(message, type = 'success', duration = 3200) {
        const c = ensureToastContainer();
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        el.innerHTML = `<span class="toast-icon">${icons[type] || '•'}</span><span>${message}</span>`;
        c.appendChild(el);
        const remove = () => {
            el.classList.add('leaving');
            setTimeout(() => el.remove(), 300);
        };
        const timer = setTimeout(remove, duration);
        el.addEventListener('click', () => { clearTimeout(timer); remove(); });
        return el;
    }

    // -------------------------------------------------------
    // SCROLL PROGRESS BAR
    // -------------------------------------------------------
    function initScrollProgress() {
        if (document.getElementById('scroll-progress')) return;
        const bar = document.createElement('div');
        bar.id = 'scroll-progress';
        document.body.appendChild(bar);
        const update = () => {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
            bar.style.width = pct + '%';
        };
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    // -------------------------------------------------------
    // HEADER CONTROLS (theme toggle, accent picker, sound, install)
    // -------------------------------------------------------
    function injectHeaderControls() {
        const header = document.querySelector('header');
        if (!header || header.querySelector('.header-controls')) return;

        const wrap = document.createElement('div');
        wrap.className = 'header-controls';
        wrap.style.position = 'relative';

        // Theme toggle — kept as a standalone one-tap button, used daily.
        const themeBtn = document.createElement('button');
        themeBtn.id = 'theme-toggle-btn';
        themeBtn.className = 'icon-btn';
        themeBtn.title = 'Toggle light / dark';
        themeBtn.setAttribute('aria-label', 'Toggle theme');
        themeBtn.textContent = Theme.get() === 'light' ? '🌙' : '☀️';
        themeBtn.addEventListener('click', () => Theme.toggle());

        // Everything else lives inside one Settings menu so the header stays
        // focused on the portfolio content, not a row of app-toolbar icons.
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'icon-btn';
        settingsBtn.title = 'Settings';
        settingsBtn.setAttribute('aria-label', 'Settings');
        settingsBtn.textContent = '⚙️';

        const settingsMenu = document.createElement('div');
        settingsMenu.className = 'settings-menu';

        // -- Accent color row --
        const accentRow = document.createElement('div');
        accentRow.className = 'settings-menu-row';
        const accentLabel = document.createElement('span');
        accentLabel.textContent = 'Accent color';
        const accentSwatches = document.createElement('div');
        accentSwatches.style.cssText = 'display:flex;gap:6px;';
        ACCENTS.forEach(a => {
            const sw = document.createElement('div');
            sw.className = 'accent-swatch' + (Theme.getAccent() === a ? ' selected' : '');
            sw.dataset.accent = a;
            sw.style.background = ACCENT_HEX[a];
            sw.title = a;
            sw.addEventListener('click', () => { Theme.setAccent(a); Sound.play('click'); });
            accentSwatches.appendChild(sw);
        });
        accentRow.append(accentLabel, accentSwatches);

        // -- Sound toggle row --
        const soundRow = document.createElement('label');
        soundRow.className = 'settings-menu-row';
        soundRow.innerHTML = `<span>Interface sound FX</span><input type="checkbox" id="settings-sound-toggle" ${Sound.enabled ? 'checked' : ''}>`;
        soundRow.querySelector('input').addEventListener('change', () => Sound.toggle());

        // -- Notifications row --
        const notifSupported = 'Notification' in window;
        const notifState = notifSupported ? Notification.permission : 'unsupported';
        const notifRow = document.createElement('label');
        notifRow.className = 'settings-menu-row';
        notifRow.innerHTML = `<span>Browser notifications</span><input type="checkbox" id="settings-notify-toggle" ${notifState === 'granted' ? 'checked' : ''} ${!notifSupported ? 'disabled' : ''}>`;
        notifRow.querySelector('input').addEventListener('change', (e) => {
            if (!notifSupported) return;
            if (Notification.permission === 'denied') {
                e.target.checked = false;
                toast('Notifications are blocked — enable them in your browser settings.', 'info');
                return;
            }
            if (!e.target.checked) { toast('You can re-enable this anytime.', 'info'); return; }
            Notification.requestPermission().then(p => {
                e.target.checked = p === 'granted';
                if (p === 'granted') {
                    toast('🔔 Notifications enabled', 'success');
                    try { new Notification('DONI | DEV', { body: 'You\'ll get pinged for announcements.', icon: 'icons/icon-192.png' }); } catch (err) {}
                }
            });
        });

        // -- Cursor sharing row --
        let cursorPref = '1';
        try { cursorPref = localStorage.getItem('doni_cursor_share_pref') || '1'; } catch (e) {}
        const cursorRow = document.createElement('label');
        cursorRow.className = 'settings-menu-row';
        cursorRow.innerHTML = `<span>Share my cursor with others</span><input type="checkbox" id="settings-cursor-share" ${cursorPref === '1' ? 'checked' : ''}>`;
        cursorRow.querySelector('input').addEventListener('change', (e) => {
            if (typeof window.LiveCursors !== 'undefined') window.LiveCursors.setPreference(e.target.checked);
            else { try { localStorage.setItem('doni_cursor_share_pref', e.target.checked ? '1' : '0'); } catch (err) {} }
            toast(e.target.checked ? 'Cursor sharing enabled' : 'Cursor sharing disabled', 'info');
        });

        // -- Lock site button --
        const lockRow = document.createElement('button');
        lockRow.className = 'custom-btn secondary';
        lockRow.style.cssText = 'width:100%;margin-top:6px;font-size:0.78rem;padding:9px;';
        lockRow.textContent = '🔒 Lock this site';
        lockRow.addEventListener('click', () => {
            if (typeof Security !== 'undefined' && Security.SiteLock) Security.SiteLock.lock();
        });

        // -- Install app button --
        const installRow = document.createElement('button');
        installRow.id = 'pwa-install-btn';
        installRow.className = 'custom-btn secondary';
        installRow.style.cssText = 'width:100%;margin-top:8px;font-size:0.78rem;padding:9px;';
        installRow.textContent = '⬇ Install app';
        installRow.addEventListener('click', promptInstall);

        settingsMenu.append(
            document.createTextNode(''), // placeholder for title, set below
            accentRow, soundRow, notifRow, cursorRow, lockRow, installRow
        );
        const settingsTitle = document.createElement('div');
        settingsTitle.className = 'settings-menu-title';
        settingsTitle.textContent = 'Settings';
        settingsMenu.insertBefore(settingsTitle, settingsMenu.firstChild);

        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) settingsMenu.classList.remove('open');
        });

        wrap.append(themeBtn, settingsBtn, settingsMenu);

        const status = header.querySelector('.status');
        if (status && status.parentElement === header) header.insertBefore(wrap, status.nextSibling);
        else header.appendChild(wrap);
    }

    // -------------------------------------------------------
    // PWA INSTALL PROMPT
    // -------------------------------------------------------
    let deferredPrompt = null;
    function initInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const btn = document.getElementById('pwa-install-btn');
            if (btn) btn.classList.add('show');
        });
        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            const btn = document.getElementById('pwa-install-btn');
            if (btn) btn.classList.remove('show');
            toast('📱 App installed!', 'success');
        });
    }
    async function promptInstall() {
        if (!deferredPrompt) {
            toast('Install not available (already installed or unsupported).', 'info');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') toast('Installing…', 'success');
        deferredPrompt = null;
    }

    // -------------------------------------------------------
    // INIT
    // -------------------------------------------------------
    function init() {
        Theme.init();
        ensureToastContainer();
        injectHeaderControls();
        initScrollProgress();
        initInstallPrompt();
    }

    return { init, Theme, Sound, toast, promptInstall };
})();
