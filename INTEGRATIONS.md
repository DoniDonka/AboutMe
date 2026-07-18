# Widget Integrations — setup guide

All live widgets live in `widgets.js` (config block at the top: `WIDGET_CONFIG`).
Because this site is **static GitHub Pages**, any value in that file is public.
Public IDs are fine there; **secret keys must go through a proxy** (see Steam).

Current status:

| Widget | Status | What it needs |
|---|---|---|
| Discord | ⏳ Needs action | Join **discord.gg/lanyard** with the account for ID `329997541523587073` |
| GitHub | ✅ Live | Nothing (public API, `DoniDonka`) |
| Roblox | ✅ Live | Nothing (profile card for user `213240910`) |
| Tech Stack / Hardware | ✅ Live | Nothing (static) |
| Last.fm (Now Playing) | ⏳ Needs key | A free API key from your Last.fm account |
| Steam | ⏳ Needs proxy | Steam API key + free Cloudflare Worker |

---

## Discord (Lanyard) — free, no key
Lanyard only reports your presence if you're in its Discord server.
1. Open **https://discord.gg/lanyard** and join (use the account for ID `329997541523587073`).
2. Done — the card goes live automatically.

## Last.fm (Now Playing) — free key, 1 minute
You already have a Last.fm account (`DoniDonka`), so make the key from it:
1. Log in at https://www.last.fm, then open **https://www.last.fm/api/account/create**.
2. Fill in any app name (e.g. "doni-site"), submit.
3. Copy the **API key** (the 32-char string).
4. In `widgets.js` set:
   ```js
   lastfmApiKey: 'PASTE_KEY_HERE',
   ```
   (`lastfmUser: 'DoniDonka'` is already set.) A read-only Last.fm key is safe to ship.

## Steam — needs a proxy (secret key can't ship publicly)
Deploy the included `steam-worker.js` to a free Cloudflare Worker:
1. Get your key: https://steamcommunity.com/dev/apikey
2. https://dash.cloudflare.com → **Workers & Pages** → **Create Worker**.
3. Paste the contents of `steam-worker.js`.
4. Worker **Settings → Variables**, add (encrypt the key):
   - `STEAM_API_KEY` = your key
   - `STEAM_ID` = `76561198372730047`
5. **Deploy**, copy the worker URL.
6. In `widgets.js` set:
   ```js
   steamProxy: 'https://your-worker.workers.dev',
   ```

---

## Admin power-ups (already live)
In the admin panel → **Live** tab (sign in first):
- **Live Traffic** — online-now (presence) + total views.
- **Availability / Status Override** — sets the header badge for everyone.
- **Quick-Post** — publishes a markdown note to the "Latest Updates" card.
- **Feature Toggles** — show/hide any widget card site-wide.

These write to Firestore `dashboard/settings` (admin-only per `firestore.rules`).
The presence counter uses a `presence` collection — make sure the updated
`firestore.rules` (which includes it) is published.
