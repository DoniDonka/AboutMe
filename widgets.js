/**
 * DONI | DEV - Live Widgets (v3.2)
 * ------------------------------------------------------------------
 * Gaming/social/dev widgets + admin power-ups. 100% client-side, so it
 * degrades gracefully: any widget that isn't configured shows a small
 * "not configured" hint instead of breaking.
 *
 * IMPORTANT (static GitHub Pages): never put a SECRET key here — it ships
 * to every visitor. Public IDs (Discord/Steam/Roblox IDs, Last.fm user)
 * are fine. For secret-key services (Steam, Spotify) point *Proxy fields
 * at a tiny serverless function (e.g. a free Cloudflare Worker) that holds
 * the key server-side and returns JSON.
 */

const WIDGET_CONFIG = {
    // Discord — uses the public Lanyard API. Join discord.gg/lanyard first.
    discordUserId: '329997541523587073',

    // GitHub — public API, no token needed.
    githubUser: 'DoniDonka',

    // Steam — needs a secret key, so use a proxy that returns the Steam
    // GetPlayerSummaries JSON. Leave steamProxy blank to show a hint.
    steamId64: '76561198372730047',
    steamProxy: '',               // e.g. https://your-worker.workers.dev/steam

    // Music — Last.fm (free read-only key) or a Spotify proxy.
    lastfmUser: 'DoniDonka',
    lastfmApiKey: '',             // create a free key at last.fm/api
    spotifyProxy: '',             // e.g. https://your-worker.workers.dev/spotify

    // Roblox — profile card (avatar + link). Live presence needs auth, so we
    // show the public profile; avatar loads via the image endpoint (no CORS).
    robloxUserId: '213240910'
};

const Widgets = (() => {
    const el = (id) => document.getElementById(id);
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

    async function fetchJson(url, opts = {}) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        try {
            const res = await fetch(url, { signal: ctrl.signal, ...opts });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } finally { clearTimeout(t); }
    }

    function hint(id, msg) {
        const box = el(id);
        if (box) box.innerHTML = `<div class="widget-hint">${esc(msg)}</div>`;
    }

    // ---------- Discord (Lanyard) ----------
    async function renderDiscord() {
        const box = el('w-discord-body');
        if (!box) return;
        if (!WIDGET_CONFIG.discordUserId) { hint('w-discord-body', 'Add your Discord ID + join discord.gg/lanyard'); return; }
        try {
            const data = await fetchJson('https://api.lanyard.rest/v1/users/' + WIDGET_CONFIG.discordUserId);
            const d = data.data;
            const statusColors = { online: '#22c55e', idle: '#f59e0b', dnd: '#ef4444', offline: '#6b7280' };
            const status = d.discord_status || 'offline';
            const color = statusColors[status] || '#6b7280';
            const user = d.discord_user || {};
            const avatar = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
            const custom = (d.activities || []).find(a => a.type === 4);
            const game = (d.activities || []).find(a => a.type === 0);
            box.innerHTML = `
                <div class="discord-widget">
                    <div class="discord-avatar" style="--sc:${color}">
                        <img src="${esc(avatar)}" alt="avatar">
                        <span class="discord-dot" style="background:${color}"></span>
                    </div>
                    <div class="discord-meta">
                        <div class="discord-name">${esc(user.global_name || user.username || 'Discord')}</div>
                        <div class="discord-status" style="color:${color}">${esc(status.toUpperCase())}</div>
                        ${custom ? `<div class="discord-custom">${esc(custom.emoji?.name || '')} ${esc(custom.state || '')}</div>` : ''}
                        ${game ? `<div class="discord-game">🎮 ${esc(game.name)}</div>` : ''}
                    </div>
                </div>`;
        } catch (e) {
            hint('w-discord-body', 'Discord status unavailable (check ID / Lanyard membership)');
        }
    }

    // ---------- GitHub ----------
    async function renderGithub() {
        const box = el('w-github-body');
        if (!box || !WIDGET_CONFIG.githubUser) return;
        const u = WIDGET_CONFIG.githubUser;
        try {
            const [user, repos] = await Promise.all([
                fetchJson('https://api.github.com/users/' + u),
                fetchJson(`https://api.github.com/users/${u}/repos?sort=updated&per_page=1`)
            ]);
            const recent = repos && repos[0];
            let grid = '';
            try {
                const contrib = await fetchJson(`https://github-contributions-api.jogruber.de/v4/${u}?y=last`);
                const days = (contrib.contributions || []).slice(-119);
                const max = Math.max(1, ...days.map(d => d.count));
                grid = `<div class="gh-grid">${days.map(d => {
                    const lvl = d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4));
                    return `<span class="gh-cell l${lvl}" title="${esc(d.date)}: ${d.count}"></span>`;
                }).join('')}</div>`;
            } catch (e) { /* grid optional */ }
            box.innerHTML = `
                <div class="gh-stats">
                    <div><strong>${(user.public_repos || 0)}</strong><span>repos</span></div>
                    <div><strong>${(user.followers || 0)}</strong><span>followers</span></div>
                    <div><strong>${(user.following || 0)}</strong><span>following</span></div>
                </div>
                ${grid}
                ${recent ? `<a class="gh-recent" href="${esc(recent.html_url)}" target="_blank" rel="noopener">
                    <span>↻ ${esc(recent.name)}</span>
                    <span class="gh-recent-desc">${esc(recent.description || 'Recently updated')}</span>
                </a>` : ''}`;
        } catch (e) {
            hint('w-github-body', 'GitHub API rate-limited — try again later');
        }
    }

    // ---------- Music (Last.fm) ----------
    async function renderMusic() {
        const box = el('w-music-body');
        if (!box) return;
        if (WIDGET_CONFIG.spotifyProxy) return renderSpotify();
        if (!WIDGET_CONFIG.lastfmUser || !WIDGET_CONFIG.lastfmApiKey) {
            hint('w-music-body', 'Add your Last.fm username + key (or a Spotify proxy)'); return;
        }
        try {
            const data = await fetchJson(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(WIDGET_CONFIG.lastfmUser)}&api_key=${encodeURIComponent(WIDGET_CONFIG.lastfmApiKey)}&format=json&limit=1`);
            const track = data.recenttracks?.track?.[0];
            if (!track) { hint('w-music-body', 'No recent tracks'); return; }
            const nowPlaying = track['@attr']?.nowplaying === 'true';
            const art = (track.image || []).find(i => i.size === 'large')?.['#text'] || '';
            renderTrack(box, { title: track.name, artist: track.artist?.['#text'] || track.artist, art, nowPlaying });
        } catch (e) { hint('w-music-body', 'Last.fm unavailable'); }
    }

    async function renderSpotify() {
        const box = el('w-music-body');
        try {
            const t = await fetchJson(WIDGET_CONFIG.spotifyProxy);
            if (!t || !t.title) { hint('w-music-body', 'Nothing playing'); return; }
            renderTrack(box, { title: t.title, artist: t.artist, art: t.art || t.albumArt, nowPlaying: !!t.isPlaying });
        } catch (e) { hint('w-music-body', 'Spotify proxy unavailable'); }
    }

    function renderTrack(box, t) {
        box.innerHTML = `
            <div class="music-widget">
                <div class="music-art">${t.art ? `<img src="${esc(t.art)}" alt="art">` : '🎵'}</div>
                <div class="music-meta">
                    <div class="music-status">${t.nowPlaying ? '<span class="eq"><i></i><i></i><i></i></span> Now Playing' : 'Last Played'}</div>
                    <div class="music-title">${esc(t.title)}</div>
                    <div class="music-artist">${esc(t.artist)}</div>
                </div>
            </div>`;
    }

    // ---------- Steam ----------
    async function renderSteam() {
        const box = el('w-steam-body');
        if (!box) return;
        if (!WIDGET_CONFIG.steamProxy) { hint('w-steam-body', 'Needs a Steam proxy (secret key can\'t ship in static JS)'); return; }
        try {
            const d = await fetchJson(WIDGET_CONFIG.steamProxy);
            const p = d.player || d;
            const playing = p.gameextrainfo;
            box.innerHTML = `
                <div class="steam-widget">
                    <div class="steam-avatar">${p.avatarfull ? `<img src="${esc(p.avatarfull)}" alt="steam">` : '🎮'}</div>
                    <div class="steam-meta">
                        <div class="steam-name">${esc(p.personaname || 'Steam')}</div>
                        <div class="steam-status ${playing ? 'ingame' : ''}">${playing ? '▶ ' + esc(playing) : 'Not in game'}</div>
                        ${d.recent ? `<div class="steam-recent">Recent: ${esc(d.recent)}</div>` : ''}
                    </div>
                </div>`;
        } catch (e) { hint('w-steam-body', 'Steam proxy unavailable'); }
    }

    // ---------- Roblox (profile card) ----------
    async function renderRoblox() {
        const box = el('w-roblox-body');
        if (!box) return;
        const id = WIDGET_CONFIG.robloxUserId;
        if (!id) { hint('w-roblox-body', 'Add your Roblox user ID'); return; }
        // Avatar via the image endpoint (works in <img>, no CORS needed).
        const avatar = `https://www.roblox.com/headshot-thumbnail/image?userId=${id}&width=150&height=150&format=png`;
        const profile = `https://www.roblox.com/users/${id}/profile`;
        let name = '@DoniDonka';
        try {
            // Username lookup may be CORS-blocked; ignore failures.
            const d = await fetchJson('https://users.roblox.com/v1/users/' + id);
            if (d && d.name) name = (d.displayName || d.name);
        } catch (e) { /* fall back to default name */ }
        box.innerHTML = `
            <div class="roblox-widget">
                <div class="roblox-avatar"><img src="${esc(avatar)}" alt="roblox" onerror="this.style.display='none'"></div>
                <div class="roblox-meta">
                    <div class="roblox-name">${esc(name)}</div>
                    <a class="roblox-link" href="${esc(profile)}" target="_blank" rel="noopener">View Profile →</a>
                </div>
            </div>`;
    }

    // ---------- Settings-driven UI (status override / latest update / toggles) ----------
    function applySettings(data) {
        if (!data) return;
        // Availability badge
        if (typeof data.availability === 'string') {
            const badge = el('availability-badge');
            if (badge) {
                if (data.availability.trim()) { badge.textContent = data.availability; badge.style.display = 'inline-flex'; }
                else badge.style.display = 'none';
            }
            const availInput = el('admin-avail-input');
            if (availInput && document.activeElement !== availInput) availInput.value = data.availability;
        }
        // Latest update note
        if (data.latestUpdate && typeof data.latestUpdate.text === 'string') {
            const card = el('w-updates-body');
            if (card) {
                const when = data.latestUpdate.date ? new Date(data.latestUpdate.date).toLocaleString() : '';
                card.innerHTML = `<div class="update-note">${renderMarkdownLite(data.latestUpdate.text)}</div>
                    <div class="update-date">${esc(when)}</div>`;
            }
        }
        // Feature toggles: hide/show cards
        if (data.widgetToggles && typeof data.widgetToggles === 'object') {
            Object.entries(data.widgetToggles).forEach(([key, on]) => {
                const card = document.querySelector(`[data-widget="${key}"]`);
                if (card) card.style.display = on === false ? 'none' : '';
            });
            const av = el('admin-toggle-row');
            if (av) renderToggleControls(data.widgetToggles);
        }
    }

    // tiny markdown: **bold**, *italic*, `code`, links, newlines
    function renderMarkdownLite(text) {
        let s = esc(text);
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
             .replace(/\*(.+?)\*/g, '<em>$1</em>')
             .replace(/`(.+?)`/g, '<code>$1</code>')
             .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
             .replace(/\n/g, '<br>');
        return s;
    }

    // ---------- Admin power-ups ----------
    const WIDGET_KEYS = ['discord', 'github', 'music', 'steam', 'roblox', 'techstack', 'hardware', 'updates'];
    let sessionId = null;

    function currentToggles() {
        try { return JSON.parse(localStorage.getItem('doni_widget_toggles') || '{}'); } catch (e) { return {}; }
    }

    function renderToggleControls(toggles) {
        const row = el('admin-toggle-row');
        if (!row) return;
        row.innerHTML = '';
        WIDGET_KEYS.forEach(key => {
            const on = toggles[key] !== false;
            const wrap = document.createElement('label');
            wrap.className = 'toggle-item';
            wrap.innerHTML = `<span>${key}</span>`;
            const sw = document.createElement('input');
            sw.type = 'checkbox';
            sw.checked = on;
            sw.addEventListener('change', () => {
                const t = currentToggles();
                t[key] = sw.checked;
                localStorage.setItem('doni_widget_toggles', JSON.stringify(t));
                const card = document.querySelector(`[data-widget="${key}"]`);
                if (card) card.style.display = sw.checked ? '' : 'none';
                if (typeof FirestoreDB !== 'undefined') FirestoreDB.saveSettings({ widgetToggles: t });
            });
            wrap.appendChild(sw);
            row.appendChild(wrap);
        });
    }

    async function refreshLiveAnalytics() {
        const online = el('admin-online-count');
        const views = el('admin-total-views');
        if (typeof db === 'undefined' || !db || typeof firebaseReady === 'undefined' || !firebaseReady) {
            if (online) online.textContent = '—';
            if (views) views.textContent = '—';
            return;
        }
        try {
            const doc = await db.collection('analytics').doc('global').get();
            if (views) views.textContent = doc.exists ? (doc.data().totalViews || 0).toLocaleString() : '0';
        } catch (e) { if (views) views.textContent = '—'; }
        try {
            const cutoff = firebase.firestore.Timestamp.fromMillis(Date.now() - 60000);
            const snap = await db.collection('presence').where('t', '>', cutoff).get();
            if (online) online.textContent = String(snap.size);
        } catch (e) { if (online) online.textContent = '—'; }
    }

    function startPresence() {
        if (typeof db === 'undefined' || !db || typeof firebaseReady === 'undefined' || !firebaseReady) return;
        sessionId = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const beat = () => {
            db.collection('presence').doc(sessionId)
                .set({ t: firebase.firestore.FieldValue.serverTimestamp() })
                .catch(() => { /* best effort */ });
        };
        beat();
        setInterval(beat, 20000);
    }

    function initAdminPowerUps() {
        // Feature toggles
        renderToggleControls(currentToggles());

        // Live analytics
        const refreshBtn = el('admin-analytics-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', refreshLiveAnalytics);

        // Status override
        const availSave = el('admin-avail-save');
        if (availSave) availSave.addEventListener('click', () => {
            const val = el('admin-avail-input')?.value || '';
            if (typeof FirestoreDB !== 'undefined') FirestoreDB.saveSettings({ availability: val });
            const badge = el('availability-badge');
            if (badge) {
                if (val.trim()) { badge.textContent = val; badge.style.display = 'inline-flex'; }
                else badge.style.display = 'none';
            }
            if (typeof UI !== 'undefined') UI.toast('Availability updated', 'success');
        });

        // Quick-post note
        const postSave = el('admin-post-save');
        if (postSave) postSave.addEventListener('click', () => {
            const text = el('admin-post-input')?.value || '';
            if (!text.trim()) { if (typeof UI !== 'undefined') UI.toast('Write something first', 'info'); return; }
            const latestUpdate = { text: text.trim(), date: Date.now() };
            if (typeof FirestoreDB !== 'undefined') FirestoreDB.saveSettings({ latestUpdate });
            applySettings({ latestUpdate });
            if (typeof UI !== 'undefined') UI.toast('Update published', 'success');
        });

        // React to admin tab opening
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.atab === 'live') refreshLiveAnalytics();
            });
        });
    }

    function init() {
        // Apply any locally cached toggles immediately (no flash of hidden cards)
        const cached = currentToggles();
        Object.entries(cached).forEach(([key, on]) => {
            const card = document.querySelector(`[data-widget="${key}"]`);
            if (card && on === false) card.style.display = 'none';
        });

        renderDiscord();
        renderGithub();
        renderMusic();
        renderSteam();
        renderRoblox();
        initAdminPowerUps();

        // Presence + analytics need Firebase; wait for it.
        let tries = 0;
        const wait = setInterval(() => {
            if (typeof firebaseReady !== 'undefined' && firebaseReady && typeof db !== 'undefined' && db) {
                clearInterval(wait);
                startPresence();
                refreshLiveAnalytics();
            } else if (++tries > 40) { clearInterval(wait); }
        }, 250);
    }

    return { init, applySettings, refreshLiveAnalytics };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Widgets.init);
} else {
    Widgets.init();
}
