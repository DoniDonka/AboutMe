/**
 * DONI | DEV - Enhancements (v3.2)
 * ------------------------------------------------------------------
 * A big batch of tasteful animations, QoL touches and secret easter
 * eggs that run on every page. Everything is guarded so a missing
 * element never throws, and all motion respects prefers-reduced-motion.
 */

const Enhancements = (() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none)').matches;
    const raf = window.requestAnimationFrame.bind(window);

    // ---------- 1. Scroll reveal (staggered) ----------
    function scrollReveal() {
        const cards = document.querySelectorAll('.bento-card, .timeline-item, .stat-card, .link-card, .skill-row');
        if (!cards.length || reduceMotion) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e, i) => {
                if (e.isIntersecting) {
                    e.target.style.transitionDelay = Math.min(i * 40, 240) + 'ms';
                    e.target.classList.add('reveal-in');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.08 });
        cards.forEach(c => { c.classList.add('reveal-init'); io.observe(c); });
    }

    // ---------- 2. 3D tilt on cards ----------
    function cardTilt() {
        if (reduceMotion || isTouch) return;
        document.querySelectorAll('.bento-card').forEach(card => {
            let rid = null;
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                if (rid) cancelAnimationFrame(rid);
                rid = raf(() => {
                    card.style.transform = `perspective(900px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg) translateZ(6px)`;
                    card.style.setProperty('--mx', (px * 100 + 50) + '%');
                    card.style.setProperty('--my', (py * 100 + 50) + '%');
                });
            });
            card.addEventListener('mouseleave', () => {
                if (rid) cancelAnimationFrame(rid);
                card.style.transform = '';
            });
        });
    }

    // ---------- 3. Cursor radial glow ----------
    function cursorGlow() {
        if (reduceMotion || isTouch) return;
        const glow = document.createElement('div');
        glow.className = 'cursor-glow';
        document.body.appendChild(glow);
        let rid = null;
        window.addEventListener('mousemove', (e) => {
            if (rid) return;
            rid = raf(() => {
                glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
                rid = null;
            });
        });
    }

    // ---------- 4. Count-up numbers ----------
    function countUp() {
        const targets = document.querySelectorAll('[data-countup]');
        if (!targets.length) return;
        const run = (el) => {
            const end = parseFloat(el.dataset.countup);
            if (isNaN(end)) return;
            const dur = 1100, t0 = performance.now();
            const suffix = el.dataset.suffix || '';
            const step = (t) => {
                const p = Math.min((t - t0) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = (Math.round(end * eased)).toLocaleString() + suffix;
                if (p < 1) raf(step);
            };
            raf(step);
        };
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: 0.5 });
        targets.forEach(t => io.observe(t));
    }

    // ---------- 5. Time-based greeting ----------
    function greeting() {
        if (sessionStorage.getItem('doni_greeted')) return;
        sessionStorage.setItem('doni_greeted', '1');
        const h = new Date().getHours();
        const msg = h < 5 ? 'Burning the midnight oil? 🌙'
            : h < 12 ? 'Good morning ☀️'
            : h < 18 ? 'Good afternoon 👋'
            : 'Good evening 🌆';
        setTimeout(() => { if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, 'info'); }, 900);
    }

    // ---------- 6. Network status toasts ----------
    function networkToasts() {
        window.addEventListener('offline', () => { if (typeof UI !== 'undefined') UI.toast('You are offline — cached content still works', 'error'); });
        window.addEventListener('online', () => { if (typeof UI !== 'undefined') UI.toast('Back online ✓', 'success'); });
    }

    // ---------- 7. Dynamic tab title when hidden ----------
    function dynamicTitle() {
        const original = document.title;
        document.addEventListener('visibilitychange', () => {
            document.title = document.hidden ? '👀 come back!' : original;
        });
    }

    // ---------- 8. Active nav link ----------
    function activeNav() {
        const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        document.querySelectorAll('nav a, .nav-links a').forEach(a => {
            const href = (a.getAttribute('href') || '').toLowerCase();
            if (href === here || (here === '' && href === 'index.html')) a.classList.add('nav-active');
        });
    }

    // ---------- 9. Ripple on buttons ----------
    function ripples() {
        if (reduceMotion) return;
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, .custom-btn, .snippet-btn');
            if (!btn) return;
            const r = btn.getBoundingClientRect();
            const span = document.createElement('span');
            span.className = 'ripple';
            const size = Math.max(r.width, r.height);
            span.style.width = span.style.height = size + 'px';
            span.style.left = (e.clientX - r.left - size / 2) + 'px';
            span.style.top = (e.clientY - r.top - size / 2) + 'px';
            const pos = getComputedStyle(btn).position;
            if (pos === 'static') btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.appendChild(span);
            setTimeout(() => span.remove(), 600);
        });
    }

    // ---------- 10. Smooth in-page anchors ----------
    function smoothAnchors() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href^="#"]');
            if (!a) return;
            const id = a.getAttribute('href').slice(1);
            const t = id && document.getElementById(id);
            if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }
        });
    }

    // ---------- 11. Parallax hero heading ----------
    function parallaxHero() {
        if (reduceMotion || isTouch) return;
        const hero = document.querySelector('.bento-card.span-2.row-span-2 h2');
        if (!hero) return;
        window.addEventListener('mousemove', (e) => {
            const dx = (e.clientX / window.innerWidth - 0.5) * 10;
            const dy = (e.clientY / window.innerHeight - 0.5) * 10;
            hero.style.transform = `translate(${dx}px, ${dy}px)`;
        });
    }

    // ---------- 12. Reading time on articles ----------
    function readingTime() {
        document.querySelectorAll('[data-reading-time]').forEach(el => {
            const words = (el.textContent || '').trim().split(/\s+/).length;
            const mins = Math.max(1, Math.round(words / 200));
            const badge = document.createElement('span');
            badge.className = 'reading-time';
            badge.textContent = `⏱ ${mins} min read`;
            el.prepend(badge);
        });
    }

    // ---------- 13. Rotating tagline / quote ----------
    const QUOTES = [
        'Building creative interfaces, one commit at a time.',
        'Racing sims by night, shipping code by day.',
        'Roblox worlds • Discord bots • web experiments.',
        'If it renders at 60fps, ship it. 🚀',
        'Ctrl+K to explore everything.'
    ];
    function quoteRotator() {
        const el = document.getElementById('tagline-rotator');
        if (!el) return;
        let i = 0;
        el.textContent = QUOTES[0];
        setInterval(() => {
            i = (i + 1) % QUOTES.length;
            el.style.opacity = '0';
            setTimeout(() => { el.textContent = QUOTES[i]; el.style.opacity = '1'; }, 300);
        }, 5000);
    }

    // ---------- 14. Confetti ----------
    function confetti(count = 120) {
        if (reduceMotion) return;
        const cv = document.createElement('canvas');
        cv.className = 'fx-canvas';
        document.body.appendChild(cv);
        const ctx = cv.getContext('2d');
        const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
        resize();
        const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899', '#06b6d4', '#eab308'];
        const parts = Array.from({ length: count }, () => ({
            x: innerWidth / 2, y: innerHeight / 3,
            vx: (Math.random() - 0.5) * 12, vy: Math.random() * -14 - 4,
            s: Math.random() * 6 + 4, c: colors[Math.floor(Math.random() * colors.length)],
            rot: Math.random() * 360, vr: (Math.random() - 0.5) * 20
        }));
        let frames = 0;
        const tick = () => {
            ctx.clearRect(0, 0, cv.width, cv.height);
            parts.forEach(p => {
                p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
                ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
            });
            if (++frames < 140) raf(tick); else cv.remove();
        };
        window.addEventListener('resize', resize, { once: true });
        raf(tick);
    }

    // ---------- 15. Matrix rain easter egg ----------
    let matrixOn = false;
    function matrixRain() {
        if (matrixOn) return;
        matrixOn = true;
        const cv = document.createElement('canvas');
        cv.className = 'fx-canvas matrix';
        document.body.appendChild(cv);
        const ctx = cv.getContext('2d');
        cv.width = innerWidth; cv.height = innerHeight;
        const cols = Math.floor(cv.width / 14);
        const drops = Array(cols).fill(1);
        const chars = 'アカサタナabcdef0123456789$#@'.split('');
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#22c55e';
        let run = true;
        const draw = () => {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.fillStyle = accent; ctx.font = '14px monospace';
            drops.forEach((y, i) => {
                ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 14, y * 14);
                if (y * 14 > cv.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            });
            if (run) raf(draw);
        };
        draw();
        const close = () => { run = false; matrixOn = false; cv.remove(); document.removeEventListener('keydown', onKey); cv.removeEventListener('click', close); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        cv.addEventListener('click', close);
        if (typeof UI !== 'undefined') UI.toast('Matrix mode — click or Esc to exit', 'info');
    }

    // ---------- 16. Credits overlay easter egg ----------
    function credits() {
        const ov = document.createElement('div');
        ov.className = 'credits-overlay';
        ov.innerHTML = `<div class="credits-scroll">
            <h2>DONI | DEV</h2>
            <p>Design &amp; Code — Doni</p>
            <p>Powered by vanilla JS + Firebase</p>
            <p>Hosted on GitHub Pages</p>
            <p>Racing line by Logitech G29 🏎️</p>
            <p>Thanks for visiting 💚</p>
            <small>click anywhere to close</small>
        </div>`;
        ov.addEventListener('click', () => ov.remove());
        document.body.appendChild(ov);
    }

    // ---------- 17. Typed keyword easter eggs ----------
    function keywordEggs() {
        let buf = '';
        const words = {
            matrix: matrixRain,
            party: () => confetti(180),
            credits: credits,
            rainbow: () => document.documentElement.classList.toggle('rainbow-mode')
        };
        window.addEventListener('keydown', (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            if (e.key.length === 1) buf = (buf + e.key.toLowerCase()).slice(-10);
            Object.keys(words).forEach(w => { if (buf.endsWith(w)) { buf = ''; words[w](); } });
        });
    }

    // ---------- 18. Keyboard shortcuts + help overlay ----------
    function shortcuts() {
        window.addEventListener('keydown', (e) => {
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === '?') { e.preventDefault(); toggleHelp(); return; }
            if (e.key === '/') { e.preventDefault(); if (typeof togglePalette === 'function') togglePalette(true); return; }
            // g + <key> navigation
            if (gPending) {
                const map = { h: 'index.html', p: 'projects.html', a: 'about.html', c: 'contact.html', b: 'blog.html', l: 'links.html', r: 'resume.html', u: 'uses.html', s: 'stats.html' };
                if (map[e.key]) location.href = map[e.key];
                gPending = false;
                return;
            }
            if (e.key === 'g') { gPending = true; setTimeout(() => gPending = false, 900); }
        });
    }
    let gPending = false;

    function toggleHelp() {
        let ov = document.getElementById('shortcut-help');
        if (ov) { ov.remove(); return; }
        ov = document.createElement('div');
        ov.id = 'shortcut-help';
        ov.className = 'shortcut-help';
        ov.innerHTML = `<div class="shortcut-card">
            <h3>Keyboard Shortcuts</h3>
            <div class="sc-grid">
                <kbd>Ctrl/⌘ K</kbd><span>Command palette</span>
                <kbd>/</kbd><span>Search / palette</span>
                <kbd>?</kbd><span>This help</span>
                <kbd>g</kbd> <kbd>h</kbd><span>Home</span>
                <kbd>g</kbd> <kbd>p</kbd><span>Projects</span>
                <kbd>g</kbd> <kbd>c</kbd><span>Contact</span>
                <kbd>g</kbd> <kbd>b</kbd><span>Blog</span>
                <kbd>Esc</kbd><span>Close overlays</span>
            </div>
            <p class="sc-hint">Psst — try typing <b>matrix</b>, <b>party</b>, <b>rainbow</b> or <b>credits</b> anywhere.</p>
        </div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } });
        document.body.appendChild(ov);
    }

    // ---------- 19. Footer logo secret (triple click) ----------
    function footerSecret() {
        const foot = document.querySelector('footer');
        if (!foot) return;
        let clicks = 0, timer = null;
        foot.addEventListener('click', () => {
            clicks++;
            clearTimeout(timer);
            timer = setTimeout(() => clicks = 0, 600);
            if (clicks >= 3) { clicks = 0; confetti(150); if (typeof UI !== 'undefined') UI.toast('You found a secret 🎉', 'success'); }
        });
    }

    function init() {
        scrollReveal();
        cardTilt();
        cursorGlow();
        countUp();
        greeting();
        networkToasts();
        dynamicTitle();
        activeNav();
        ripples();
        smoothAnchors();
        parallaxHero();
        readingTime();
        quoteRotator();
        keywordEggs();
        shortcuts();
        footerSecret();
    }

    return { init, confetti, matrixRain };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Enhancements.init);
} else {
    Enhancements.init();
}
