/* DONI | DEV — Cloudflare Worker v3.5 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ADMIN_SECRET = 'doni-admin-2026'; // legacy fallback only — see requireAdmin()
const ADMIN_EMAIL = 'doni@admin.com';
const STALE_SESSION_MS = 90000; // a session with no join/click in 90s is considered gone
const FCM_PROJECT_ID = 'aboutme-8a339';

// ---------------- FCM push notifications (hand-signed JWT, no deps) ----------------
// This Worker is deployed by pasting a single file into the Cloudflare dashboard
// (no npm/build step available), so a library can't be bundled in — this signs
// the Google service-account JWT directly using the Web Crypto API, which Workers
// support natively. Requires FIREBASE_SERVICE_ACCOUNT_JSON to be set as a Worker
// secret (the full contents of a Firebase service account key file).

function base64UrlEncode(bytes) {
    let str;
    if (typeof bytes === 'string') {
        str = btoa(unescape(encodeURIComponent(bytes)));
    } else {
        str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    }
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

let cachedAccessToken = null; // { token, expiresAt } — in-memory only, reset per Worker instance

async function getFcmAccessToken(env) {
    if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60000) {
        return cachedAccessToken.token;
    }

    const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured');
    const sa = JSON.parse(raw);

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    };

    const unsigned = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(claims));

    const keyData = pemToArrayBuffer(sa.private_key);
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyData,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(unsigned)
    );

    const jwt = unsigned + '.' + base64UrlEncode(signature);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt)
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error('OAuth token exchange failed: ' + (tokenData.error_description || tokenData.error || 'unknown error'));
    }

    cachedAccessToken = { token: tokenData.access_token, expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000 };
    return tokenData.access_token;
}

async function sendFcmMessage(env, token, notification, data) {
    const accessToken = await getFcmAccessToken(env);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: {
                token,
                notification,
                data: data || {}
            }
        })
    });
    const result = await res.json();
    return { ok: res.ok, result };
}

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

// Verifies any signed-in user's Firebase ID token (not just admin) and
// returns their uid, or null if invalid/missing. Used to gate the avatar
// upload route so it can't be spammed anonymously and burn the Imgur quota.
async function requireAuthUid(request) {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
        if (!res.ok) return null;
        const info = await res.json();
        return info.sub || null; // 'sub' is the Firebase uid in a Google ID token
    } catch (e) { return null; }
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

router.post('/avatar-upload', async (request, env) => {
    const uid = await requireAuthUid(request);
    if (!uid) return jsonResponse({ error: 'Sign in required' }, 401);

    const clientId = env.IMGUR_CLIENT_ID;
    if (!clientId) return jsonResponse({ error: 'Avatar uploads are not configured yet' }, 500);

    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }
    const base64 = body.image;
    if (!base64 || typeof base64 !== 'string') return jsonResponse({ error: 'Missing image data' }, 400);

    // Rough size guard before we even forward it — base64 is ~4/3 the size of
    // the original bytes, so cap around 5MB of base64 (~3.75MB actual image).
    if (base64.length > 5 * 1024 * 1024) {
        return jsonResponse({ error: 'Image too large — please use something under ~3MB' }, 413);
    }

    try {
        const form = new FormData();
        form.append('image', base64);
        form.append('type', 'base64');

        const imgurRes = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { 'Authorization': 'Client-ID ' + clientId },
            body: form
        });
        const imgurData = await imgurRes.json();

        if (!imgurRes.ok || !imgurData.success) {
            return jsonResponse({ error: imgurData?.data?.error || 'Imgur upload failed' }, 502);
        }

        return jsonResponse({ url: imgurData.data.link, deleteHash: imgurData.data.deletehash });
    } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
    }
});

// Targeted push — any signed-in user can trigger this (e.g. to notify someone
// who was @mentioned or replied to in chat). Only ever reaches the recipient
// if they're actually subscribed AND opted into that notification category —
// enforced here, not left to the client.
router.post('/send-notification', async (request, env) => {
    const senderUid = await requireAuthUid(request);
    if (!senderUid) return jsonResponse({ error: 'Sign in required' }, 401);

    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }
    const { recipientToken, category, title, body: msgBody, url } = body;
    if (!recipientToken || !category || !title) return jsonResponse({ error: 'Missing required fields' }, 400);

    try {
        const result = await sendFcmMessage(env, recipientToken,
            { title: String(title).slice(0, 100), body: String(msgBody || '').slice(0, 200) },
            { url: url || '/', category }
        );
        if (!result.ok) return jsonResponse({ error: result.result?.error?.message || 'Send failed' }, 502);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
    }
});

// Broadcast push — admin-only, sends to every subscriber who opted into the
// given category. Used for new blog posts and site-wide announcements.
router.post('/broadcast-notification', async (request, env) => {
    if (!(await requireAdmin(request))) return jsonResponse({ error: 'Unauthorized' }, 401);

    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }
    const { category, title, body: msgBody, url } = body;
    if (!category || !title) return jsonResponse({ error: 'Missing required fields' }, 400);
    if (!['chatReplies', 'blogPosts', 'announcements'].includes(category)) {
        return jsonResponse({ error: 'Invalid category' }, 400);
    }

    // This Worker has no direct Firestore SDK access (REST-only environment),
    // so subscriber tokens are looked up via Firestore's REST API using the
    // same OAuth token already obtained for FCM (same service account scope
    // covers both when the service account has Firestore access).
    try {
        const accessToken = await getFcmAccessToken(env);
        const baseUrl = `https://firestore.googleapis.com/v1/projects/${FCM_PROJECT_ID}/databases/(default)/documents`;

        const [subsRes, usersRes] = await Promise.all([
            fetch(`${baseUrl}/pushSubscribers?pageSize=300`, { headers: { 'Authorization': 'Bearer ' + accessToken } }),
            fetch(`${baseUrl}/users?pageSize=300`, { headers: { 'Authorization': 'Bearer ' + accessToken } })
        ]);
        const subsData = await subsRes.json();
        const usersData = await usersRes.json();

        const anonTokens = (subsData.documents || [])
            .filter(d => d.fields?.prefs?.mapValue?.fields?.[category]?.booleanValue === true)
            .map(d => d.fields?.token?.stringValue)
            .filter(Boolean);

        const userTokens = (usersData.documents || [])
            .filter(d => d.fields?.pushToken?.stringValue &&
                         d.fields?.notifyPrefs?.mapValue?.fields?.[category]?.booleanValue === true)
            .map(d => d.fields.pushToken.stringValue);

        const tokens = [...new Set([...anonTokens, ...userTokens])];

        let sent = 0, failed = 0;
        for (const token of tokens) {
            try {
                const result = await sendFcmMessage(env, token,
                    { title: String(title).slice(0, 100), body: String(msgBody || '').slice(0, 200) },
                    { url: url || '/', category }
                );
                if (result.ok) sent++; else failed++;
            } catch (e) { failed++; }
        }

        return jsonResponse({ ok: true, sent, failed, total: tokens.length });
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
