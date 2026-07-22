/**
 * DONI | DEV - Extended Features Module
 * Visitor stats, mobile nav, easter eggs, guestbook, changelog renderer
 */

const Features = (() => {
    const VISITOR_KEY = 'doni_visitor_id';
    const VISIT_COUNT_KEY = 'doni_visit_count';
    const PAGE_VIEWS_KEY = 'doni_page_views';

    function getVisitorId() {
        let id = localStorage.getItem(VISITOR_KEY);
        if (!id) {
            id = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
            localStorage.setItem(VISITOR_KEY, id);
        }
        return id;
    }

    function trackPageView() {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const views = JSON.parse(localStorage.getItem(PAGE_VIEWS_KEY) || '{}');
        views[page] = (views[page] || 0) + 1;
        localStorage.setItem(PAGE_VIEWS_KEY, JSON.stringify(views));

        const total = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
        localStorage.setItem(VISIT_COUNT_KEY, String(total));

        return { page, views: views[page], total };
    }

    function initMobileNav() {
        const header = document.querySelector('header');
        if (!header || header.querySelector('.nav-toggle')) return;

        const nav = header.querySelector('.nav-links');
        if (!nav) return;

        const btn = document.createElement('button');
        btn.className = 'nav-toggle';
        btn.setAttribute('aria-label', 'Toggle navigation');
        btn.innerHTML = '<span></span><span></span><span></span>';
        btn.addEventListener('click', () => {
            nav.classList.toggle('nav-open');
            btn.classList.toggle('active');
        });

        header.insertBefore(btn, nav);
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target)) {
                nav.classList.remove('nav-open');
                btn.classList.remove('active');
            }
        });
    }

    function initKonamiCode() {
        const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        let pos = 0;

        document.addEventListener('keydown', (e) => {
            if (e.key === sequence[pos]) {
                pos++;
                if (pos === sequence.length) {
                    pos = 0;
                    triggerSecretMode();
                }
            } else {
                pos = e.key === sequence[0] ? 1 : 0;
            }
        });
    }

    function triggerSecretMode() {
        document.body.classList.add('secret-mode');
        if (typeof Core !== 'undefined') {
            Core.SystemLogs.write('<span style="color:#a855f7;">★</span> Secret mode activated. You found the Konami code.');
        }
        const toast = document.createElement('div');
        toast.className = 'secret-toast';
        toast.textContent = '🎮 Secret Mode Unlocked';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

        if (window.unlockBadge) window.unlockBadge('konami');
        setTimeout(() => { window.location.href = 'admin-trap.html'; }, 1200);
    }

    function initBackToTop() {
        const btn = document.createElement('button');
        btn.className = 'back-to-top';
        btn.innerHTML = '↑';
        btn.setAttribute('aria-label', 'Back to top');
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        document.body.appendChild(btn);

        window.addEventListener('scroll', () => {
            btn.classList.toggle('visible', window.scrollY > 400);
        });
    }

    function initCopyEmail() {
        document.querySelectorAll('[data-copy]').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                const text = el.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(() => {
                    const orig = el.textContent;
                    el.textContent = 'Copied!';
                    setTimeout(() => { el.textContent = orig; }, 1500);
                });
            });
        });
    }

    function renderStatsPage() {
        const container = document.getElementById('stats-container');
        if (!container) return;

        const views = JSON.parse(localStorage.getItem(PAGE_VIEWS_KEY) || '{}');
        const total = localStorage.getItem(VISIT_COUNT_KEY) || '0';
        const visitorId = getVisitorId();

        const sorted = Object.entries(views).sort((a, b) => b[1] - a[1]);
        const maxVal = sorted[0]?.[1] || 1;

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value global" id="global-views-value">…</div>
                    <div class="stat-label">Global Views (Firebase)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${total}</div>
                    <div class="stat-label">Your Page Views (Local)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${sorted.length}</div>
                    <div class="stat-label">Pages Visited</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value mono">${visitorId.slice(0, 12)}…</div>
                    <div class="stat-label">Your Visitor ID</div>
                </div>
            </div>
            <h3 style="margin: 30px 0 16px;">Page Breakdown</h3>
            <div class="stats-bars">
                ${sorted.map(([page, count]) => `
                    <div class="stats-bar-row">
                        <span class="stats-bar-label">${page}</span>
                        <div class="stats-bar-track">
                            <div class="stats-bar-fill" style="width: ${(count / maxVal) * 100}%"></div>
                        </div>
                        <span class="stats-bar-count">${count}</span>
                    </div>
                `).join('')}
            </div>
            <p style="margin-top: 24px; font-size: 0.8rem; color: var(--text-muted);">
                Stats are stored locally in your browser. Firebase analytics can be wired for global counts.
            </p>
        `;
    }

    function initGuestbook() {
        const form = document.getElementById('guestbook-form');
        const list = document.getElementById('guestbook-entries');
        if (!form || !list) return;

        function loadEntries() {
            const entries = JSON.parse(localStorage.getItem('doni_guestbook') || '[]');
            if (entries.length === 0) {
                list.innerHTML = '<p class="guestbook-empty">No entries yet. Be the first!</p>';
                return;
            }
            list.innerHTML = entries.slice().reverse().map(e => `
                <div class="guestbook-entry">
                    <div class="guestbook-entry-header">
                        <strong>${escapeHtml(e.name)}</strong>
                        <span>${new Date(e.date).toLocaleDateString()}</span>
                    </div>
                    <p>${escapeHtml(e.message)}</p>
                </div>
            `).join('');
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('gb-name')?.value.trim();
            const message = document.getElementById('gb-message')?.value.trim();
            const status = document.getElementById('gb-status');

            if (!name || !message) {
                if (status) { status.textContent = 'Fill all fields.'; status.style.color = '#ef4444'; }
                return;
            }

            const entry = { name, message, date: new Date().toISOString() };

            if (typeof firebase !== 'undefined' && typeof db !== 'undefined' && db) {
                try {
                    await db.collection('guestbook').add({
                        ...entry,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (err) {
                    console.warn('[Guestbook] Firebase save failed, using localStorage');
                }
            }

            const entries = JSON.parse(localStorage.getItem('doni_guestbook') || '[]');
            entries.push(entry);
            localStorage.setItem('doni_guestbook', JSON.stringify(entries));

            form.reset();
            loadEntries();
            if (status) { status.textContent = 'Thanks for signing!'; status.style.color = '#22c55e'; }
        });

        loadEntries();
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Global visitor counter via Firestore (waits for Firebase to init in app.js)
    function waitForDb(cb, tries = 0) {
        const ready = (typeof firebaseReady !== 'undefined' && firebaseReady) &&
                      (typeof db !== 'undefined' && db) && (typeof firebase !== 'undefined');
        if (ready) { cb(db); return; }
        if (tries > 30) return; // give up after ~6s
        setTimeout(() => waitForDb(cb, tries + 1), 200);
    }

    function initGlobalStats() {
        waitForDb((database) => {
            const page = (window.location.pathname.split('/').pop() || 'index.html');
            const pageKey = page.replace(/[.#$/\[\]]/g, '_');
            const ref = database.collection('analytics').doc('global');

            // increment global + per-page counters (best effort)
            const payload = { totalViews: firebase.firestore.FieldValue.increment(1), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            payload['pages'] = { [pageKey]: firebase.firestore.FieldValue.increment(1) };
            ref.set(payload, { merge: true }).catch(err => console.warn('[GlobalStats] increment failed:', err));

            // live-render on the stats page if present
            const el = document.getElementById('global-views-value');
            if (el) {
                ref.onSnapshot(doc => {
                    if (doc.exists) el.textContent = (doc.data().totalViews || 0).toLocaleString();
                    else el.textContent = '0';
                }, () => { el.textContent = '—'; });
            }
        });
    }

    function initTypingEffect() {
        const el = document.getElementById('typing-hero');
        if (!el) return;
        const phrases = el.dataset.phrases?.split('|') || ['Developer', 'Builder', 'Creator'];
        let phraseIdx = 0, charIdx = 0, deleting = false;

        function tick() {
            const current = phrases[phraseIdx];
            if (!deleting) {
                el.textContent = current.slice(0, ++charIdx);
                if (charIdx === current.length) { deleting = true; setTimeout(tick, 2000); return; }
            } else {
                el.textContent = current.slice(0, --charIdx);
                if (charIdx === 0) { deleting = false; phraseIdx = (phraseIdx + 1) % phrases.length; }
            }
            setTimeout(tick, deleting ? 50 : 100);
        }
        tick();
    }

    function init() {
        const run = (fn, label) => { try { fn(); } catch (e) { console.error('[Features]', label || fn.name, e); } };
        run(trackPageView, 'trackPageView');
        run(initMobileNav, 'initMobileNav');
        run(initKonamiCode, 'initKonamiCode');
        run(initBackToTop, 'initBackToTop');
        run(initCopyEmail, 'initCopyEmail');
        run(renderStatsPage, 'renderStatsPage');
        run(initGuestbook, 'initGuestbook');
        run(initTypingEffect, 'initTypingEffect');
        run(initGlobalStats, 'initGlobalStats');
    }

    return { init, trackPageView, renderStatsPage, getVisitorId, initGlobalStats };
})();
