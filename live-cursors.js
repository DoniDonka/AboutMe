/**
 * DONI | DEV — Live Cursors v1.0
 * Real cross-visitor cursor sharing via Firestore, same page only.
 * Strict consent: nobody's position is ever sent without an explicit yes,
 * shown fresh every visit unless they chose to have it remembered.
 */
(function () {
    const CONSENT_KEY = 'doni_cursor_consent';       // 'yes' | 'no' | absent
    const REMEMBER_KEY = 'doni_cursor_consent_remember'; // '1' if they chose to save it
    const STALE_MS = 12000;    // cursors older than this are treated as gone
    const WRITE_THROTTLE_MS = 150;
    const CURSOR_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];

    let myCursorId = null;
    let unsubscribe = null;
    let writeTimer = null;
    let lastSent = 0;
    let enabled = false;
    const otherCursors = new Map(); // sessionId -> { el, expireTimer }

    function pageKey() {
        return (location.pathname.split('/').pop() || 'index.html');
    }

    function colorFor(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        return CURSOR_COLORS[hash % CURSOR_COLORS.length];
    }

    function myName() {
        try { return localStorage.getItem('doni_chat_name') || null; } catch (e) { return null; }
    }

    // ---------- Consent UI ----------

    function getStoredConsent() {
        try {
            if (localStorage.getItem(REMEMBER_KEY) === '1') {
                return localStorage.getItem(CONSENT_KEY); // 'yes' or 'no'
            }
        } catch (e) {}
        return null; // not remembered — ask again this visit
    }

    function setConsent(answer, remember) {
        try {
            if (remember) {
                localStorage.setItem(CONSENT_KEY, answer);
                localStorage.setItem(REMEMBER_KEY, '1');
            } else {
                localStorage.removeItem(CONSENT_KEY);
                localStorage.removeItem(REMEMBER_KEY);
            }
        } catch (e) {}
    }

    function showConsentPrompt(onAnswer) {
        if (document.getElementById('cursor-consent-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'cursor-consent-modal';
        modal.className = 'cursor-consent-modal';
        modal.innerHTML = `
            <div class="cursor-consent-box">
                <div class="cursor-consent-icon">🖱️</div>
                <h3>Share your cursor?</h3>
                <p>This site can show other visitors on this page a live dot for your mouse position — like a shared doc. It's <strong>on-page only</strong>, auto-expires when you stop moving or leave, and shows your chat name if you've set one (otherwise anonymous).</p>
                <p class="cursor-consent-note">This is <strong>not private</strong> — anyone viewing this page while you're active can see your cursor move in real time. Nothing else about you is shared.</p>
                <div class="cursor-consent-remember">
                    <label><input type="checkbox" id="cursor-consent-remember-check"> Remember my choice (don't ask again)</label>
                </div>
                <div class="cursor-consent-actions">
                    <button class="custom-btn secondary" id="cursor-consent-no">No thanks</button>
                    <button class="custom-btn green" id="cursor-consent-yes">Yes, share it</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add('open'));

        function close(answer) {
            const remember = document.getElementById('cursor-consent-remember-check')?.checked || false;
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 250);
            setConsent(answer, remember);
            onAnswer(answer === 'yes');
        }
        document.getElementById('cursor-consent-yes').addEventListener('click', () => close('yes'));
        document.getElementById('cursor-consent-no').addEventListener('click', () => close('no'));
    }

    // ---------- Firestore wiring ----------

    function waitForDb(cb, tries) {
        tries = tries || 0;
        const ready = (typeof firebaseReady !== 'undefined' && firebaseReady) &&
                      (typeof db !== 'undefined' && db);
        if (ready) { cb(db); return; }
        if (tries > 30) return;
        setTimeout(() => waitForDb(cb, tries + 1), 200);
    }

    function globallyDisabled() {
        // Admin can kill this site-wide via dashboard/settings.cursorSharingDisabled
        return window.DONI_SETTINGS && window.DONI_SETTINGS.cursorSharingDisabled === true;
    }

    function start(database) {
        if (enabled || globallyDisabled()) return;
        enabled = true;
        // Reuse the same presence doc the online-visitor counter already
        // maintains, so each visitor has exactly one presence doc, not two.
        myCursorId = window._presenceSessionId || ('cur_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
        const ref = database.collection('presence').doc(myCursorId);
        const name = myName();
        const color = colorFor(myCursorId);

        function sendPosition(x, y) {
            const now = Date.now();
            if (now - lastSent < WRITE_THROTTLE_MS) return;
            lastSent = now;
            ref.set({
                cursor: true,
                page: pageKey(),
                x, y,
                name: name || null,
                color,
                t: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(() => {});
        }

        function onMove(e) {
            // Page-relative coordinates (not viewport-relative) so the dot
            // tracks correctly regardless of scroll position on either end.
            const x = e.pageX / document.documentElement.scrollWidth;
            const y = e.pageY / document.documentElement.scrollHeight;
            sendPosition(x, y);
        }
        document.addEventListener('mousemove', onMove);

        function cleanup() {
            ref.delete().catch(() => {});
        }
        window.addEventListener('pagehide', cleanup);
        window.addEventListener('beforeunload', cleanup);

        // Listen for other cursors on this same page. Filters only on `page`
        // (single field, no composite index needed) and checks `cursor`
        // client-side — presence doc counts are small enough this is cheap.
        unsubscribe = database.collection('presence')
            .where('page', '==', pageKey())
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    const id = change.doc.id;
                    if (id === myCursorId) return;
                    const data = change.doc.data();
                    if (change.type === 'removed' || !data.cursor) {
                        removeCursor(id);
                        return;
                    }
                    upsertCursor(id, data);
                });
            }, err => console.warn('[LiveCursors] listener error:', err));

        window._liveCursorsStop = stop;
    }

    function upsertCursor(id, data) {
        // Reject stale docs outright — an orphaned doc from a refresh/crash
        // that skipped cleanup would otherwise render as if it just moved.
        const writeTime = data.t && data.t.toMillis ? data.t.toMillis() : 0;
        if (writeTime && (Date.now() - writeTime > STALE_MS)) {
            removeCursor(id);
            return;
        }

        let entry = otherCursors.get(id);
        if (!entry) {
            const el = document.createElement('div');
            el.className = 'live-cursor-dot';
            const label = data.name ? escapeHtml(data.name) : 'Visitor';
            el.innerHTML = `<div class="live-cursor-pointer" style="background:${data.color || '#22c55e'};"></div><div class="live-cursor-label" style="background:${data.color || '#22c55e'};">${label}</div>`;
            document.body.appendChild(el);
            entry = { el, expireTimer: null };
            otherCursors.set(id, entry);
        }
        if (typeof data.x === 'number' && typeof data.y === 'number') {
            entry.el.style.left = (data.x * document.documentElement.scrollWidth) + 'px';
            entry.el.style.top = (data.y * document.documentElement.scrollHeight) + 'px';
        }
        clearTimeout(entry.expireTimer);
        entry.expireTimer = setTimeout(() => removeCursor(id), STALE_MS);
    }

    function removeCursor(id) {
        const entry = otherCursors.get(id);
        if (!entry) return;
        clearTimeout(entry.expireTimer);
        entry.el.remove();
        otherCursors.delete(id);
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function stop() {
        enabled = false;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        otherCursors.forEach((entry, id) => removeCursor(id));
        if (myCursorId && typeof db !== 'undefined' && db) {
            // Only clear the cursor fields — this doc is shared with the
            // online-visitor-counter heartbeat, so don't delete it outright.
            db.collection('presence').doc(myCursorId)
                .set({ cursor: false }, { merge: true }).catch(() => {});
        }
    }

    // ---------- Public API (used by Settings page + admin panel) ----------

    window.LiveCursors = {
        isEnabled: () => enabled,
        enable: () => waitForDb(start),
        disable: stop,
        setPreference: (on) => {
            try { localStorage.setItem('doni_cursor_share_pref', on ? '1' : '0'); } catch (e) {}
            if (on) window.LiveCursors.enable(); else window.LiveCursors.disable();
        }
    };

    // ---------- Init ----------

    document.addEventListener('DOMContentLoaded', () => {
        // Per-user toggle in Settings can turn this off entirely regardless of consent.
        let userPref = '1';
        try { userPref = localStorage.getItem('doni_cursor_share_pref') || '1'; } catch (e) {}
        if (userPref === '0') return;

        const stored = getStoredConsent();
        if (stored === 'no') return;
        if (stored === 'yes') { waitForDb(start); return; }

        // No remembered answer — ask fresh, every visit, as requested.
        showConsentPrompt((yes) => { if (yes) waitForDb(start); });
    });
})();
