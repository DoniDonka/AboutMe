/**
 * DONI | DEV - Client-Side Security Layer
 * ----------------------------------------
 * NOTE: This is a deterrent for casual access only. All logic runs in the
 * browser and can be inspected via DevTools. Never rely on this for real secrets.
 */

const Security = (() => {
    const ADMIN_HASH = '9685a4384cd2da78e4e6d490cc666c3c916066d2a8ef094994b21e6f75f6783b'; // doni2024
    const SESSION_KEY = 'doni_admin_unlocked';
    const LOCKOUT_KEY = 'doni_admin_lockout';
    const ATTEMPTS_KEY = 'doni_admin_attempts';
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MS = 5 * 60 * 1000;

    async function sha256(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function isLockedOut() {
        const until = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
        if (Date.now() < until) return until;
        sessionStorage.removeItem(LOCKOUT_KEY);
        sessionStorage.removeItem(ATTEMPTS_KEY);
        return false;
    }

    function recordFailedAttempt() {
        const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
        sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
        if (attempts >= MAX_ATTEMPTS) {
            sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
            return { locked: true, remaining: MAX_ATTEMPTS - attempts };
        }
        return { locked: false, remaining: MAX_ATTEMPTS - attempts };
    }

    const AdminGate = {
        isUnlocked() {
            return sessionStorage.getItem(SESSION_KEY) === 'true';
        },

        lock() {
            sessionStorage.removeItem(SESSION_KEY);
            this.refreshUI();
        },

        async unlock(passcode) {
            const lockout = isLockedOut();
            if (lockout) {
                const secs = Math.ceil((lockout - Date.now()) / 1000);
                return { ok: false, error: `Locked out. Try again in ${secs}s.` };
            }

            const hash = await sha256(passcode.trim());
            if (hash === ADMIN_HASH) {
                sessionStorage.setItem(SESSION_KEY, 'true');
                sessionStorage.removeItem(ATTEMPTS_KEY);
                this.refreshUI();
                return { ok: true };
            }

            const result = recordFailedAttempt();
            if (result.locked) {
                return { ok: false, error: 'Too many attempts. Locked for 5 minutes.' };
            }
            return { ok: false, error: `Invalid passcode. ${result.remaining} attempts left.` };
        },

        refreshUI() {
            const lockScreen = document.getElementById('admin-lock-screen');
            const panelContent = document.getElementById('admin-panel-content');
            const lockBtn = document.getElementById('lock-admin-btn');
            const errorEl = document.getElementById('admin-lock-error');
            const input = document.getElementById('admin-passcode-input');

            if (!lockScreen || !panelContent) return;

            const lockout = isLockedOut();
            const unlocked = this.isUnlocked() && !lockout;

            lockScreen.style.display = unlocked ? 'none' : 'flex';
            panelContent.style.display = unlocked ? 'flex' : 'none';
            if (lockBtn) lockBtn.style.display = unlocked ? 'inline-block' : 'none';

            if (errorEl) {
                if (lockout) {
                    const secs = Math.ceil((lockout - Date.now()) / 1000);
                    errorEl.textContent = `Locked out. ${secs}s remaining.`;
                    errorEl.style.color = '#ef4444';
                } else {
                    errorEl.textContent = '';
                }
            }
            if (input && !unlocked) {
                input.value = '';
                if (!lockout) setTimeout(() => input.focus(), 100);
            }
        }
    };

    const FormGuard = {
        captchaAnswer: 0,
        submitTimestamps: [],

        initCaptcha() {
            const qEl = document.getElementById('captcha-question');
            const input = document.getElementById('captcha-answer');
            if (!qEl) return;
            this.regenerateCaptcha(qEl, input);
        },

        regenerateCaptcha(qEl, input) {
            const a = Math.floor(Math.random() * 12) + 1;
            const b = Math.floor(Math.random() * 12) + 1;
            const ops = ['+', '-', '×'];
            const op = ops[Math.floor(Math.random() * ops.length)];
            let answer;
            if (op === '+') answer = a + b;
            else if (op === '-') { answer = Math.max(a, b) - Math.min(a, b); }
            else answer = a * b;

            this.captchaAnswer = answer;
            const display = op === '-' ? `${Math.max(a, b)} ${op} ${Math.min(a, b)}` : `${a} ${op} ${b}`;
            if (qEl) qEl.textContent = display;
            if (input) input.value = '';
        },

        checkHoneypot() {
            const hp = document.getElementById('contact-honeypot');
            return hp && hp.value.trim() !== '';
        },

        checkCaptcha() {
            const input = document.getElementById('captcha-answer');
            if (!input) return true;
            return parseInt(input.value, 10) === this.captchaAnswer;
        },

        checkRateLimit(maxPerMinute = 3) {
            const now = Date.now();
            this.submitTimestamps = this.submitTimestamps.filter(t => now - t < 60000);
            if (this.submitTimestamps.length >= maxPerMinute) return false;
            this.submitTimestamps.push(now);
            return true;
        },

        validate() {
            if (this.checkHoneypot()) {
                return { ok: false, error: 'Submission rejected.' };
            }
            if (!this.checkCaptcha()) {
                return { ok: false, error: 'Incorrect captcha answer. Try again.' };
            }
            if (!this.checkRateLimit()) {
                return { ok: false, error: 'Too many submissions. Wait a minute.' };
            }
            return { ok: true };
        },

        refreshAfterSubmit() {
            const qEl = document.getElementById('captcha-question');
            const input = document.getElementById('captcha-answer');
            this.regenerateCaptcha(qEl, input);
        }
    };

    // ============================================================
    // FULL-SCREEN SITE LOCK (hides the entire site behind a passcode)
    // Shares the admin passcode (default: doni2024). Persists across
    // pages via localStorage so the whole site stays locked until unlocked.
    // ============================================================
    const SITE_LOCK_KEY = 'doni_site_locked';
    const SITE_HASH = ADMIN_HASH; // same passcode as admin gate

    const SiteLock = {
        clockTimer: null,

        isLocked() {
            return localStorage.getItem(SITE_LOCK_KEY) === '1';
        },

        buildOverlay() {
            if (document.getElementById('site-lock')) return document.getElementById('site-lock');
            const el = document.createElement('div');
            el.id = 'site-lock';
            el.innerHTML = `
                <div class="site-lock-logo">DONI</div>
                <div class="site-lock-icon">🔒</div>
                <div class="site-lock-clock" id="site-lock-clock">--:--</div>
                <div class="site-lock-date" id="site-lock-date"></div>
                <div class="site-lock-row">
                    <input type="password" id="site-lock-input" class="custom-input" placeholder="Enter passcode" autocomplete="off" inputmode="numeric">
                    <button id="site-lock-btn" class="custom-btn green">Unlock</button>
                </div>
                <div class="site-lock-error" id="site-lock-error"></div>
                <div class="site-lock-hint">This site is locked. Enter the passcode to continue.</div>
            `;
            document.body.appendChild(el);

            const input = el.querySelector('#site-lock-input');
            const btn = el.querySelector('#site-lock-btn');
            btn.addEventListener('click', () => this.attemptUnlock());
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.attemptUnlock(); });
            return el;
        },

        startClock() {
            const clock = document.getElementById('site-lock-clock');
            const date = document.getElementById('site-lock-date');
            const tick = () => {
                const now = new Date();
                if (clock) clock.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                if (date) date.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            };
            tick();
            clearInterval(this.clockTimer);
            this.clockTimer = setInterval(tick, 1000);
        },

        show() {
            const el = this.buildOverlay();
            el.classList.add('open');
            document.documentElement.classList.add('pre-locked');
            document.body.style.overflow = 'hidden';
            this.startClock();
            const input = document.getElementById('site-lock-input');
            if (input) { input.value = ''; setTimeout(() => input.focus(), 120); }
        },

        hide() {
            const el = document.getElementById('site-lock');
            if (el) el.classList.remove('open');
            document.documentElement.classList.remove('pre-locked');
            document.body.style.overflow = '';
            clearInterval(this.clockTimer);
        },

        lock() {
            localStorage.setItem(SITE_LOCK_KEY, '1');
            this.show();
            if (typeof UI !== 'undefined') { UI.Sound.play('lock'); UI.toast('🔒 Site locked', 'info'); }
        },

        async attemptUnlock() {
            const input = document.getElementById('site-lock-input');
            const errorEl = document.getElementById('site-lock-error');
            const pass = input ? input.value : '';
            const hash = await sha256(pass.trim());
            if (hash === SITE_HASH) {
                localStorage.removeItem(SITE_LOCK_KEY);
                this.hide();
                if (errorEl) errorEl.textContent = '';
                if (typeof UI !== 'undefined') { UI.Sound.play('success'); UI.toast('🔓 Unlocked', 'success'); }
            } else {
                if (errorEl) errorEl.textContent = 'Incorrect passcode.';
                if (input) { input.value = ''; input.focus(); }
                if (typeof UI !== 'undefined') UI.Sound.play('error');
            }
        },

        init() {
            this.buildOverlay();
            if (this.isLocked()) this.show();
            else document.documentElement.classList.remove('pre-locked');
        }
    };

    function initAdminGate() {
        const unlockBtn = document.getElementById('admin-unlock-btn');
        const passInput = document.getElementById('admin-passcode-input');
        const lockBtn = document.getElementById('lock-admin-btn');

        AdminGate.refreshUI();

        if (unlockBtn) {
            unlockBtn.addEventListener('click', async () => {
                const pass = passInput?.value || '';
                const result = await AdminGate.unlock(pass);
                const errorEl = document.getElementById('admin-lock-error');
                if (!result.ok && errorEl) {
                    errorEl.textContent = result.error;
                    errorEl.style.color = '#ef4444';
                } else if (result.ok && errorEl) {
                    errorEl.textContent = '';
                }
            });
        }

        if (passInput) {
            passInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') unlockBtn?.click();
            });
        }

        if (lockBtn) {
            lockBtn.addEventListener('click', () => AdminGate.lock());
        }

        setInterval(() => {
            if (document.getElementById('admin-modal')?.style.display === 'flex') {
                AdminGate.refreshUI();
            }
        }, 1000);
    }

    return { AdminGate, FormGuard, SiteLock, initAdminGate };
})();
