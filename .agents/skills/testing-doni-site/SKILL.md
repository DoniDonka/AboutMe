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

## Golden-path test flow
1. Site lock: click 🔒 → overlay hides everything; wrong passcode → "Incorrect passcode."; `doni2024` → dashboard back + "Unlocked" toast.
2. Theme: ☀️ → light + toast; again → dark.
3. Palette: Ctrl/Cmd+K → type a page name → Enter navigates.
4. Admin: DONI logo → `doni2024` → 5 tabs (Content/Appearance/Tags/Guestbook/Messages); Messages loads Firestore; Appearance accent swatch recolors live.
5. PWA (shell): `curl -o /dev/null -w '%{http_code}' http://localhost:8099/{manifest.json,sw.js,icons/icon-192.png}` → all 200.

## Devin Secrets Needed
None. Firebase config is public client config embedded in the site; no secrets required for testing.
