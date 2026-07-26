/**
 * DONI | DEV — Commands v2 (fun, useful, hidden)
 * Adds a big batch of new command-palette commands on top of the existing
 * system in app.js / app-v35.js, following the same chain-override pattern
 * so nothing already working gets replaced or broken.
 */
(function () {
    if (typeof Core === 'undefined' || !Core.Commands) return;

    // ---------- Fun / joke commands ----------
    const JOKES = [
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "There are 10 types of people: those who understand binary and those who don't.",
        "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
        "!false — it's funny because it's true.",
        "It's not a bug, it's an undocumented feature.",
        "I would tell you a UDP joke, but you might not get it.",
        "Why did the developer go broke? Because he used up all his cache.",
        "To understand recursion, you must first understand recursion.",
        "99 little bugs in the code, 99 little bugs. Take one down, patch it around — 127 little bugs in the code."
    ];

    const ASCII_ART = {
        cat: `
 /\\_/\\
( o.o )
 > ^ <`,
        rocket: `
    /\\
   /  \\
  |    |
  |    |
 /|    |\\
/_|____|_\\
   |  |
   |  |
  /____\\`,
        skull: `
  .-""""""-.
 /          \\
|            |
|  X      X  |
|            |
 \\  \\____/  /
  '-.____.-'`
    };

    function typeSudo() {
        Core.SystemLogs.write('Nice try. This is a static GitHub Pages site — there is no server to sudo into. 😄');
    }

    // ---------- Hidden state for hidden commands ----------
    let idleTimer = null;
    let konamiHintShown = false;

    function resetIdle() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (!konamiHintShown && Math.random() < 0.3) {
                konamiHintShown = true;
                Core.SystemLogs.write('<span style="color:var(--text-muted);font-size:0.85em;">…is anyone still here? Try the Konami code sometime. ↑↑↓↓←→←→BA</span>');
            }
        }, 90000); // 90s idle
    }
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt =>
        window.addEventListener(evt, resetIdle, { passive: true })
    );
    resetIdle();

    // ---------- New command list ----------
    Object.assign(Core.Commands.list, {
        // Fun / joke
        'joke': 'Tell a programmer joke.',
        'sudo': 'Try to gain root access. (spoiler: no)',
        'ascii': 'Show ASCII art (usage: ascii cat|rocket|skull).',
        'flip': 'Flip a coin.',
        'roll': 'Roll a dice (usage: roll or roll <sides>).',
        '8ball': 'Ask the magic 8-ball a question.',
        'hack': 'Simulate hacking the mainframe (for fun).',
        'coffee': 'Brew virtual coffee. ☕',
        // Useful
        'calc': 'Quick calculator (usage: calc 2+2*3).',
        'convert': 'Unit converter (usage: convert 10 km to mi).',
        'whoami': 'Show your session info.',
        'ip': 'Show what the site can see about your connection.',
        'clock': 'Show a live clock in the log.',
        'countdown': 'Countdown timer (usage: countdown 10).',
        'define': 'Quick dictionary lookup (usage: define <word>).',
        'stopwatch': 'Start/stop a simple stopwatch.',
        // Meta / hidden-ish
        'version': 'Show the current site version and build info.',
        'uptime-me': 'Show how long YOU have been on this session.',
        'cls': 'Alias for clear.',
        'exit': 'Attempt to close the command palette (and the universe).'
    });

    let stopwatchStart = null;

    const orig = Core.Commands.execute;
    Core.Commands.execute = function (inputStr) {
        const raw = inputStr.trim();
        const t = raw.toLowerCase();

        if (t === 'joke') {
            Core.SystemLogs.write(JOKES[Math.floor(Math.random() * JOKES.length)]);
            return;
        }
        if (t === 'sudo' || t.startsWith('sudo ')) { typeSudo(); return; }
        if (t.startsWith('ascii')) {
            const which = t.replace('ascii', '').trim();
            const art = ASCII_ART[which] || ASCII_ART.cat;
            Core.SystemLogs.write(`<pre style="font-family:monospace;line-height:1.2;margin:4px 0;">${art}</pre>`);
            return;
        }
        if (t === 'flip') {
            Core.SystemLogs.write(Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails');
            return;
        }
        if (t === 'roll' || t.startsWith('roll ')) {
            const sides = parseInt(t.replace('roll', '').trim(), 10) || 6;
            const result = 1 + Math.floor(Math.random() * sides);
            Core.SystemLogs.write(`🎲 Rolled a d${sides}: <strong>${result}</strong>`);
            return;
        }
        if (t === '8ball' || t.startsWith('8ball ')) {
            const answers = ['Yes.', 'No.', 'Ask again later.', 'Definitely.', 'Very doubtful.', 'It is certain.', 'Cannot predict now.', 'Signs point to yes.'];
            Core.SystemLogs.write('🎱 ' + answers[Math.floor(Math.random() * answers.length)]);
            return;
        }
        if (t === 'hack') {
            const lines = ['Bypassing firewall...', 'Cracking encryption...', 'Accessing mainframe...', 'Downloading the internet...', 'Just kidding — this is a static site. 😄'];
            lines.forEach((l, i) => setTimeout(() => Core.SystemLogs.write(l), i * 500));
            return;
        }
        if (t === 'coffee') {
            Core.SystemLogs.write('☕ Brewing... ☕ Done. Here you go.');
            return;
        }
        if (t.startsWith('calc ') || t.startsWith('calc')) {
            const expr = raw.slice(4).trim();
            if (!expr) { Core.SystemLogs.write('Usage: calc 2+2*3'); return; }
            if (!/^[0-9+\-*/().\s]+$/.test(expr)) { Core.SystemLogs.write('Only numbers and + - * / ( ) are allowed.'); return; }
            try {
                // eslint-disable-next-line no-new-func
                const result = Function('"use strict"; return (' + expr + ')')();
                Core.SystemLogs.write(`${expr} = <strong>${result}</strong>`);
            } catch (e) { Core.SystemLogs.write('Could not evaluate that expression.'); }
            return;
        }
        if (t.startsWith('convert ')) {
            handleConvert(raw.slice(8).trim());
            return;
        }
        if (t === 'whoami') {
            const ua = navigator.userAgent;
            const lang = navigator.language;
            const screenInfo = `${screen.width}×${screen.height}`;
            Core.SystemLogs.write(`Session: browser=${ua.split(') ')[0].split('(')[1] || 'unknown'}, lang=${lang}, screen=${screenInfo}, theme=${document.documentElement.getAttribute('data-theme') || 'dark'}`);
            return;
        }
        if (t === 'ip') {
            Core.SystemLogs.write('This site never sees your raw IP client-side — the Cloudflare Worker resolves your approximate country server-side for visitor logging, and that\'s all it stores.');
            return;
        }
        if (t === 'clock') {
            Core.SystemLogs.write('🕐 ' + new Date().toLocaleTimeString());
            return;
        }
        if (t.startsWith('countdown')) {
            const n = parseInt(t.replace('countdown', '').trim(), 10) || 10;
            if (n > 60) { Core.SystemLogs.write('Max countdown is 60 seconds.'); return; }
            let remaining = n;
            Core.SystemLogs.write(`⏳ Counting down from ${n}...`);
            const iv = setInterval(() => {
                remaining--;
                if (remaining <= 0) { clearInterval(iv); Core.SystemLogs.write('⏰ Done!'); }
                else if (remaining <= 3) Core.SystemLogs.write(String(remaining));
            }, 1000);
            return;
        }
        if (t.startsWith('define ')) {
            const word = raw.slice(7).trim();
            if (!word) { Core.SystemLogs.write('Usage: define <word>'); return; }
            fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word))
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(data => {
                    const def = data[0]?.meanings?.[0]?.definitions?.[0]?.definition;
                    Core.SystemLogs.write(def ? `<strong>${word}</strong>: ${def}` : `No definition found for "${word}".`);
                })
                .catch(() => Core.SystemLogs.write(`Couldn't look up "${word}" — dictionary service unavailable.`));
            return;
        }
        if (t === 'stopwatch') {
            if (stopwatchStart === null) {
                stopwatchStart = Date.now();
                Core.SystemLogs.write('⏱️ Stopwatch started. Type "stopwatch" again to stop.');
            } else {
                const elapsed = ((Date.now() - stopwatchStart) / 1000).toFixed(1);
                Core.SystemLogs.write(`⏱️ Stopped at ${elapsed}s.`);
                stopwatchStart = null;
            }
            return;
        }
        if (t === 'version') {
            Core.SystemLogs.write('DONI | DEV — v3.5 — built with vanilla JS, Firebase, and a Cloudflare Worker. No frameworks were harmed in the making of this site.');
            return;
        }
        if (t === 'uptime-me') {
            const el = document.getElementById('screen-time');
            Core.SystemLogs.write(el ? 'See the screen-time widget on the dashboard for your session length.' : 'Session length tracking is on the dashboard page.');
            return;
        }
        if (t === 'cls') { Core.SystemLogs.clear(); return; }
        if (t === 'exit') {
            Core.SystemLogs.write('Nice try. Closing the palette instead. 😉');
            setTimeout(() => { if (typeof togglePalette === 'function') togglePalette(false); }, 600);
            return;
        }

        orig.call(this, inputStr);
    };

    function handleConvert(query) {
        // usage: "10 km to mi", "5 kg to lb", "100 f to c", "3 mi to km"
        const m = query.match(/^([\d.]+)\s*([a-z°]+)\s*(?:to|in)\s*([a-z°]+)$/i);
        if (!m) { Core.SystemLogs.write('Usage: convert 10 km to mi'); return; }
        const [, valStr, fromRaw, toRaw] = m;
        const val = parseFloat(valStr);
        const from = fromRaw.toLowerCase();
        const to = toRaw.toLowerCase();

        const LENGTH = { km: 1000, m: 1, cm: 0.01, mi: 1609.34, ft: 0.3048, in: 0.0254 };
        const WEIGHT = { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 };

        if (LENGTH[from] && LENGTH[to]) {
            const result = (val * LENGTH[from]) / LENGTH[to];
            Core.SystemLogs.write(`${val} ${from} = <strong>${result.toFixed(4)} ${to}</strong>`);
            return;
        }
        if (WEIGHT[from] && WEIGHT[to]) {
            const result = (val * WEIGHT[from]) / WEIGHT[to];
            Core.SystemLogs.write(`${val} ${from} = <strong>${result.toFixed(4)} ${to}</strong>`);
            return;
        }
        if ((from === 'f' || from === '°f') && (to === 'c' || to === '°c')) {
            Core.SystemLogs.write(`${val}°F = <strong>${((val - 32) * 5 / 9).toFixed(2)}°C</strong>`);
            return;
        }
        if ((from === 'c' || from === '°c') && (to === 'f' || to === '°f')) {
            Core.SystemLogs.write(`${val}°C = <strong>${(val * 9 / 5 + 32).toFixed(2)}°F</strong>`);
            return;
        }
        Core.SystemLogs.write(`Don't know how to convert ${from} to ${to}. Try km/m/cm/mi/ft/in, kg/g/lb/oz, or c/f.`);
    }

    // ---------- Hidden Easter eggs ----------

    // Type "iddqd" anywhere (classic Doom god-mode cheat) → cosmetic god-mode badge
    (function godModeEgg() {
        const seq = 'iddqd';
        let pos = 0;
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
            const key = e.key.toLowerCase();
            pos = (key === seq[pos]) ? pos + 1 : (key === seq[0] ? 1 : 0);
            if (pos === seq.length) {
                pos = 0;
                document.body.classList.add('god-mode');
                if (typeof UI !== 'undefined') UI.toast('🛡️ God mode. (purely cosmetic, don\'t worry)', 'success');
                setTimeout(() => document.body.classList.remove('god-mode'), 5000);
            }
        });
    })();

    // Click the footer copyright year 5 times fast → time warp visual gag
    (function timeWarpEgg() {
        let clicks = 0, timer = null;
        document.addEventListener('click', (e) => {
            const footer = e.target.closest('footer');
            if (!footer || !e.target.closest('div')?.textContent.includes('2026')) return;
            if (e.target.closest('a')) return; // don't hijack real footer links
            clicks++;
            clearTimeout(timer);
            timer = setTimeout(() => { clicks = 0; }, 1500);
            if (clicks >= 5) {
                clicks = 0;
                document.documentElement.classList.add('time-warp');
                if (typeof UI !== 'undefined') UI.toast('⏳ You bent time itself. Briefly.', 'info');
                setTimeout(() => document.documentElement.classList.remove('time-warp'), 2000);
            }
        });
    })();

    // Console message for anyone who opens devtools out of curiosity
    console.log('%c👋 Snooping around the console?', 'font-size:16px;font-weight:bold;color:#22c55e;');
    console.log('%cTry typing "help" in the command palette (Ctrl+K) for the full list — including a few you won\'t find in the docs.', 'font-size:12px;color:#888;');
})();
