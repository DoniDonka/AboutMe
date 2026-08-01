/**
 * DONI | DEV — Content Editor v1.0
 * Lets the admin publish new blog posts and changelog entries from Firestore
 * without touching code. Existing hardcoded posts/entries are untouched —
 * these render in a separate container above them.
 */
console.log('%c[DONI] content-editor.js build: 2026-07-31', 'color:#22c55e;font-weight:bold;');
(function () {
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function waitForDb(cb, tries, onTimeout) {
        tries = tries || 0;
        const ready = (typeof firebaseReady !== 'undefined' && firebaseReady) &&
                      (typeof db !== 'undefined' && db);
        if (ready) { cb(db); return; }
        if (tries > 30) {
            console.error('[ContentEditor] Firebase never became ready after 6s');
            if (onTimeout) onTimeout();
            else if (typeof UI !== 'undefined') UI.toast('Could not connect to the database — try refreshing the page', 'error');
            return;
        }
        setTimeout(() => waitForDb(cb, tries + 1, onTimeout), 200);
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

    function youtubeEmbedUrl(link) {
        if (!link) return null;
        const m = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
        return m ? `https://www.youtube.com/embed/${m[1]}` : null;
    }

    function renderShowcaseItems(database, containerId, opts) {
        const container = document.getElementById(containerId);
        if (!container) return;
        opts = opts || {};
        const limit = opts.limit || 50;
        const filterType = opts.filterType || null; // 'build' | 'video' | 'photo' | null (all)

        database.collection('posts').orderBy('timestamp', 'desc').limit(50).get()
            .then(snap => {
                let items = snap.docs.filter(d => ['build', 'video', 'photo'].includes(d.data().type));
                if (filterType) items = items.filter(d => d.data().type === filterType);
                items = items.slice(0, limit);

                // The homepage strip has a wrapping section that starts hidden —
                // only reveal it once there's actual content to show.
                const homeSection = document.getElementById('home-showcase-section');
                if (homeSection) homeSection.style.display = items.length ? 'block' : 'none';

                if (!items.length) {
                    container.innerHTML = opts.emptyText
                        ? `<div class="showcase-empty">${escapeHtml(opts.emptyText)}</div>` : '';
                    return;
                }

                container.innerHTML = items.map(doc => {
                    const p = doc.data();
                    const embedUrl = p.type === 'video' ? youtubeEmbedUrl(p.link) : null;
                    const media = embedUrl
                        ? `<div class="showcase-video-wrap"><iframe src="${embedUrl}" loading="lazy" allowfullscreen frameborder="0"></iframe></div>`
                        : p.imageUrl
                        ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.title || '')}" class="showcase-img" loading="lazy">`
                        : '';
                    const typeLabel = { build: '🔨 Build', video: '▶️ Video', photo: '📷 Photo' }[p.type] || '';
                    const linkHtml = (p.link && !embedUrl)
                        ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noopener" class="showcase-link">View →</a>` : '';
                    return `<div class="showcase-card">
                        ${media}
                        <div class="showcase-card-body">
                            <span class="tag">${typeLabel}</span>
                            <h3>${escapeHtml(p.title || '')}</h3>
                            ${p.body ? `<p>${escapeHtml(p.body)}</p>` : ''}
                            ${linkHtml}
                        </div>
                    </div>`;
                }).join('');
            })
            .catch(err => console.warn('[ContentEditor] showcase fetch failed:', err));
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
        const imageRow = document.getElementById('cms-image-row');
        const imageEl = document.getElementById('cms-post-image');
        const linkRow = document.getElementById('cms-link-row');
        const linkEl = document.getElementById('cms-post-link');
        const bodyLabel = document.getElementById('cms-body-label');
        const publishBtn = document.getElementById('cms-post-publish');
        const listEl = document.getElementById('cms-post-list');
        if (!publishBtn) return; // not on this page

        const SHOWCASE_TYPES = ['build', 'video', 'photo'];

        function toggleFields() {
            const type = typeEl.value;
            const isChangelog = type === 'changelog';
            const isShowcase = SHOWCASE_TYPES.includes(type);
            if (versionRow) versionRow.style.display = isChangelog ? 'block' : 'none';
            if (imageRow) imageRow.style.display = isShowcase ? 'block' : 'none';
            if (linkRow) linkRow.style.display = isShowcase ? 'block' : 'none';
            if (bodyLabel) bodyLabel.textContent = isChangelog ? 'Changes (one per line)' : 'Description';
            if (bodyEl) bodyEl.placeholder = isChangelog
                ? 'One change per line, e.g.\nAdded dark mode toggle\nFixed chat crash on load'
                : isShowcase ? 'Short description of this build/video/photo...'
                : 'Post body...';
        }
        if (typeEl) { typeEl.addEventListener('change', toggleFields); toggleFields(); }

        publishBtn.addEventListener('click', () => {
            console.log('[ContentEditor] Publish clicked');
            const title = (titleEl?.value || '').trim();
            const body = (bodyEl?.value || '').trim();
            const type = typeEl?.value || 'blog';
            const isShowcase = SHOWCASE_TYPES.includes(type);

            if (type === 'blog' && (!title || !body)) {
                alert('Blog posts need a title and body');
                return;
            }
            if (type === 'changelog' && !body) {
                alert('Add at least one change (one per line)');
                return;
            }
            if (isShowcase && !title) {
                alert('Showcase items need a title');
                return;
            }
            if (isShowcase && type !== 'video' && !imageEl?.value?.trim()) {
                alert('Showcase builds/photos need an image URL');
                return;
            }
            publishBtn.disabled = true;
            publishBtn.textContent = 'Publishing...';

            waitForDb((database) => {
                const payload = {
                    type,
                    title: title || null,
                    body,
                    tags: tagsEl && tagsEl.value ? tagsEl.value.split(',').map(t => t.trim()).filter(Boolean) : [],
                    version: type === 'changelog' ? (versionEl?.value || '').trim() : null,
                    imageUrl: isShowcase ? (imageEl?.value?.trim() || null) : null,
                    link: isShowcase ? (linkEl?.value?.trim() || null) : null,
                    badge: 'Update',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                database.collection('posts').add(payload)
                    .then(async () => {
                        alert('Published!');
                        if (type === 'blog') {
                            try {
                                const adminAuth = firebase.auth().currentUser;
                                const token = adminAuth ? await adminAuth.getIdToken() : null;
                                if (token) {
                                    fetch('https://aboutme.donidonka511.workers.dev/broadcast-notification', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                                        body: JSON.stringify({
                                            category: 'blogPosts',
                                            title: 'New blog post',
                                            body: title,
                                            url: 'blog.html'
                                        })
                                    }).catch(() => {}); // best effort — don't block the publish flow on this
                                }
                            } catch (e) { /* best effort */ }
                        }
                        titleEl.value = ''; bodyEl.value = ''; if (tagsEl) tagsEl.value = ''; if (versionEl) versionEl.value = '';
                        if (imageEl) imageEl.value = ''; if (linkEl) linkEl.value = '';
                        loadPostList(database);
                    })
                    .catch(err => { console.error('[ContentEditor] publish failed:', err); alert('Publish failed: ' + err.message); })
                    .finally(() => { publishBtn.disabled = false; publishBtn.textContent = 'Publish'; });
            }, 0, () => {
                publishBtn.disabled = false;
                publishBtn.textContent = 'Publish';
                alert('Could not connect — check your connection and try again');
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
            if (document.getElementById('showcase-grid')) {
                renderShowcaseItems(database, 'showcase-grid', { emptyText: 'Nothing added yet — check back soon.' });
            }
            if (document.getElementById('home-showcase-strip')) {
                renderShowcaseItems(database, 'home-showcase-strip', { limit: 4 });
            }
        });
        initAdminPostEditor();
    });

    window.ContentEditor = { deletePost, renderShowcaseItems };
})();
