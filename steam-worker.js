/**
 * Cloudflare Worker — Steam proxy for the DONI | DEV site.
 * ------------------------------------------------------------------
 * Keeps your secret Steam Web API key OFF the public site. Deploy this
 * to a free Cloudflare Worker, then set WIDGET_CONFIG.steamProxy in
 * widgets.js to the worker URL (e.g. https://doni-steam.<you>.workers.dev).
 *
 * Setup:
 *   1) https://steamcommunity.com/dev/apikey  → copy your API key
 *   2) https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   3) Paste this file, then Settings → Variables → add:
 *        STEAM_API_KEY = <your key>   (encrypt it)
 *        STEAM_ID      = 76561198372730047
 *   4) Deploy, copy the URL, paste it into widgets.js steamProxy.
 *
 * Returns JSON: { player: {...}, recent: "Game (h hrs)" }
 */

export default {
    async fetch(request, env) {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Cache-Control': 'public, max-age=60'
        };
        if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

        const key = env.STEAM_API_KEY;
        const steamId = env.STEAM_ID;
        if (!key || !steamId) {
            return new Response(JSON.stringify({ error: 'Missing STEAM_API_KEY or STEAM_ID' }),
                { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }

        try {
            const sumUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`;
            const recentUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${steamId}&count=1`;

            const [sumRes, recentRes] = await Promise.all([fetch(sumUrl), fetch(recentUrl)]);
            const sum = await sumRes.json();
            const recent = await recentRes.json();

            const player = sum?.response?.players?.[0] || {};
            const rg = recent?.response?.games?.[0];
            const recentStr = rg ? `${rg.name} (${Math.round((rg.playtime_forever || 0) / 60)} hrs)` : null;

            return new Response(JSON.stringify({ player, recent: recentStr }),
                { headers: { ...cors, 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ error: String(e) }),
                { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
    }
};
