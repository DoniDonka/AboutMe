/* DONI | DEV — Cloudflare Worker v3.4 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const router = {
    routes: [],
    get(path, handler) { this.routes.push({ method: 'GET', path, handler }); },
    post(path, handler) { this.routes.push({ method: 'POST', path, handler }); },
    async handle(request) {
        const url = new URL(request.url);
        const route = this.routes.find(r => r.method === request.method && r.path === url.pathname);
        if (route) return await route.handler(request);
        return null;
    }
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

        const routed = await router.handle(request);
        if (routed) return routed;

        return jsonResponse({ error: 'Not found' }, 404);
    }
};