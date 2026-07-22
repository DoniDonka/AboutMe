/**
 * DONI | DEV — Developer Tools v3.5
 * AI Chat, Password Gen, Typing Speed + Leaderboard, QR Generator,
 * Music Visualizer, Base64, JSON Formatter, Daily Challenge.
 */
(function() {

    // ---------- AI Chat ----------
    function initAiChat() {
        const input = document.getElementById('ai-chat-input');
        const send = document.getElementById('ai-chat-send');
        const box = document.getElementById('ai-chat-box');
        if (!input || !send || !box) return;
        const responses = {
            'hello':'Hey there! Ready to build something awesome?',
            'hi':'Hello! What are we coding today?',
            'help':'Available topics: js, css, firebase, discord, node, html, career.',
            'js':'JavaScript tip: use const by default, let when reassigning, never var.',
            'css':'CSS tip: grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) is magic.',
            'firebase':'Firebase tip: always index your Firestore query fields for performance.',
            'discord':'Discord.js tip: use slash commands — they auto-complete and validate.',
            'node':'Node tip: always handle promise rejections. Use a process.on(\'unhandledRejection\') guard.',
            'html':'HTML tip: semantic tags (header, nav, main, footer) improve accessibility and SEO.',
            'career':'Career tip: ship early, ship often. A deployed MVP beats a perfect local prototype.',
            'api':'API tip: version your routes from day one. /v1/ will save you later.',
            'security':'Security tip: never trust the client. Validate everything server-side.',
            'default':'Interesting! Tell me more, or type \"help\" for topics I know about.'
        };
        function reply(text) {
            const lower = text.toLowerCase().replace(/[^a-z]/g,'');
            let resp = responses.default;
            for (const key in responses) { if (lower.includes(key)) { resp = responses[key]; break; } }
            const div = document.createElement('div');
            div.style.cssText = 'padding:10px 14px;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);border-radius:8px;margin-top:8px;align-self:flex-start;max-width:80%;';
            div.textContent = '🤖 ' + resp;
            box.appendChild(div);
            box.scrollTop = box.scrollHeight;
        }
        send.addEventListener('click', () => {
            const text = input.value.trim(); if (!text) return;
            const div = document.createElement('div');
            div.style.cssText = 'padding:10px 14px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;margin-top:8px;align-self:flex-end;max-width:80%;margin-left:auto;';
            div.textContent = text;
            box.appendChild(div);
            input.value = '';
            box.scrollTop = box.scrollHeight;
            setTimeout(() => reply(text), 400 + Math.random()*400);
        });
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') send.click(); });
    }

    // ---------- Password Generator ----------
    function initPasswordGen() {
        const out = document.getElementById('pw-output');
        const len = document.getElementById('pw-length');
        const btn = document.getElementById('pw-generate');
        const copy = document.getElementById('pw-copy');
        if (!out || !btn) return;
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        btn.addEventListener('click', () => {
            const l = parseInt(len?.value || '16');
            let pw = '';
            for (let i = 0; i < l; i++) pw += chars[Math.floor(Math.random() * chars.length)];
            out.value = pw;
        });
        if (copy) copy.addEventListener('click', () => { navigator.clipboard.writeText(out.value); if(typeof UI!=='undefined')UI.toast('Password copied!','success'); });
    }

    // ---------- Typing Speed Test + Leaderboard ----------
    function initTypingTest() {
        const display = document.getElementById('type-display');
        const input = document.getElementById('type-input');
        const startBtn = document.getElementById('type-start');
        const result = document.getElementById('type-result');
        const board = document.getElementById('type-leaderboard');
        if (!display || !input || !startBtn) return;
        const sentences = [
            "The quick brown fox jumps over the lazy dog.",
            "Building creative interfaces one commit at a time.",
            "Firebase real-time sync makes everything feel alive.",
            "Vanilla JavaScript is underrated in a framework-heavy world.",
            "Dark mode should be the default for every developer tool."
        ];
        let current = '', startTime = 0, active = false;
        function renderBoard() {
            if (!board) return;
            const scores = JSON.parse(localStorage.getItem('doni_type_scores') || '[]');
            board.innerHTML = scores.length ? scores.slice(0,5).map((s,i) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);"><span>#${i+1} ${s.date}</span><span style="color:var(--accent-green);font-weight:700;">${s.wpm} WPM</span></div>`).join('') : '<div style="color:var(--text-muted);font-size:0.8rem;">No scores yet.</div>';
        }
        startBtn.addEventListener('click', () => {
            current = sentences[Math.floor(Math.random() * sentences.length)];
            display.innerHTML = current.split('').map(c => `<span style="color:var(--text-muted);">${c}</span>`).join('');
            input.value = ''; input.disabled = false; input.focus(); active = true; startTime = Date.now();
            result.textContent = '';
        });
        input.addEventListener('input', () => {
            if (!active) return;
            const typed = input.value;
            display.innerHTML = current.split('').map((c,i) => {
                if (i < typed.length) return typed[i] === c ? `<span style="color:var(--accent-green);">${c}</span>` : `<span style="color:#ef4444;">${c}</span>`;
                return `<span style="color:var(--text-muted);">${c}</span>`;
            }).join('');
            if (typed === current) {
                active = false; input.disabled = true;
                const time = (Date.now() - startTime) / 60000;
                const wpm = Math.round((current.split(' ').length) / time);
                result.innerHTML = `<span style="color:var(--accent-green);font-size:1.2rem;font-weight:700;">${wpm} WPM</span>`;
                const scores = JSON.parse(localStorage.getItem('doni_type_scores') || '[]');
                scores.push({ wpm, date: new Date().toLocaleDateString() });
                scores.sort((a,b) => b.wpm - a.wpm);
                localStorage.setItem('doni_type_scores', JSON.stringify(scores.slice(0,10)));
                renderBoard();
            }
        });
        renderBoard();
    }

    // ---------- QR Generator ----------
    function initQrGen() {
        const input = document.getElementById('qr-input');
        const btn = document.getElementById('qr-generate');
        const out = document.getElementById('qr-output');
        if (!input || !btn || !out) return;
        btn.addEventListener('click', () => {
            const text = encodeURIComponent(input.value.trim() || 'https://doni.dev');
            out.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${text}" alt="QR" style="border-radius:8px;border:1px solid var(--border-color);">`;
        });
    }

    // ---------- Music Visualizer ----------
    function initVisualizer() {
        const canvas = document.getElementById('viz-canvas');
        const startBtn = document.getElementById('viz-start');
        const fileInput = document.getElementById('viz-file');
        if (!canvas || !startBtn) return;
        const ctx = canvas.getContext('2d');
        let audioCtx, analyser, source, dataArray, animId;
        function draw() {
            animId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0,0,canvas.width,canvas.height);
            const barWidth = (canvas.width / dataArray.length) * 2.5;
            for (let i = 0; i < dataArray.length; i++) {
                const h = (dataArray[i] / 255) * canvas.height;
                ctx.fillStyle = `hsl(${120 + (i/dataArray.length)*60}, 80%, 50%)`;
                ctx.fillRect(i * barWidth, canvas.height - h, barWidth - 1, h);
            }
        }
        startBtn.addEventListener('click', async () => {
            if (!fileInput.files[0]) { if(typeof UI!=='undefined')UI.toast('Upload an audio file first','info'); return; }
            if (!(window.AudioContext || window.webkitAudioContext)) {
                if(typeof UI!=='undefined')UI.toast('Web Audio not supported in this browser','error');
                return;
            }
            const file = fileInput.files[0];
            startBtn.disabled = true;
            startBtn.textContent = 'Loading...';
            try {
                const url = URL.createObjectURL(file);
                const audio = new Audio(url);
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                source = audioCtx.createMediaElementSource(audio);
                source.connect(analyser); analyser.connect(audioCtx.destination);
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                await audio.play();
                draw();
                startBtn.textContent = 'Playing...';
                startBtn.disabled = false;
                audio.addEventListener('ended', () => { cancelAnimationFrame(animId); startBtn.textContent = 'Start Visualizer'; });
                audio.addEventListener('error', () => {
                    cancelAnimationFrame(animId);
                    startBtn.textContent = 'Start Visualizer';
                    startBtn.disabled = false;
                    if(typeof UI!=='undefined')UI.toast('Could not play that file','error');
                });
            } catch (e) {
                startBtn.textContent = 'Start Visualizer';
                startBtn.disabled = false;
                if(typeof UI!=='undefined')UI.toast('Playback blocked or unsupported file','error');
            }
        });
    }

    // ---------- Base64 Tool ----------
    function initBase64() {
        const input = document.getElementById('b64-input');
        const encodeBtn = document.getElementById('b64-encode');
        const decodeBtn = document.getElementById('b64-decode');
        const out = document.getElementById('b64-output');
        if (!input || !out) return;
        encodeBtn?.addEventListener('click', () => { try { out.value = btoa(input.value); } catch(e) { out.value = 'Error: Invalid input for encoding'; } });
        decodeBtn?.addEventListener('click', () => { try { out.value = atob(input.value); } catch(e) { out.value = 'Error: Invalid Base64 string'; } });
    }

    // ---------- JSON Formatter ----------
    function initJsonFormatter() {
        const input = document.getElementById('json-input');
        const prettyBtn = document.getElementById('json-pretty');
        const minifyBtn = document.getElementById('json-minify');
        const out = document.getElementById('json-output');
        if (!input || !out) return;
        prettyBtn?.addEventListener('click', () => { try { out.value = JSON.stringify(JSON.parse(input.value), null, 2); } catch(e) { out.value = 'Invalid JSON: ' + e.message; } });
        minifyBtn?.addEventListener('click', () => { try { out.value = JSON.stringify(JSON.parse(input.value)); } catch(e) { out.value = 'Invalid JSON: ' + e.message; } });
    }

    // ---------- Daily Challenge ----------
    function initDailyChallenge() {
        const box = document.getElementById('daily-challenge-box');
        const checkBtn = document.getElementById('daily-check');
        const streakEl = document.getElementById('daily-streak');
        if (!box) return;
        const challenges = [
            { title: 'CSS Grid Master', desc: 'Build a 3x3 bento grid with hover glow effects.' },
            { title: 'Firebase Query', desc: 'Write a Firestore query with .where(), .orderBy(), and .limit(10).' },
            { title: 'Discord Bot Cmd', desc: 'Create a slash command with 3 options using Discord.js v14.' },
            { title: 'Dark Mode Toggle', desc: 'Implement a no-flash dark mode using localStorage + inline script.' },
            { title: 'Typing Animation', desc: 'Build a typewriter effect that types and deletes words in a loop.' },
            { title: 'Canvas Particle', desc: 'Create 50 floating particles that bounce off screen edges.' },
            { title: 'Form Validation', desc: 'Validate an email, password strength, and match confirmation in vanilla JS.' },
            { title: 'API Fetcher', desc: 'Fetch JSON from a public API and render it as styled cards.' }
        ];
        const today = new Date().toDateString();
        const saved = JSON.parse(localStorage.getItem('doni_daily') || '{}');
        const idx = Math.floor(new Date().getTime() / 86400000) % challenges.length;
        const challenge = challenges[idx];
        box.innerHTML = `<h3 style="margin-bottom:8px;color:var(--accent-green);">📅 ${challenge.title}</h3><p style="font-size:0.9rem;">${challenge.desc}</p><div style="margin-top:12px;font-size:0.75rem;color:var(--text-muted);">Resets at midnight</div>`;
        if (streakEl) {
            const streak = saved.streak || 0;
            streakEl.innerHTML = `<strong style="font-size:1.4rem;color:var(--accent-green);">${streak}</strong><div style="font-size:0.7rem;color:var(--text-muted);">day streak</div>`;
        }
        if (checkBtn) {
            const done = saved.date === today;
            checkBtn.textContent = done ? '✅ Completed' : 'Mark Complete';
            checkBtn.disabled = done;
            checkBtn.addEventListener('click', () => {
                const s = JSON.parse(localStorage.getItem('doni_daily') || '{}');
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                s.streak = (s.date === yesterday) ? (s.streak || 0) + 1 : 1;
                s.date = today;
                localStorage.setItem('doni_daily', JSON.stringify(s));
                checkBtn.textContent = '✅ Completed'; checkBtn.disabled = true;
                if (streakEl) streakEl.innerHTML = `<strong style="font-size:1.4rem;color:var(--accent-green);">${s.streak}</strong><div style="font-size:0.7rem;color:var(--text-muted);">day streak</div>`;
                if (typeof UI !== 'undefined') UI.toast(`🔥 ${s.streak} day streak!`, 'success');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initAiChat(); initPasswordGen(); initTypingTest(); initQrGen();
        initVisualizer(); initBase64(); initJsonFormatter(); initDailyChallenge();
    });
})();
