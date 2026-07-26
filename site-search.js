/**
 * DONI | DEV — Site-Wide Search v1.0
 * Extends the command palette's existing page/command search to also
 * cover dynamic content: blog posts, guestbook entries, and chat messages.
 * Content is fetched once and cached client-side, refreshed periodically.
 */
(function () {
    if (typeof renderPaletteResults !== 'function') return;

    let blogCache = [];
    let guestbookCache = [];
    let chatCache = [];
    let cacheLoaded = false;

    function waitForDb(cb, tries) {
        tries = tries || 0;
        const ready = (typeof firebaseReady !== 'undefined' && firebaseReady) &&
                      (typeof db !== 'undefined' && db);
        if (ready) { cb(db); return; }
        if (tries > 30) return;
        setTimeout(() => waitForDb(cb, tries + 1), 200);
    }

    function loadSearchCaches() {
        waitForDb((database) => {
            database.collection('posts').orderBy('timestamp', 'desc').limit(50).get()
                .then(snap => {
                    blogCache = snap.docs
                        .filter(d => d.data().type === 'blog')
                        .map(d => ({ id: d.id, title: d.data().title || '', body: d.data().body || '' }));
                })
                .catch(() => {});

            database.collection('guestbook').limit(50).get()
                .then(snap => {
                    guestbookCache = snap.docs.map(d => ({
                        id: d.id,
                        name: d.data().name || 'Anonymous',
                        message: d.data().message || ''
                    }));
                })
                .catch(() => {});

            // Chat lives in the same project's chatMessages collection.
            database.collection('chatMessages').orderBy('timestamp', 'desc').limit(50).get()
                .then(snap => {
                    chatCache = snap.docs.map(d => ({
                        id: d.id,
                        name: d.data().name || 'Anonymous',
                        text: d.data().text || ''
                    }));
                })
                .catch(() => {});

            cacheLoaded = true;
        });
    }

    // Load once on page load, and refresh every few minutes so results stay
    // reasonably current without re-fetching on every keystroke.
    document.addEventListener('DOMContentLoaded', () => {
        loadSearchCaches();
        setInterval(loadSearchCaches, 3 * 60 * 1000);
    });

    function truncate(str, n) {
        if (!str) return '';
        return str.length > n ? str.slice(0, n).trim() + '…' : str;
    }

    // ---------- Override renderPaletteResults to append extra sections ----------
    const originalRender = renderPaletteResults;
    renderPaletteResults = function (query) {
        originalRender(query);
        const q = query.trim();
        if (!q || !cacheLoaded) return; // only search dynamic content once a query exists

        const box = document.getElementById('cmd-results');
        if (!box) return;

        const blogMatches = blogCache
            .map(p => ({ ...p, score: Math.max(fuzzyScore(q, p.title), fuzzyScore(q, p.body)) }))
            .filter(p => p.score >= 0).sort((a, b) => b.score - a.score).slice(0, 3);

        const guestbookMatches = guestbookCache
            .map(g => ({ ...g, score: Math.max(fuzzyScore(q, g.name), fuzzyScore(q, g.message)) }))
            .filter(g => g.score >= 0).sort((a, b) => b.score - a.score).slice(0, 3);

        const chatMatches = chatCache
            .map(c => ({ ...c, score: Math.max(fuzzyScore(q, c.name), fuzzyScore(q, c.text)) }))
            .filter(c => c.score >= 0).sort((a, b) => b.score - a.score).slice(0, 3);

        if (!blogMatches.length && !guestbookMatches.length && !chatMatches.length) return;

        // If the "no matches" empty-state rendered, clear it since we do have results now.
        if (box.querySelector('.cmd-empty')) box.innerHTML = '';

        let extraHtml = '';
        let idxBase = cmdCurrentResults.length;

        if (blogMatches.length) {
            extraHtml += '<div class="cmd-section-label">Blog</div>';
            blogMatches.forEach(p => {
                const idx = cmdCurrentResults.length;
                cmdCurrentResults.push({ type: 'blog', label: p.title, sub: truncate(p.body, 60), action: () => { window.location.href = 'blog.html'; } });
                extraHtml += `<div class="cmd-result" data-idx="${idx}"><span>📝 ${escapeSearchHtml(p.title)}</span><span class="cmd-result-type">${escapeSearchHtml(truncate(p.body, 40))}</span></div>`;
            });
        }
        if (guestbookMatches.length) {
            extraHtml += '<div class="cmd-section-label">Guestbook</div>';
            guestbookMatches.forEach(g => {
                const idx = cmdCurrentResults.length;
                cmdCurrentResults.push({ type: 'guestbook', label: g.name, sub: truncate(g.message, 60), action: () => { window.location.href = 'guestbook.html'; } });
                extraHtml += `<div class="cmd-result" data-idx="${idx}"><span>✍️ ${escapeSearchHtml(g.name)}</span><span class="cmd-result-type">${escapeSearchHtml(truncate(g.message, 40))}</span></div>`;
            });
        }
        if (chatMatches.length) {
            extraHtml += '<div class="cmd-section-label">Chat</div>';
            chatMatches.forEach(c => {
                const idx = cmdCurrentResults.length;
                cmdCurrentResults.push({ type: 'chat', label: c.name, sub: truncate(c.text, 60), action: () => { window.location.href = 'chat.html'; } });
                extraHtml += `<div class="cmd-result" data-idx="${idx}"><span>💬 ${escapeSearchHtml(c.name)}</span><span class="cmd-result-type">${escapeSearchHtml(truncate(c.text, 40))}</span></div>`;
            });
        }

        box.insertAdjacentHTML('beforeend', extraHtml);
        box.querySelectorAll('.cmd-result[data-idx]').forEach(el => {
            const idx = parseInt(el.dataset.idx, 10);
            if (idx < idxBase) return; // already wired by the original renderer
            el.addEventListener('mouseenter', () => setActiveResult(idx));
            el.addEventListener('click', () => runActiveResult(idx));
        });
    };

    function escapeSearchHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
})();
