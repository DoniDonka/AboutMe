/**
 * DONI | DEV — Content Editor v1.0
 * Lets the admin publish new blog posts and changelog entries from Firestore
 * without touching code. Existing hardcoded posts/entries are untouched —
 * these render in a separate container above them.
 */
(function () {
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function waitForDb(cb, tries) {
        tries = tries || 0;
        const ready = (typeof firebaseReady !== 'undefined' && firebaseReady) &&
                      (typeof db !== 'undefined' && db);
        if (ready) { cb(db); return; }
        if (tries > 30) return;
        setTimeout(() => waitForDb(cb, tries + 1), 200);
    }

    // ---------- Reader-side rendering ----------

    function renderBlogPosts(database) {
        const container = document.getElementById('dynamic-blog-posts');
        if (!container) return;
        // Ordered by timestamp only (no compound where+orderBy) so this never
        // needs a manual Firestore composite index — filter by type client-side.
        database.collection('posts').orderBy('timestamp', 'desc').limit(30).get()
            .then(snap => {
                const posts = snap.docs.filter(doc => doc.data().type === 'blog').slice(0, 20);
                if (!posts.length) return;
                container.innerHTML = posts.map(doc => {
                    const p = doc.data();
                    const date = p.timestamp && p.timestamp.toDate ? p.timestamp.toDate() : new Date();
                    const day = date.getDate();
                    const month = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    const tags = (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
                    return `<article class="blog-entry">
                        <div class="blog-date"><span class="blog-day">${day}</span><span class="blog-month">${month}</span></div>
                        <div class="blog-content">
                            <span class="tag green">${escapeHtml(p.badge || 'Update')}</span>
                            <h2>${escapeHtml(p.title)}</h2>
                            <p>${escapeHtml(p.body)}</p>
                            <div class="blog-tags">${tags}</div>
                        </div>
                    </article>`;
                }).join('');
            })
            .catch(err => console.warn('[ContentEditor] blog fetch failed:', err));
    }

    function renderChangelogEntries(database) {
        const container = document.getElementById('dynamic-changelog-entries');
        if (!container) return;
        database.collection('posts').orderBy('timestamp', 'desc').limit(30).get()
            .then(snap => {
                const posts = snap.docs.filter(doc => doc.data().type === 'changelog').slice(0, 20);
                if (!posts.length) return;
                container.innerHTML = posts.map(doc => {
                    const p = doc.data();
                    const date = p.timestamp && p.timestamp.toDate ? p.timestamp.toDate() : new Date();
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const items = (p.body || '').split('\n').filter(Boolean).map(line =>
                        `<li><span class="cl-tag added">Update</span> ${escapeHtml(line)}</li>`
                    ).join('');
                    return `<div class="changelog-version">
                        <div class="changelog-badge current">${escapeHtml(p.version || 'v—')}</div>
                        <div class="changelog-date">${dateStr}</div>
                        <ul>${items}</ul>
                    </div>`;
                }).join('');
            })
            .catch(err => console.warn('[ContentEditor] changelog fetch failed:', err));
    }

    // ---------- Admin publish UI (index.html only) ----------

    function initAdminPostEditor() {
        const typeEl = document.getElementById('cms-post-type');
        const titleEl = document.getElementById('cms-post-title');
        const bodyEl = document.getElementById('cms-post-body');
        const tagsEl = document.getElementById('cms-post-tags');
        const versionRow = document.getElementById('cms-version-row');
        const versionEl = document.getElementById('cms-post-version');
        const publishBtn = document.getElementById('cms-post-publish');
        const listEl = document.getElementById('cms-post-list');
        if (!publishBtn) return; // not on this page

        function toggleFields() {
            const isChangelog = typeEl.value === 'changelog';
            if (versionRow) versionRow.style.display = isChangelog ? 'block' : 'none';
            if (bodyEl) bodyEl.placeholder = isChangelog
                ? 'One change per line, e.g.\nAdded dark mode toggle\nFixed chat crash on load'
                : 'Post body...';
        }
        if (typeEl) { typeEl.addEventListener('change', toggleFields); toggleFields(); }

        publishBtn.addEventListener('click', () => {
            const title = (titleEl?.value || '').trim();
            const body = (bodyEl?.value || '').trim();
            const type = typeEl?.value || 'blog';
            if (!body || (type === 'blog' && !title)) {
                if (typeof UI !== 'undefined') UI.toast('Fill in the required fields', 'info');
                return;
            }
            waitForDb((database) => {
                const payload = {
                    type,
                    title: title || null,
                    body,
                    tags: tagsEl && tagsEl.value ? tagsEl.value.split(',').map(t => t.trim()).filter(Boolean) : [],
                    version: type === 'changelog' ? (versionEl?.value || '').trim() : null,
                    badge: 'Update',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                database.collection('posts').add(payload)
                    .then(() => {
                        if (typeof UI !== 'undefined') UI.toast('Published!', 'success');
                        titleEl.value = ''; bodyEl.value = ''; if (tagsEl) tagsEl.value = ''; if (versionEl) versionEl.value = '';
                        loadPostList(database);
                    })
                    .catch(err => { if (typeof UI !== 'undefined') UI.toast('Publish failed: ' + err.message, 'error'); });
            });
        });

        function loadPostList(database) {
            if (!listEl) return;
            database.collection('posts').orderBy('timestamp', 'desc').limit(15).get()
                .then(snap => {
                    if (snap.empty) { listEl.innerHTML = '<div class="admin-list-empty">No posts yet.</div>'; return; }
                    listEl.innerHTML = snap.docs.map(doc => {
                        const p = doc.data();
                        const label = p.type === 'changelog' ? (p.version || 'changelog') : (p.title || 'blog post');
                        return `<div class="admin-list-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);">
                            <span style="font-size:0.8rem;">[${escapeHtml(p.type)}] ${escapeHtml(label)}</span>
                            <button class="snippet-btn" data-post-id="${doc.id}" onclick="ContentEditor.deletePost('${doc.id}')">Delete</button>
                        </div>`;
                    }).join('');
                })
                .catch(() => { listEl.innerHTML = '<div class="admin-list-empty">Failed to load.</div>'; });
        }

        waitForDb(loadPostList);
        window._cmsLoadPostList = loadPostList;
    }

    function deletePost(id) {
        if (!confirm('Delete this post? This cannot be undone.')) return;
        waitForDb((database) => {
            database.collection('posts').doc(id).delete()
                .then(() => {
                    if (typeof UI !== 'undefined') UI.toast('Deleted', 'success');
                    if (window._cmsLoadPostList) window._cmsLoadPostList(database);
                })
                .catch(err => { if (typeof UI !== 'undefined') UI.toast('Delete failed: ' + err.message, 'error'); });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        waitForDb((database) => {
            renderBlogPosts(database);
            renderChangelogEntries(database);
        });
        initAdminPostEditor();
    });

    window.ContentEditor = { deletePost };
})();
