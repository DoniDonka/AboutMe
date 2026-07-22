/**
 * DONI | DEV — v3.5 Extensions
 * Live cursors, screen time, quotes, weather, uptime, heatmap,
 * push notifications, boot sequence, URL shortener, new commands.
 */
(function() {
    const db = (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null;

    // ---------- 1. Fake Boot Sequence ----------
    function bootSequence() {
        if (sessionStorage.getItem('doni_booted') === '1') return;
        sessionStorage.setItem('doni_booted', '1');
        const overlay = document.createElement('div');
        overlay.id = 'boot-overlay';
        overlay.innerHTML = `<div id="boot-term"></div>`;
        document.body.appendChild(overlay);
        const term = document.getElementById('boot-term');
        const lines = [
            'BIOS Date: 07/21/26 01:38:00',
            'CPU: DONI-Core v3.5 @ 5.2GHz',
            'Memory Test: 65536K OK',
            'Booting from Primary SSD...',
            'Loading kernel modules...',
            '[ OK ] Firebase sync module',
            '[ OK ] Real-time presence engine',
            '[ OK ] Command palette router',
            '[ OK ] Widget integration layer',
            '[ OK ] Security layer (SHA-256)',
            'Mounting file systems...',
            'Starting network telemetry...',
            'System ready.',
            'Welcome back, Doni.'
        ];
        let i = 0;
        function typeLine() {
            if (i >= lines.length) {
                setTimeout(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 500); }, 400);
                return;
            }
            const div = document.createElement('div');
            div.textContent = lines[i];
            term.appendChild(div);
            term.scrollTop = term.scrollHeight;
            i++;
            setTimeout(typeLine, 80 + Math.random() * 120);
        }
        typeLine();
    }

    // ---------- 2. Quote Rotator ----------
    const QUOTES = [
        "Code is like humor. When you have to explain it, it's bad.",
        "First, solve the problem. Then, write the code.",
        "Simplicity is the soul of efficiency.",
        "Make it work, make it right, make it fast.",
        "The only way to do great work is to love what you do.",
        "Talk is cheap. Show me the code.",
        "Stay hungry, stay foolish.",
        "It works on my machine."
    ];
    function initQuoteRotator() {
        const el = document.getElementById('quote-rotator');
        if (!el) return;
        const textEl = el.querySelector('div');
        let idx = Math.floor(Math.random() * QUOTES.length);
        textEl.textContent = '"' + QUOTES[idx] + '"';
        setInterval(() => {
            idx = (idx + 1) % QUOTES.length;
            textEl.style.opacity = '0';
            setTimeout(() => { textEl.textContent = '"' + QUOTES[idx] + '"'; textEl.style.opacity = '1'; }, 300);
        }, 30000);
    }

    // ---------- 3. Screen Time Tracker ----------
    function initScreenTime() {
        const el = document.getElementById('screen-time');
        if (!el) return;
        const start = Date.now();
        function tick() {
            const diff = Date.now() - start;
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            el.innerHTML = `<strong>${m}m ${s}s</strong><div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">on site today</div>`;
        }
        tick();
        setInterval(tick, 1000);
    }

    // ---------- 4. Weather Widget ----------
    function initWeather() {
        const container = document.getElementById('weather-widget');
        if (!container) return;
        const btn = document.getElementById('weather-consent-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (!navigator.geolocation) { container.innerHTML = '<div style="text-align:center;padding:16px;color:#ef4444;">Geolocation not supported</div>'; return; }
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const { latitude, longitude } = pos.coords;
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                    const data = await res.json();
                    const w = data.current_weather;
                    const codes = {0:'☀️ Clear',1:'🌤️ Mainly clear',2:'⛅ Partly cloudy',3:'☁️ Overcast',45:'🌫️ Fog',48:'🌫️ Fog',51:'🌧️ Drizzle',53:'🌧️ Drizzle',55:'🌧️ Drizzle',61:'🌧️ Rain',63:'🌧️ Rain',65:'🌧️ Rain',71:'❄️ Snow',73:'❄️ Snow',75:'❄️ Snow',95:'⛈️ Thunderstorm'};
                    container.innerHTML = `<div style="text-align:center;padding:12px;"><div style="font-size:2rem;margin-bottom:6px;">${codes[w.weathercode] || '🌡️'}</div><div style="font-size:1.4rem;font-weight:700;">${w.temperature}°C</div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Wind: ${w.windspeed} km/h</div></div>`;
                } catch (e) { container.innerHTML = '<div style="text-align:center;padding:16px;color:#ef4444;">Weather unavailable</div>'; }
            }, () => { container.innerHTML = '<div style="text-align:center;padding:16px;color:#ef4444;">Location denied</div>'; });
        });
    }

    // ---------- 5. System Uptime ----------
    function initUptime() {
        const el = document.getElementById('system-uptime');
        if (!el) return;
        const deployTime = new Date('2026-07-21T01:00:00Z');
        function tick() {
            const diff = Date.now() - deployTime.getTime();
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            el.innerHTML = `<strong>${h}h ${m}m ${s}s</strong><div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">since last deploy</div>`;
        }
        tick();
        setInterval(tick, 1000);
    }

    // ---------- 6. Click Heatmap ----------
    function initHeatmap() {
        if (localStorage.getItem('doni_heatmap') !== '1') return;
        const canvas = document.createElement('canvas');
        canvas.id = 'click-heatmap';
        canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;opacity:0.4;';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
        resize();
        window.addEventListener('resize', resize);
        document.addEventListener('click', (e) => {
            const g = ctx.createRadialGradient(e.clientX, e.clientY, 0, e.clientX, e.clientY, 30);
            g.addColorStop(0, 'rgba(255,50,50,0.6)'); g.addColorStop(1, 'rgba(255,50,50,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.clientX, e.clientY, 30, 0, Math.PI*2); ctx.fill();
        });
    }

    // ---------- 8. Live Cursors (simulated multi-user feel) ----------
    function initLiveCursors() {
        const cursors = [];
        const names = ['Alex','Sam','Jordan','Taylor'];
        const colors = ['#ef4444','#3b82f6','#a855f7','#f97316'];
        for (let i = 0; i < 2; i++) {
            const el = document.createElement('div');
            el.className = 'live-cursor';
            el.style.cssText = `position:fixed;z-index:99998;pointer-events:none;transition:transform 0.8s ease;transform:translate(-100px,-100px);`;
            el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${colors[i]}"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg><span style="background:${colors[i]};color:#000;font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:4px;white-space:nowrap;">${names[i]}</span>`;
            document.body.appendChild(el);
            cursors.push({ el, x: Math.random()*innerWidth, y: Math.random()*innerHeight, tx: Math.random()*innerWidth, ty: Math.random()*innerHeight });
        }
        function move() {
            cursors.forEach(c => {
                if (Math.random() < 0.02) { c.tx = Math.random()*innerWidth; c.ty = Math.random()*innerHeight; }
                c.x += (c.tx - c.x) * 0.02; c.y += (c.ty - c.y) * 0.02;
                c.el.style.transform = `translate(${c.x}px, ${c.y}px)`;
            });
            requestAnimationFrame(move);
        }
        move();
    }

    // ---------- 9. URL Shortener (/short command integration) ----------
    window.shortenUrl = async function(url) {
        try {
            const res = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url));
            const short = await res.text();
            return short || url;
        } catch (e) { return url; }
    };

    // ---------- 10. New Commands ----------
    if (typeof Core !== 'undefined' && Core.Commands) {
        Object.assign(Core.Commands.list, {
            'tools': 'Navigate to the Developer Tools page.',
            'heatmap': 'Toggle click heatmap visualization.',
            'notify': 'Enable push notifications.',
            'uptime': 'Show system uptime since last deploy.',
            'weather': 'Show weather widget (if on dashboard).',
            'screen': 'Show screen time tracker.',
            'short': 'Shorten a URL (usage: short <url>).',
            'boot': 'Replay the boot sequence.',
            'quote': 'Show a random quote.',
            'daily': 'Navigate to Daily Challenge.'
        });
        const orig = Core.Commands.execute;
        Core.Commands.execute = function(inputStr) {
            const t = inputStr.trim().toLowerCase();
            if (t === 'tools') { window.location.href = 'tools.html'; return; }
            if (t === 'heatmap') { localStorage.setItem('doni_heatmap', localStorage.getItem('doni_heatmap')==='1'?'0':'1'); location.reload(); return; }
            if (t === 'notify') { const btn=document.getElementById('push-notify-btn'); if(btn && !btn.disabled){btn.click();} else if(typeof UI!=='undefined'){UI.toast('Notifications not supported in this browser','info');} return; }
            if (t === 'uptime') { const d=Date.now()-new Date('2026-07-21T01:00:00Z').getTime(); const h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000); Core.SystemLogs.write(`Uptime: ${h}h ${m}m ${s}s`); return; }
            if (t === 'weather') { Core.SystemLogs.write('Weather widget is on the dashboard.'); return; }
            if (t === 'screen') { Core.SystemLogs.write('Screen time widget is on the dashboard.'); return; }
            if (t === 'boot') { sessionStorage.removeItem('doni_booted'); bootSequence(); return; }
            if (t === 'quote') { const q=QUOTES[Math.floor(Math.random()*QUOTES.length)]; Core.SystemLogs.write(`"${q}"`); return; }
            if (t === 'daily') { window.location.href = 'tools.html#daily'; return; }
            if (t.startsWith('short ')) { const url=t.slice(6).trim(); if(!url){Core.SystemLogs.write('Usage: short <url>');return;} window.shortenUrl(url).then(s=>{navigator.clipboard.writeText(s);Core.SystemLogs.write(`Shortened: ${s}`);if(typeof UI!=='undefined')UI.toast('URL copied!','success');}); return; }
            orig.call(this, inputStr);
        };
    }

    // ---------- Init ----------
    document.addEventListener('DOMContentLoaded', () => {
        const run = (fn, label) => { try { fn(); } catch (e) { console.error('[app-v35]', label || fn.name, e); } };
        run(bootSequence, 'bootSequence');
        run(initQuoteRotator, 'initQuoteRotator');
        run(initScreenTime, 'initScreenTime');
        run(initWeather, 'initWeather');
        run(initUptime, 'initUptime');
        run(initHeatmap, 'initHeatmap');
        run(initLiveCursors, 'initLiveCursors');
    });
})();
