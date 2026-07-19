/* DONI | DEV — Cloudflare Worker v3.3 */
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

// Simple in-memory visitor counter (resets on worker deploy)
let visitorCount = 0;
const sessions = new Set();

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // Handle ALL CORS preflight requests
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

        // Visitor join
        if (path === '/visitor-join' && request.method === 'POST') {
            try {
                const data = await request.json();
                sessions.add(data.sessionId);
                visitorCount = sessions.size;
                const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                await sendDiscord({
                    title: '👤 Visitor Joined',
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
                sessions.delete(data.sessionId);
                visitorCount = sessions.size;
                await sendDiscord({
                    title: '🚪 Visitor Left',
                    description: 'Session `' + data.sessionId + '` ended after **' + data.duration + '**',
                    color: 0xff5555,
                    fields: [
                        { name: '📑 Pages Viewed', value: (data.pages || []).join(', ') || 'none', inline: false },
                        { name: '#️⃣ Page Count', value: String(data.pageCount || 0), inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }, env);
                return jsonResponse({ ok: true, count: visitorCount });
            } catch (e) {
                return jsonResponse({ error: e.message }, 500);
            }
        }

        // Visitor count
        if (path === '/visitor-count' && request.method === 'GET') {
            return jsonResponse({ count: visitorCount, note: 'In-memory counter (resets on deploy)' });
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

        return jsonResponse({ error: 'Not found' }, 404);
    }
};
