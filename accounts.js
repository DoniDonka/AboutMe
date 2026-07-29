/**
 * DONI | DEV — Accounts v1.0
 * Real optional accounts on top of Firebase Auth (the same aboutme-8a339
 * project already used for admin sign-in). Anonymous chat still works —
 * this is purely additive. A signed-in user's profile lives in
 * Firestore at users/{uid}: displayName, verified status, message
 * count, avatar (an Imgur URL, added in a later phase), and
 * per-category notification prefs (added in a later phase).
 */
(function () {
    let currentUser = null;   // Firebase Auth user object, or null
    let currentProfile = null; // users/{uid} Firestore doc data, or null

    function waitForFirebase(cb, tries) {
        tries = tries || 0;
        const ready = typeof firebaseReady !== 'undefined' && firebaseReady;
        if (ready) { cb(); return; }
        if (tries > 50) return;
        setTimeout(() => waitForFirebase(cb, tries + 1), 100);
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    // ---------- Modal build ----------

    function buildModal() {
        if (document.getElementById('account-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'account-modal';
        modal.className = 'account-modal';
        modal.innerHTML = `
            <div class="account-box">
                <button class="account-close" id="account-close-btn" aria-label="Close">✕</button>

                <div class="account-panel" id="account-panel-login">
                    <div class="account-logo">DONI</div>
                    <h2 class="account-title" id="account-welcome-title">Welcome back</h2>
                    <p class="account-sub">Sign in to save your name, avatar, and notification prefs.</p>
                    <input type="email" id="account-login-email" class="account-input" placeholder="Email" autocomplete="username">
                    <input type="password" id="account-login-pass" class="account-input" placeholder="Password" autocomplete="current-password">
                    <button class="custom-btn green account-submit" id="account-login-btn">Sign In</button>
                    <div class="account-error" id="account-login-error"></div>
                    <div class="account-links">
                        <a href="#" id="account-goto-reset">Forgot password?</a>
                        <a href="#" id="account-goto-signup">Create an account</a>
                    </div>
                    <div class="account-divider"><span>or</span></div>
                    <button class="custom-btn secondary account-submit" id="account-anon-btn">Continue anonymously</button>
                </div>

                <div class="account-panel account-panel-hidden" id="account-panel-signup">
                    <div class="account-logo">DONI</div>
                    <h2 class="account-title">Create your account</h2>
                    <p class="account-sub">Free, optional, takes 10 seconds.</p>
                    <input type="text" id="account-signup-name" class="account-input" placeholder="Display name" maxlength="20">
                    <input type="email" id="account-signup-email" class="account-input" placeholder="Email" autocomplete="username">
                    <input type="password" id="account-signup-pass" class="account-input" placeholder="Password (6+ characters)" autocomplete="new-password">
                    <button class="custom-btn green account-submit" id="account-signup-btn">Create Account</button>
                    <div class="account-error" id="account-signup-error"></div>
                    <div class="account-links">
                        <a href="#" id="account-goto-login-from-signup">Already have an account? Sign in</a>
                    </div>
                </div>

                <div class="account-panel account-panel-hidden" id="account-panel-reset">
                    <div class="account-logo">DONI</div>
                    <h2 class="account-title">Reset password</h2>
                    <p class="account-sub">We'll email you a reset link.</p>
                    <input type="email" id="account-reset-email" class="account-input" placeholder="Email">
                    <button class="custom-btn green account-submit" id="account-reset-btn">Send Reset Link</button>
                    <div class="account-error" id="account-reset-error"></div>
                    <div class="account-links">
                        <a href="#" id="account-goto-login-from-reset">Back to sign in</a>
                    </div>
                </div>

                <div class="account-panel account-panel-hidden" id="account-panel-profile">
                    <div class="account-logo">DONI</div>
                    <h2 class="account-title" id="account-profile-welcome">Welcome!</h2>
                    <p class="account-sub" id="account-profile-email"></p>
                    <div class="account-verify-banner" id="account-verify-banner" style="display:none;">
                        ⚠️ Your email isn't verified yet. <a href="#" id="account-resend-verify">Resend verification email</a>.
                        <div class="account-verify-note">Until verified: no reactions, no replies, and messages are capped at 10.</div>
                    </div>
                    <button class="custom-btn secondary account-submit" id="account-signout-btn">Sign Out</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        wireModal();
    }

    function switchPanel(name) {
        document.querySelectorAll('.account-panel').forEach(p => p.classList.add('account-panel-hidden'));
        const target = document.getElementById('account-panel-' + name);
        if (target) target.classList.remove('account-panel-hidden');
        document.querySelectorAll('.account-error').forEach(e => e.textContent = '');
    }

    function openModal() {
        buildModal();
        const modal = document.getElementById('account-modal');
        if (currentUser) {
            updateProfilePanel();
            switchPanel('profile');
        } else {
            const greetName = getGreetName();
            const titleEl = document.getElementById('account-welcome-title');
            if (titleEl) titleEl.textContent = greetName ? `Welcome back, ${greetName}` : 'Welcome back';
            switchPanel('login');
        }
        requestAnimationFrame(() => modal.classList.add('open'));
    }

    function closeModal() {
        const modal = document.getElementById('account-modal');
        if (modal) modal.classList.remove('open');
    }

    function getGreetName() {
        try { return localStorage.getItem('doni_last_seen_name') || null; } catch (e) { return null; }
    }

    function friendlyAuthError(err) {
        const code = err && err.code ? err.code : '';
        switch (code) {
            case 'auth/invalid-email': return 'That email doesn\'t look right.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials': return 'Incorrect email or password.';
            case 'auth/email-already-in-use': return 'An account with that email already exists.';
            case 'auth/weak-password': return 'Password needs to be at least 6 characters.';
            case 'auth/too-many-requests': return 'Too many attempts — try again in a bit.';
            case 'auth/network-request-failed': return 'Network error — check your connection.';
            default: return (err && err.message) ? err.message : 'Something went wrong.';
        }
    }

    // ---------- Wiring ----------

    function wireModal() {
        document.getElementById('account-close-btn').addEventListener('click', closeModal);
        document.getElementById('account-modal').addEventListener('click', (e) => {
            if (e.target.id === 'account-modal') closeModal();
        });

        document.getElementById('account-goto-signup').addEventListener('click', (e) => { e.preventDefault(); switchPanel('signup'); });
        document.getElementById('account-goto-reset').addEventListener('click', (e) => { e.preventDefault(); switchPanel('reset'); });
        document.getElementById('account-goto-login-from-signup').addEventListener('click', (e) => { e.preventDefault(); switchPanel('login'); });
        document.getElementById('account-goto-login-from-reset').addEventListener('click', (e) => { e.preventDefault(); switchPanel('login'); });

        document.getElementById('account-anon-btn').addEventListener('click', closeModal);

        document.getElementById('account-login-btn').addEventListener('click', async () => {
            const email = document.getElementById('account-login-email').value.trim();
            const pass = document.getElementById('account-login-pass').value;
            const errEl = document.getElementById('account-login-error');
            errEl.textContent = '';
            if (!email || !pass) { errEl.textContent = 'Fill in both fields.'; return; }
            try {
                await firebase.auth().signInWithEmailAndPassword(email, pass);
                closeModal();
            } catch (err) { errEl.textContent = friendlyAuthError(err); }
        });

        document.getElementById('account-signup-btn').addEventListener('click', async () => {
            const name = document.getElementById('account-signup-name').value.trim();
            const email = document.getElementById('account-signup-email').value.trim();
            const pass = document.getElementById('account-signup-pass').value;
            const errEl = document.getElementById('account-signup-error');
            errEl.textContent = '';
            if (!name || !email || !pass) { errEl.textContent = 'Fill in all fields.'; return; }
            try {
                const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
                await cred.user.updateProfile({ displayName: name });
                await cred.user.sendEmailVerification();
                await db.collection('users').doc(cred.user.uid).set({
                    displayName: name,
                    email,
                    verified: false,
                    messageCount: 0,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    notifyPrefs: { chatReplies: true, blogPosts: false, announcements: true }
                });
                closeModal();
                if (typeof UI !== 'undefined') UI.toast(`Welcome, ${name}! Check your email to verify.`, 'success');
            } catch (err) { errEl.textContent = friendlyAuthError(err); }
        });

        document.getElementById('account-reset-btn').addEventListener('click', async () => {
            const email = document.getElementById('account-reset-email').value.trim();
            const errEl = document.getElementById('account-reset-error');
            errEl.textContent = '';
            if (!email) { errEl.textContent = 'Enter your email.'; return; }
            try {
                await firebase.auth().sendPasswordResetEmail(email);
                errEl.style.color = 'var(--accent-green)';
                errEl.textContent = 'Reset link sent — check your inbox.';
            } catch (err) { errEl.style.color = '#ef4444'; errEl.textContent = friendlyAuthError(err); }
        });

        document.getElementById('account-signout-btn').addEventListener('click', async () => {
            await firebase.auth().signOut();
            closeModal();
            if (typeof UI !== 'undefined') UI.toast('Signed out', 'info');
        });

        document.getElementById('account-resend-verify').addEventListener('click', async (e) => {
            e.preventDefault();
            if (currentUser) {
                try { await currentUser.sendEmailVerification(); if (typeof UI !== 'undefined') UI.toast('Verification email sent', 'success'); }
                catch (err) { if (typeof UI !== 'undefined') UI.toast('Could not resend — try again shortly', 'error'); }
            }
        });
    }

    function updateProfilePanel() {
        if (!currentUser) return;
        const name = currentProfile?.displayName || currentUser.displayName || 'there';
        document.getElementById('account-profile-welcome').textContent = `Welcome, ${name}!`;
        document.getElementById('account-profile-email').textContent = currentUser.email || '';
        const banner = document.getElementById('account-verify-banner');
        if (banner) banner.style.display = currentUser.emailVerified ? 'none' : 'block';
    }

    // ---------- Auth state ----------

    function onAuthChange(user) {
        currentUser = user;
        if (user) {
            try { localStorage.setItem('doni_last_seen_name', user.displayName || ''); } catch (e) {}
            db.collection('users').doc(user.uid).get().then(doc => {
                currentProfile = doc.exists ? doc.data() : null;
                // Keep verified status in Firestore in sync with the real Auth flag,
                // so Firestore rules (which can't call Auth APIs directly) can gate
                // on it. reload() first in case they verified in another tab.
                if (currentProfile && currentProfile.verified !== user.emailVerified) {
                    db.collection('users').doc(user.uid).set({ verified: user.emailVerified }, { merge: true }).catch(() => {});
                }
                updateAccountButton();
                if (typeof updateProfilePanel === 'function' && document.getElementById('account-modal')) updateProfilePanel();
            }).catch(() => { updateAccountButton(); });
        } else {
            currentProfile = null;
            updateAccountButton();
        }
    }

    function updateAccountButton() {
        const btn = document.getElementById('account-header-btn');
        if (!btn) return;
        if (currentUser) {
            const name = currentProfile?.displayName || currentUser.displayName || 'Account';
            btn.textContent = '👤';
            btn.title = `Signed in as ${name}`;
        } else {
            btn.textContent = '👤';
            btn.title = 'Sign in / Create account';
        }
    }

    function injectHeaderButton() {
        const wrap = document.querySelector('.header-controls');
        if (!wrap || document.getElementById('account-header-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'account-header-btn';
        btn.className = 'icon-btn';
        btn.title = 'Sign in / Create account';
        btn.setAttribute('aria-label', 'Account');
        btn.textContent = '👤';
        btn.addEventListener('click', openModal);
        wrap.appendChild(btn);
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectHeaderButton();
        waitForFirebase(() => {
            firebase.auth().onAuthStateChanged(onAuthChange);
        });
    });

    window.Accounts = {
        open: openModal,
        close: closeModal,
        getCurrentUser: () => currentUser,
        getCurrentProfile: () => currentProfile,
        isVerified: () => !!(currentUser && currentUser.emailVerified)
    };
})();
