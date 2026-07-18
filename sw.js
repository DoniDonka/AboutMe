/**
 * DONI | DEV - Service Worker (PWA offline support)
 * Network-first for code (HTML/JS) so updates apply immediately when online,
 * cache-first for static assets, and Firebase/API traffic always hits the network.
 */

const CACHE_VERSION = 'doni-v3.2.1';
const APP_SHELL = [
    './',
    './index.html',
    './projects.html',
    './about.html',
    './contact.html',
    './links.html',
    './blog.html',
    './uses.html',
    './resume.html',
    './changelog.html',
    './guestbook.html',
    './stats.html',
    './404.html',
    './styles.css',
    './ui.js',
    './security.js',
    './features.js',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Never cache Firebase / cross-origin API traffic — always go to network.
    const bypass = url.origin !== self.location.origin ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic') ||
        url.hostname.includes('api.github.com');

    if (bypass) {
        event.respondWith(fetch(req).catch(() => caches.match(req)));
        return;
    }

    // Code (HTML navigations + JS): network-first so updates apply immediately
    // when online, falling back to cache offline. Avoids stale admin/security code.
    const isCode = req.mode === 'navigate' || url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.html');

    if (isCode) {
        event.respondWith(
            fetch(req).then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => caches.match(req))
        );
        return;
    }

    // Other same-origin assets (css/json/images): cache-first with background refresh.
    event.respondWith(
        caches.match(req).then(cached => {
            const network = fetch(req).then(res => {
                if (res && res.status === 200 && res.type === 'basic') {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
