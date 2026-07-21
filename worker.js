/* DONI | DEV — Cloudflare Worker v3.4 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
}

async function sendDiscord(embed, env) {
    await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
    });
}

async function getCountryFlag(ip) {
    try {
        const res = await fetch('https://ipapi.co/' + ip + '/json/');
        const data = await res.json();
        const code = data.country_code;
        if (!code) return '🌐';
        // Convert country code to flag emoji
        const base = 127397;
        return String.fromCodePoint(base + code.charCodeAt(0), base + code.charCodeAt(1));
    } catch (e) { return '🌐'; }
}

// In-memory storage
let visitorCount = 0;
const sessions = new Map(); // sessionId -> {start, pages, clicks, country}
let currentAnnouncement = null;



// v3.5: Link Preview Route
router.get('/preview', async (request) => {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return new Response(JSON.stringify({error:'Missing url param'}), {status:400, headers:{'Content-Type':'application/json'}});
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '';
        const desc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || '';
        const img = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] || '';
        return new Response(JSON.stringify({title, description:desc, image:img, url}), {headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
    } catch (e) {
        return new Response(JSON.stringify({error:e.message}), {status:500, headers:{'Content-Type':'application/json'}});
    }
});

// v3.5: Daily Report Route
router.get('/daily-report', async () => {
    const report = {
        version: '3.5',
        date: new Date().toISOString(),
        features: ['Live Cursors','Screen Time','Quote Rotator','Weather','Uptime','Heatmap','Push Notifications','Boot Sequence','URL Shortener','AI Chat','Password Gen','Typing Test','QR Generator','Music Visualizer','Base64','JSON Formatter','Daily Challenge','@mentions','Link Previews','Polls','Bot'],
        status: 'operational'
    };
    return new Response(JSON.stringify(report), {headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
});

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Steam proxy
        if (path === '/steam' && request.method === 'GET') {
            try {
                const [profileRes, gamesRes] = await Promise.all([
                    fetch('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=' + env.STEAM_API_KEY + '&steamids=' + env.STEAM_ID),
                    fetch('https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=' + env.STEAM_API_KEY + '&steamid=' + env.STEAM_ID + '&count=1')
                ]);
                const profileData = await profileRes.json();
                const gamesData = await gamesRes.json();
                const player = profileData.response?.players?.[0] || {};
                const recent = gamesData.response?.games?.[0] || null;
                return jsonResponse({
                    online: player.personastate > 0,
                    personaState: player.personastate,
                    gameextrainfo: player.gameextrainfo || null,
                    avatar: player.avatarfull,
                    name: player.personaname,
                    recentGame: recent ? { name: recent.name, playtime_2weeks: recent.playtime_2weeks, appid: recent.appid } : null
                });
            } catch (e) {
                return jsonResponse({ error: 'Steam API failed', detail: e.message }, 500);
            }
        }

        // Roblox proxy
        if (path === '/roblox' && request.method === 'GET') {
            try {
                const res = await fetch('https://users.roblox.com/v1/users/213240910');
                const data = await res.json();
                return jsonResponse({
                    name: data.name,
                    displayName: data.displayName,
                    description: data.description,
                    created: data.created,
                    isBanned: data.isBanned,
                    externalAppDisplayName: data.externalAppDisplayName,
                    hasVerifiedBadge: data.hasVerifiedBadge,
                    id: data.id
                });
            } catch (e) {
                return jsonResponse({ error: 'Roblox API failed', detail: e.message }, 500);
            }
        }

        // Visitor join
        if (path === '/visitor-join' && request.method === 'POST') {
            try {
                const data = await request.json();
                const flag = await getCountryFlag(clientIP);
                sessions.set(data.sessionId, {
                    start: Date.now(),
                    pages: data.pages || [],
                    clicks: [],
                    country: flag
                });
                visitorCount = sessions.size;
                const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                await sendDiscord({
                    title: flag + ' Visitor Joined',
                    description: 'Session `' + data.sessionId + '` started at **' + time + '**',
                    color: 0x00ff88,
                    fields: [
                        { name: '📄 Page', value: data.page || '/', inline: true },
                        { name: '🔗 Referrer', value: (data.referrer || 'direct').substring(0, 50), inline: true },
                        { name: '🖥️ Screen', value: data.screen || 'unknown', inline: true },
                        { name: '🌐 Language', value: data.language || 'unknown', inline: true },
                        { name: '💻 Platform', value: data.platform || 'unknown', inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }, env);
                return jsonResponse({ ok: true, count: visitorCount });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // Visitor leave
        if (path === '/visitor-leave' && request.method === 'POST') {
            try {
                const data = await request.json();
                const session = sessions.get(data.sessionId);
                const clickPath = session?.clicks?.join(' → ') || 'none';
                const flag = session?.country || '🌐';
                sessions.delete(data.sessionId);
                visitorCount = sessions.size;
                await sendDiscord({
                    title: flag + ' Visitor Left',
                    description: 'Session `' + data.sessionId + '` ended after **' + data.duration + '**',
                    color: 0xff5555,
                    fields: [
                        { name: '📑 Pages Viewed', value: (data.pages || []).join(', ') || 'none', inline: false },
                        { name: '🖱️ Click Path', value: clickPath.substring(0, 1000), inline: false },
                        { name: '#️⃣ Page Count', value: String(data.pageCount || 0), inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }, env);
                return jsonResponse({ ok: true, count: visitorCount });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // Visitor click tracking (for session replay)
        if (path === '/visitor-click' && request.method === 'POST') {
            try {
                const data = await request.json();
                const session = sessions.get(data.sessionId);
                if (session) {
                    session.clicks.push(data.page + ':' + data.element);
                }
                return jsonResponse({ ok: true });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // Visitor count
        if (path === '/visitor-count' && request.method === 'GET') {
            return jsonResponse({ count: visitorCount });
        }

        // Admin trap alert
        if (path === '/admin-alert' && request.method === 'POST') {
            try {
                const data = await request.json();
                await sendDiscord({
                    title: '🚨 Admin Trap Triggered',
                    description: 'Someone accessed the decoy admin page!',
                    color: 0xff0000,
                    fields: [
                        { name: '📄 Page', value: data.page || 'unknown', inline: true },
                        { name: '🖥️ Screen', value: data.screen || 'unknown', inline: true },
                        { name: '🌐 Language', value: data.language || 'unknown', inline: true },
                        { name: '💻 Platform', value: data.platform || 'unknown', inline: true },
                        { name: '🔗 Referrer', value: (data.referrer || 'none').substring(0, 100), inline: false }
                    ],
                    timestamp: new Date().toISOString()
                }, env);
                return jsonResponse({ ok: true });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // Discord bot endpoint — post announcement
        if (path === '/announce' && request.method === 'POST') {
            try {
                const data = await request.json();
                const auth = request.headers.get('Authorization');
                if (auth !== 'Bearer ' + env.ADMIN_SECRET) {
                    return jsonResponse({ error: 'Unauthorized' }, 401);
                }
                currentAnnouncement = {
                    text: data.text,
                    timestamp: Date.now(),
                    id: Math.random().toString(36).slice(2, 10)
                };
                return jsonResponse({ ok: true, announcement: currentAnnouncement });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // Get current announcement
        if (path === '/announce' && request.method === 'GET') {
            return jsonResponse({ announcement: currentAnnouncement });
        }

        // Dismiss announcement
        if (path === '/announce/dismiss' && request.method === 'POST') {
            currentAnnouncement = null;
            return jsonResponse({ ok: true });
        }

        return jsonResponse({ error: 'Not found' }, 404);
    }
};
