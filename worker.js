/* DONI | DEV — Cloudflare Worker v3.5 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ADMIN_SECRET = 'doni-admin-2026'; // legacy fallback only — see requireAdmin()
const ADMIN_EMAIL = 'doni@admin.com';
const STALE_SESSION_MS = 90000; // a session with no join/click in 90s is considered gone

class Router {
    constructor() { this.routes = []; }
    get(path, handler) { this.routes.push({ method: 'GET', path, handler }); return this; }
    post(path, handler) { this.routes.push({ method: 'POST', path, handler }); return this; }
    async handle(request, env, ctx) {
        const url = new URL(request.url);
        const route = this.routes.find(r => r.method === request.method && r.path === url.pathname);
        if (!route) return null;
        return await route.handler(request, env, ctx, url);
    }
}

function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
}

async function sendDiscord(embed, env) {
    if (!env.DISCORD_WEBHOOK_URL) return;
    try {
        await fetch(env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    } catch (e) { /* best effort — never let a Discord failure break the API response */ }
}

async function getCountryInfo(ip) {
    try {
        const res = await fetch('https://ipapi.co/' + ip + '/json/');
        const data = await res.json();
        const code = data.country_code;
        const name = data.country_name || 'Unknown';
        if (!code) return { flag: '🌐', name };
        const base = 127397;
        const flag = String.fromCodePoint(base + code.charCodeAt(0), base + code.charCodeAt(1));
        return { flag, name };
    } catch (e) { return { flag: '🌐', name: 'Unknown' }; }
}

async function requireAdmin(request) {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return false;
    const token = auth.slice(7);

    // Legacy static secret — kept only so nothing old breaks immediately.
    if (token === ADMIN_SECRET) return true;

    // Real check: verify the Firebase ID token via Google's tokeninfo endpoint
    // and confirm the email claim matches the admin account.
    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
        if (!res.ok) return false;
        const info = await res.json();
        return !!(info.email && info.email.toLowerCase() === ADMIN_EMAIL && info.email_verified !== 'false');
    } catch (e) { return false; }
}

// ------------------------------------------------------------------
// In-memory storage (resets on worker restart/redeploy — fine for a
// lightweight visitor counter; nothing here needs to be durable).
// ------------------------------------------------------------------
const sessions = new Map(); // sessionId -> { start, lastSeen, page, pages, clicks, country, referrer }
let currentAnnouncement = null;

function pruneStaleSessions() {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.lastSeen > STALE_SESSION_MS) sessions.delete(id);
    }
}

const router = new Router();

// ---------------- Visitor tracking ----------------

router.post('/visitor-join', async (request, env) => {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const { flag, name: countryName } = await getCountryInfo(ip);

    const sessionId = body.sessionId || ('sess_' + Math.random().toString(36).slice(2));
    const now = Date.now();

    sessions.set(sessionId, {
        start: now,
        lastSeen: now,
        page: body.page || '/',
        pages: Array.isArray(body.pages) ? body.pages : [body.page || '/'],
        clicks: [],
        country: flag,
        referrer: body.referrer || 'direct',
        screen: body.screen || 'unknown',
        language: body.language || 'unknown',
        platform: body.platform || 'unknown'
    });
    pruneStaleSessions();

    await sendDiscord({
        title: `${flag} New Visitor`,
        color: 0x22c55e,
        fields: [
            { name: 'Page', value: body.page || '/', inline: true },
            { name: 'Country', value: countryName, inline: true },
            { name: 'Referrer', value: body.referrer || 'direct', inline: true },
            { name: 'Screen', value: body.screen || 'unknown', inline: true },
            { name: 'Language', value: body.language || 'unknown', inline: true },
            { name: 'Platform', value: body.platform || 'unknown', inline: true }
        ],
        timestamp: new Date().toISOString()
    }, env);

    return jsonResponse({ ok: true, sessionId, count: sessions.size });
});

router.post('/visitor-leave', async (request, env) => {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const session = sessions.get(body.sessionId);
    sessions.delete(body.sessionId);
    pruneStaleSessions();

    const pages = Array.isArray(body.pages) ? body.pages : (session ? session.pages : []);
    const clickTrail = session && session.clicks.length
        ? session.clicks.slice(-8).map(c => c.element).join(' → ')
        : 'No clicks recorded';

    await sendDiscord({
        title: '👋 Visitor Left',
        color: 0xef4444,
        fields: [
            { name: 'Duration', value: body.duration || 'unknown', inline: true },
            { name: 'Pages Visited', value: String(body.pageCount || pages.length || 0), inline: true },
            { name: 'Path', value: pages.length ? pages.join(' → ') : 'unknown' },
            { name: 'Click Trail', value: clickTrail.slice(0, 1000) || 'None' }
        ],
        timestamp: new Date().toISOString()
    }, env);

    return jsonResponse({ ok: true, count: sessions.size });
});

router.post('/visitor-click', async (request) => {
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

    const session = sessions.get(body.sessionId);
    if (session) {
        session.lastSeen = Date.now();
        session.clicks.push({ page: body.page || '', element: body.element || '', t: Date.now() });
        if (session.clicks.length > 50) session.clicks.shift(); // cap memory per session
    }
    return jsonResponse({ ok: true });
});

router.get('/visitor-count', async () => {
    pruneStaleSessions();
    return jsonResponse({ count: sessions.size });
});

// ---------------- Admin trap alert ----------------

router.post('/admin-alert', async (request, env) => {
    let body;
    try { body = await request.json(); } catch (e) { body = {}; }

    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const { flag, name: countryName } = await getCountryInfo(ip);

    await sendDiscord({
        title: `${flag} 🚨 Admin Trap Triggered`,
        color: 0xff3333,
        description: 'Someone hit /admin-trap.html — logged below.',
        fields: [
            { name: 'Page', value: body.page || 'unknown' },
            { name: 'Country', value: countryName, inline: true },
            { name: 'Referrer', value: body.referrer || 'direct', inline: true },
            { name: 'Screen', value: body.screen || 'unknown', inline: true },
            { name: 'Language', value: body.language || 'unknown', inline: true },
            { name: 'Platform', value: body.platform || 'unknown', inline: true }
        ],
        timestamp: new Date().toISOString()
    }, env);

    return jsonResponse({ ok: true });
});

// ---------------- Announcements ----------------

router.post('/announce', async (request) => {
    if (!(await requireAdmin(request))) return jsonResponse({ error: 'Unauthorized' }, 401);
    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }
    if (!body.text || !String(body.text).trim()) return jsonResponse({ error: 'Missing text' }, 400);

    currentAnnouncement = { text: String(body.text).trim(), postedAt: Date.now() };
    return jsonResponse({ ok: true, announcement: currentAnnouncement });
});

router.post('/announce/dismiss', async (request) => {
    if (!(await requireAdmin(request))) return jsonResponse({ error: 'Unauthorized' }, 401);
    currentAnnouncement = null;
    return jsonResponse({ ok: true });
});

router.get('/announce', async () => {
    return jsonResponse({ announcement: currentAnnouncement });
});

// ---------------- Link preview (v3.5) ----------------

router.get('/preview', async (request, env, ctx, url) => {
    const target = url.searchParams.get('url');
    if (!target) return jsonResponse({ error: 'Missing url param' }, 400);
    try {
        const res = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
        const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || '';
        const img = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || '';
        return jsonResponse({ title, description: desc, image: img, url: target });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
});

// ---------------- Daily report (v3.5) ----------------

router.get('/daily-report', async () => {
    const report = {
        version: '3.5',
        date: new Date().toISOString(),
        features: ['Live Cursors', 'Screen Time', 'Quote Rotator', 'Weather', 'Uptime', 'Heatmap', 'Push Notifications', 'Boot Sequence', 'URL Shortener', 'AI Chat', 'Password Gen', 'Typing Test', 'QR Generator', 'Music Visualizer', 'Base64', 'JSON Formatter', 'Daily Challenge', '@mentions', 'Link Previews', 'Polls', 'Bot'],
        status: 'operational',
        activeSessions: sessions.size
    };
    return jsonResponse(report);
});

// ---------------- Steam proxy ----------------

router.get('/steam', async (request, env) => {
    const key = env.STEAM_API_KEY;
    const steamId = env.STEAM_ID || '76561198372730047';
    if (!key) return jsonResponse({ error: 'Missing STEAM_API_KEY' }, 500);

    try {
        const sumUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`;
        const recentUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}&count=1`;

        const [sumRes, recentRes] = await Promise.all([fetch(sumUrl), fetch(recentUrl)]);
        const sum = await sumRes.json();
        const recent = await recentRes.json();

        const player = sum?.response?.players?.[0] || {};
        const rg = recent?.response?.games?.[0];
        const recentStr = rg ? `${rg.name} (${Math.round((rg.playtime_forever || 0) / 60)} hrs)` : null;

        return jsonResponse({ player, recent: recentStr });
    } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
    }
});

// ---------------- Entry point ----------------

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const routed = await router.handle(request, env, ctx);
        if (routed) return routed;

        return jsonResponse({ error: 'Not found' }, 404);
    }
};
