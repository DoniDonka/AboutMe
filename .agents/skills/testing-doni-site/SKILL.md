---
name: testing-doni-site
description: Test the DONI static personal site (v3+) end-to-end — site lock, themes, command palette, admin panel, PWA, Firebase. Use when verifying UI or Firebase changes to this repo.
---

# Testing the DONI site

Static site (no build step, no package.json). Deployed to GitHub Pages under `donidonka.github.io/AboutMe`. Uses Firebase compat SDK against project `aboutme-8a339` with graceful localStorage fallback.

## Run it locally
```bash
cd <repo> && python3 -m http.server 8099
# open http://localhost:8099/index.html
```
- Service workers only register over http(s), never `file://`. Test PWA over the local http server.
- Firebase connects fine from `localhost` (it's in the authorized domains), so Firestore-backed features (admin Messages tab, guestbook, analytics) are testable locally against real data. Be careful: deletes in the admin Messages/Guestbook tabs hit real data.

## Passcode / admin
- Admin gate: click the **DONI logo** in the header (or `admin` in the palette) → enter passcode `doni2024`.
- Full-screen **site lock**: header 🔒 button, or Appearance tab → "Lock Entire Site", or `lockscreen` command. Same passcode. Persists via `localStorage['doni_site_locked']` and re-shows on reload.
- Client-side deterrence only — not real security. Don't claim otherwise.

## Header controls (injected by ui.js, left→right)
☀️/🌙 theme toggle · 🎨 accent menu · 🔇 sound · 🔒 site lock · ⬇ PWA install.

## Gotchas learned
- `security.js` / `ui.js` expose `Security` and `UI` as **lexical `const` globals, not `window.*`**. Cross-module calls must use `typeof X !== 'undefined'`, not `window.X` (a `window.UI`/`window.Security` check silently no-ops — this broke the lock button once).
- HTML files use **CRLF** line endings. If a script rewrites them with LF you get huge noise diffs; restore CRLF before committing.
- `firestore.rules` in the repo defaults `messages` to create-only (not publicly readable) to protect contact submissions. The admin **Messages tab only loads if the live rules allow reads** — the current live project still allows public reads. Applying the repo rules without Firebase Auth will disable that tab. Flag this tradeoff to the user rather than assuming.

## Quick reset for a clean recording
Clear `localStorage` keys `doni_theme`, `doni_accent`, `doni_site_locked` (or just reload after unlocking + setting dark) so recording starts dark/unlocked. Maximize window first: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

## v3.2 widgets + enhancements (homepage)
Live cards are rendered by `widgets.js`; global effects by `enhancements.js`. All degrade gracefully when a key/ID is missing (show a `.widget-hint`, never throw).
- **Discord** uses the public Lanyard API. It only returns data if that Discord account has joined **discord.gg/lanyard** — otherwise `api.lanyard.rest/v1/users/<id>` returns `user_not_monitored` and the card shows "unavailable". Verify liveness from shell first: `curl -s https://api.lanyard.rest/v1/users/<id>`. Status→border color: online green / idle orange / dnd red.
- **GitHub** is the public API (unauthenticated, ~60 req/hr per IP). If you hit the rate limit the card shows a hint — test from a fresh IP or wait.
- **Roblox** is a profile card only (avatar thumbnail may fail silently via `onerror`; the @name + profile link are the reliable assertions).
- **Steam** needs the `steam-worker.js` Cloudflare Worker (secret `STEAM_API_KEY`); **Last.fm** needs `lastfmApiKey`. Both show config hints until set — that's expected, not a failure. See `INTEGRATIONS.md`.
- **Enhancements to spot-check:** press `?` (shortcuts overlay), `/` (palette), and type `matrix` / `party` / `rainbow` / `credits` anywhere (not focused in an input) for easter eggs; Esc/click closes them. Tech Stack tiles reveal a proficiency pill on hover.
- **Admin "Live" tab** (traffic/status/quick-post/toggles) + the presence "online now" counter require Firebase Email/Password auth to be enabled + the admin user created. Until the owner does that, these are **untestable** — mark untested, don't claim pass.
- Count-up (`[data-countup]`) currently has no live targets on the homepage; don't assert it unless an element uses that attribute.

## Golden-path test flow
1. Site lock: click 🔒 → overlay hides everything; wrong passcode → "Incorrect passcode."; `doni2024` → dashboard back + "Unlocked" toast.
2. Theme: ☀️ → light + toast; again → dark.
3. Palette: Ctrl/Cmd+K → type a page name → Enter navigates.
4. Admin: DONI logo → `doni2024` → 5 tabs (Content/Appearance/Tags/Guestbook/Messages); Messages loads Firestore; Appearance accent swatch recolors live.
5. PWA (shell): `curl -o /dev/null -w '%{http_code}' http://localhost:8099/{manifest.json,sw.js,icons/icon-192.png}` → all 200.

## Devin Secrets Needed
None. Firebase config is public client config embedded in the site; no secrets required for testing.
