/* DONI | DEV — Visitor Tracker v3.4 */
(function() {
    const WORKER_URL = 'https://aboutme.donidonka511.workers.dev';
    const SESSION_KEY = 'doni_session_id';
    const START_KEY = 'doni_session_start';
    const PAGES_KEY = 'doni_pages_visited';

    function getSessionId() {
        let id = sessionStorage.getItem(SESSION_KEY);
        if (!id) {
            id = 'sess_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
            sessionStorage.setItem(SESSION_KEY, id);
        }
        return id;
    }

    function trackPage() {
        const page = location.pathname.split('/').pop() || 'index.html';
        let pages = JSON.parse(sessionStorage.getItem(PAGES_KEY) || '[]');
        if (!pages.includes(page)) pages.push(page);
        sessionStorage.setItem(PAGES_KEY, JSON.stringify(pages));
        return pages;
    }

    function formatDuration(ms) {
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return m > 0 ? m + 'm ' + s + 's' : s + 's';
    }

    // Track clicks for session replay
    document.addEventListener('click', (e) => {
        const el = e.target.closest('a, button, .bento-card, h1, h2, h3');
        if (!el) return;
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent || el.href || '').substring(0, 30);
        try {
            fetch(WORKER_URL + '/visitor-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: getSessionId(),
                    page: location.pathname,
                    element: tag + ':' + text
                })
            });
        } catch (e) {}
    });

    async function notifyJoin(attempt) {
        attempt = attempt || 0;
        const start = Date.now();
        sessionStorage.setItem(START_KEY, start.toString());
        const pages = trackPage();
        try {
            const res = await fetch(WORKER_URL + '/visitor-join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: getSessionId(),
                    page: location.pathname,
                    referrer: document.referrer || 'direct',
                    screen: screen.width + 'x' + screen.height,
                    language: navigator.language,
                    platform: navigator.platform,
                    pages: pages
                })
            });
            if (!res.ok && attempt < 2) {
                setTimeout(() => notifyJoin(attempt + 1), 1500 * (attempt + 1));
            }
        } catch (e) {
            // Worker may be cold-starting on the very first hit — retry a couple times.
            if (attempt < 2) setTimeout(() => notifyJoin(attempt + 1), 1500 * (attempt + 1));
        }
    }

    async function notifyLeave() {
        const start = parseInt(sessionStorage.getItem(START_KEY) || '0');
        const duration = Date.now() - start;
        const pages = JSON.parse(sessionStorage.getItem(PAGES_KEY) || '[]');
        try {
            await fetch(WORKER_URL + '/visitor-leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: getSessionId(),
                    duration: formatDuration(duration),
                    pages: pages,
                    pageCount: pages.length
                })
            });
        } catch (e) {}
    }

    async function updateCounter() {
        try {
            const res = await fetch(WORKER_URL + '/visitor-count');
            const data = await res.json();
            const el = document.getElementById('live-visitor-count');
            if (el) el.textContent = data.count || '—';
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { notifyJoin(); updateCounter(); });
    } else { notifyJoin(); updateCounter(); }

    window.addEventListener('pagehide', notifyLeave);

    window.addEventListener('pagehide', () => {
        const pages = JSON.parse(sessionStorage.getItem(PAGES_KEY) || '[]');
        if (pages.length >= 3 && window.unlockBadge) window.unlockBadge('explorer');
    });

    setTimeout(() => { if (window.unlockBadge) window.unlockBadge('veteran'); }, 300000);
})();
