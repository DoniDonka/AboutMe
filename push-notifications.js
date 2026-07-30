/**
 * DONI | DEV — Push Notifications v1.0
 * Real browser push via Firebase Cloud Messaging, works even when the tab
 * is closed. Requires a VAPID key generated in the Firebase Console
 * (Project Settings → Cloud Messaging → Web Push certificates) — see
 * PUSH_SETUP.md for the one-time setup this needs.
 *
 * Per-category preferences (chat replies, blog posts, announcements) live
 * on the user's account profile at users/{uid}.notifyPrefs, same schema
 * accounts.js already scaffolds on signup. Anonymous visitors can still
 * subscribe — their token + prefs are just stored in a standalone
 * pushSubscribers collection instead of tied to a uid.
 */
(function () {
    // Set this after generating a Web Push certificate in the Firebase
    // Console. Until it's set, push subscription silently no-ops rather
    // than throwing, so the rest of the site is unaffected.
    const VAPID_KEY = ''; // <-- fill in from Firebase Console

    let messaging = null;
    let currentToken = null;

    function waitForFirebase(cb, tries) {
        tries = tries || 0;
        const ready = typeof firebaseReady !== 'undefined' && firebaseReady;
        if (ready) { cb(); return; }
        if (tries > 50) return;
        setTimeout(() => waitForFirebase(cb, tries + 1), 100);
    }

    function supported() {
        return 'serviceWorker' in navigator && 'PushManager' in window &&
               typeof firebase !== 'undefined' && !!firebase.messaging;
    }

    async function subscribe() {
        if (!supported()) { toastSafe('Push notifications aren\'t supported in this browser', 'info'); return false; }
        if (!VAPID_KEY) { toastSafe('Push notifications aren\'t fully set up yet — check back soon', 'info'); return false; }

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return false;

            const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
            if (!messaging) messaging = firebase.messaging();
            currentToken = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
            if (!currentToken) return false;

            await saveSubscription(currentToken);
            try { localStorage.setItem('doni_push_subscribed', '1'); } catch (e) {}
            return true;
        } catch (e) {
            console.error('[Push] subscribe failed:', e);
            toastSafe('Could not enable push notifications', 'error');
            return false;
        }
    }

    async function unsubscribe() {
        try {
            if (messaging && currentToken) await messaging.deleteToken();
            if (currentToken) await removeSubscription(currentToken);
        } catch (e) { /* best effort */ }
        currentToken = null;
        try { localStorage.setItem('doni_push_subscribed', '0'); } catch (e) {}
    }

    function currentPrefs() {
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('doni_notify_prefs') || 'null'); } catch (e) {}
        return stored || { chatReplies: true, blogPosts: false, announcements: true };
    }

    function savePrefsLocal(prefs) {
        try { localStorage.setItem('doni_notify_prefs', JSON.stringify(prefs)); } catch (e) {}
    }

    async function saveSubscription(token) {
        waitForFirebase(async () => {
            const prefs = currentPrefs();
            const user = (typeof Accounts !== 'undefined') ? Accounts.getCurrentUser() : null;
            const doc = {
                token,
                prefs,
                page: location.pathname.split('/').pop() || 'index.html',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            try {
                if (user) {
                    await db.collection('users').doc(user.uid).set({ pushToken: token, notifyPrefs: prefs }, { merge: true });
                } else {
                    await db.collection('pushSubscribers').doc(token).set(doc, { merge: true });
                }
            } catch (e) { console.error('[Push] saveSubscription failed:', e); }
        });
    }

    async function removeSubscription(token) {
        waitForFirebase(async () => {
            const user = (typeof Accounts !== 'undefined') ? Accounts.getCurrentUser() : null;
            try {
                if (user) {
                    await db.collection('users').doc(user.uid).set({ pushToken: firebase.firestore.FieldValue.delete() }, { merge: true });
                } else {
                    await db.collection('pushSubscribers').doc(token).delete();
                }
            } catch (e) { /* best effort */ }
        });
    }

    async function updatePrefs(prefs) {
        savePrefsLocal(prefs);
        const user = (typeof Accounts !== 'undefined') ? Accounts.getCurrentUser() : null;
        waitForFirebase(async () => {
            try {
                if (user) {
                    await db.collection('users').doc(user.uid).set({ notifyPrefs: prefs }, { merge: true });
                } else if (currentToken) {
                    await db.collection('pushSubscribers').doc(currentToken).set({ prefs }, { merge: true });
                }
            } catch (e) { /* best effort */ }
        });
    }

    function toastSafe(msg, type) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, type);
    }

    // ---------- Settings UI: per-category preference rows ----------

    function injectPrefsUI() {
        const menu = document.querySelector('.settings-menu');
        if (!menu || document.getElementById('push-prefs-section')) return;

        let subscribed = false;
        try { subscribed = localStorage.getItem('doni_push_subscribed') === '1'; } catch (e) {}
        const prefs = currentPrefs();

        const section = document.createElement('div');
        section.id = 'push-prefs-section';
        section.innerHTML = `
            <div class="settings-menu-title" style="margin-top:14px;">Push notifications</div>
            <label class="settings-menu-row">
                <span>Enable push notifications</span>
                <input type="checkbox" id="push-master-toggle" ${subscribed ? 'checked' : ''}>
            </label>
            <div id="push-category-rows" style="${subscribed ? '' : 'opacity:0.4;pointer-events:none;'}">
                <label class="settings-menu-row"><span>Chat replies &amp; mentions</span><input type="checkbox" id="push-pref-chat" ${prefs.chatReplies ? 'checked' : ''}></label>
                <label class="settings-menu-row"><span>New blog posts</span><input type="checkbox" id="push-pref-blog" ${prefs.blogPosts ? 'checked' : ''}></label>
                <label class="settings-menu-row"><span>Admin announcements</span><input type="checkbox" id="push-pref-announce" ${prefs.announcements ? 'checked' : ''}></label>
            </div>
        `;
        menu.appendChild(section);

        const categoryRows = document.getElementById('push-category-rows');
        document.getElementById('push-master-toggle').addEventListener('change', async (e) => {
            if (e.target.checked) {
                const ok = await subscribe();
                e.target.checked = ok;
                categoryRows.style.opacity = ok ? '1' : '0.4';
                categoryRows.style.pointerEvents = ok ? 'all' : 'none';
                if (ok) toastSafe('🔔 Push notifications enabled', 'success');
            } else {
                await unsubscribe();
                categoryRows.style.opacity = '0.4';
                categoryRows.style.pointerEvents = 'none';
                toastSafe('Push notifications disabled', 'info');
            }
        });

        const catBoxes = {
            chatReplies: document.getElementById('push-pref-chat'),
            blogPosts: document.getElementById('push-pref-blog'),
            announcements: document.getElementById('push-pref-announce')
        };
        Object.entries(catBoxes).forEach(([key, el]) => {
            el.addEventListener('change', () => {
                const next = { ...currentPrefs(), [key]: el.checked };
                updatePrefs(next);
            });
        });
    }

    // ---------- Foreground messages (tab open) ----------

    function initForegroundHandler() {
        if (!supported()) return;
        if (!messaging) messaging = firebase.messaging();
        messaging.onMessage((payload) => {
            const title = payload.notification?.title || 'DONI | DEV';
            const body = payload.notification?.body || '';
            toastSafe(`🔔 ${title}: ${body}`, 'info');
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Settings menu is injected by ui.js — wait a tick for it to exist.
        setTimeout(injectPrefsUI, 300);
        waitForFirebase(initForegroundHandler);
    });

    window.PushNotifications = { subscribe, unsubscribe, updatePrefs, currentPrefs };
})();
