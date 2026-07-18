/**
 * DONI | DEV - Client-Side Security Layer
 * ----------------------------------------
 * NOTE: This is a deterrent for casual access only. All logic runs in the
 * browser and can be inspected via DevTools. Never rely on this for real secrets.
 */

const Security = (() => {
    // Client-side hash used ONLY by the full-screen SiteLock (a cosmetic
    // screensaver). Real admin authorization now uses Firebase Auth below.
    const ADMIN_HASH = '9685a4384cd2da78e4e6d490cc666c3c916066d2a8ef094994b21e6f75f6783b'; // doni2024
    const ADMIN_EMAIL = 'doni@admin.com'; // Firebase Auth admin account

    async function sha256(text) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function firebaseAuthInstance() {
        // firebase.auth() throws if no app has been initialized yet, so guard on
        // firebase.apps and swallow any error — callers treat null as "not ready".
        try {
            if (typeof firebase !== 'undefined' && firebase.auth &&
                firebase.apps && firebase.apps.length) {
                return firebase.auth();
            }
        } catch (e) { /* not ready */ }
        return null;
    }

    function friendlyAuthError(err) {
        const code = err && err.code ? err.code : '';
        switch (code) {
            case 'auth/invalid-email': return 'Invalid email address.';
            case 'auth/user-disabled': return 'This account has been disabled.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials': return 'Incorrect email or password.';
            case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
            case 'auth/network-request-failed': return 'Network error. Check your connection.';
            case 'auth/operation-not-allowed':
            case 'auth/configuration-not-found': return 'Email/Password sign-in is not enabled in Firebase yet.';
            default: return (err && err.message) ? err.message : 'Sign in failed.';
        }
    }

    // Admin authorization backed by Firebase Auth. Firestore rules enforce that
    // only ADMIN_EMAIL can read messages / write dashboard settings, so this is
    // real (server-side) protection, not just a client-side gate.
    const AdminGate = {
        isUnlocked() {
            const a = firebaseAuthInstance();
            const u = a && a.currentUser;
            return !!(u && u.email && u.email.toLowerCase() === ADMIN_EMAIL);
        },

        async lock() {
            const a = firebaseAuthInstance();
            if (a) { try { await a.signOut(); } catch (e) { /* ignore */ } }
            this.refreshUI();
        },

        async unlock(email, password) {
            const a = firebaseAuthInstance();
            if (!a) return { ok: false, error: 'Auth still loading — try again in a moment.' };
            try {
                await a.signInWithEmailAndPassword((email || '').trim(), password || '');
                const u = a.currentUser;
                if (!u || !u.email || u.email.toLowerCase() !== ADMIN_EMAIL) {
                    try { await a.signOut(); } catch (e) { /* ignore */ }
                    return { ok: false, error: 'This account is not authorized.' };
                }
                this.refreshUI();
                return { ok: true };
            } catch (err) {
                return { ok: false, error: friendlyAuthError(err) };
            }
        },

        refreshUI() {
            const lockScreen = document.getElementById('admin-lock-screen');
            const panelContent = document.getElementById('admin-panel-content');
            const lockBtn = document.getElementById('lock-admin-btn');
            const emailInput = document.getElementById('admin-email-input');
            const passInput = document.getElementById('admin-passcode-input');

            if (!lockScreen || !panelContent) return;

            const unlocked = this.isUnlocked();
            lockScreen.style.display = unlocked ? 'none' : 'flex';
            panelContent.style.display = unlocked ? 'flex' : 'none';
            if (lockBtn) lockBtn.style.display = unlocked ? 'inline-block' : 'none';

            if (!unlocked) {
                if (passInput) passInput.value = '';
                if (emailInput) setTimeout(() => emailInput.focus(), 100);
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
        const emailInput = document.getElementById('admin-email-input');
        const passInput = document.getElementById('admin-passcode-input');
        const lockBtn = document.getElementById('lock-admin-btn');

        AdminGate.refreshUI();

        async function doUnlock() {
            const errorEl = document.getElementById('admin-lock-error');
            if (unlockBtn) unlockBtn.disabled = true;
            if (errorEl) { errorEl.textContent = 'Signing in…'; errorEl.style.color = 'var(--text-muted)'; }

            const result = await AdminGate.unlock(emailInput?.value || '', passInput?.value || '');

            if (unlockBtn) unlockBtn.disabled = false;
            if (!result.ok) {
                if (errorEl) { errorEl.textContent = result.error; errorEl.style.color = '#ef4444'; }
                if (typeof UI !== 'undefined') UI.Sound.play('error');
            } else {
                if (errorEl) errorEl.textContent = '';
                if (typeof UI !== 'undefined') { UI.Sound.play('success'); UI.toast('🔓 Admin signed in', 'success'); }
            }
        }

        if (unlockBtn) unlockBtn.addEventListener('click', doUnlock);

        [emailInput, passInput].forEach(el => {
            if (el) el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); doUnlock(); }
            });
        });

        if (lockBtn) {
            lockBtn.addEventListener('click', () => {
                AdminGate.lock();
                if (typeof UI !== 'undefined') UI.toast('Admin signed out', 'info');
            });
        }
    }

    return { AdminGate, FormGuard, SiteLock, initAdminGate };
})();
