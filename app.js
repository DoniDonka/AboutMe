/**
 * DONI | DEV - Core Application Engine
 * Version: 1.3 - Firebase Edition
 * Vanilla JS + Firebase Firestore
 */

// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyBH3qWCy9jRT2HOrX8smaQA1XI5IUVtZlg",
    authDomain: "aboutme-8a339.firebaseapp.com",
    projectId: "aboutme-8a339",
    storageBucket: "aboutme-8a339.firebasestorage.app",
    messagingSenderId: "638307646276",
    appId: "1:638307646276:web:fe52c653fd16fa81f37511",
    measurementId: "G-KHCMH8W9WB"
};

// Initialize Firebase
let db = null;
let firebaseReady = false;

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            firebaseReady = true;
            Core.SystemLogs.write('<span style="color:#22c55e;">✓</span> Firebase connected successfully.');
            console.log('[Firebase] Initialized successfully');

            // Keep the admin panel in sync with Firebase Auth state
            if (firebase.auth) {
                firebase.auth().onAuthStateChanged(() => {
                    if (typeof Security !== 'undefined' && Security.AdminGate) {
                        Security.AdminGate.refreshUI();
                    }
                });
            }

            // Start real-time listener
            initRealtimeSync();
        } else {
            console.warn('[Firebase] SDK not loaded, using localStorage fallback');
            Core.SystemLogs.write('<span style="color:#eab308;">⚠</span> Firebase SDK not loaded. Using local storage.');
        }
    } catch (error) {
        console.error('[Firebase] Init error:', error);
        Core.SystemLogs.write('<span style="color:#ef4444;">✗</span> Firebase connection failed. Offline mode.');
    }
}

// ============================================
// FIRESTORE OPERATIONS
// ============================================
const FirestoreDB = {
    // Save dashboard settings
    saveSettings: async function (data) {
        if (!firebaseReady || !db) {
            localStorage.setItem('doni_admin_state', JSON.stringify(data));
            return { success: true, source: 'localStorage' };
        }

        try {
            await db.collection('dashboard').doc('settings').set({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Also save to localStorage as backup
            localStorage.setItem('doni_admin_state', JSON.stringify(data));

            console.log('[Firestore] Settings saved');
            return { success: true, source: 'firestore' };
        } catch (error) {
            console.error('[Firestore] Save error:', error);
            localStorage.setItem('doni_admin_state', JSON.stringify(data));
            return { success: false, source: 'localStorage', error };
        }
    },

    // Load dashboard settings
    loadSettings: async function () {
        if (!firebaseReady || !db) {
            const local = localStorage.getItem('doni_admin_state');
            return local ? JSON.parse(local) : null;
        }

        try {
            const doc = await db.collection('dashboard').doc('settings').get();
            if (doc.exists) {
                console.log('[Firestore] Settings loaded');
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('[Firestore] Load error:', error);
            const local = localStorage.getItem('doni_admin_state');
            return local ? JSON.parse(local) : null;
        }
    },

    // Add deployment log entry
    addLogEntry: async function (message, type = 'info') {
        if (!firebaseReady || !db) return;

        try {
            await db.collection('logs').add({
                message,
                type,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('[Firestore] Log write error:', error);
        }
    },

    // Get recent logs
    getRecentLogs: async function (limit = 10) {
        if (!firebaseReady || !db) return [];

        try {
            const snapshot = await db.collection('logs')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('[Firestore] Log read error:', error);
            return [];
        }
    }
};

// ============================================
// REAL-TIME SYNC LISTENER
// ============================================
function initRealtimeSync() {
    if (!firebaseReady || !db) return;

    // Listen for settings changes in real-time
    db.collection('dashboard').doc('settings')
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                applySettingsToUI(data);
                console.log('[Firestore] Real-time update received');
            }
        }, (error) => {
            console.error('[Firestore] Listener error:', error);
        });

    Core.SystemLogs.write('<span style="color:#3b82f6;">↻</span> Real-time sync active.');
}

// Apply settings data to the UI
function applySettingsToUI(data) {
    if (!data) return;

    const titleEl = document.getElementById('project-title-heading');
    const descEl = document.getElementById('project-desc-text');
    const statusTextEl = document.getElementById('status-text');
    const discordEl = document.getElementById('discord-activity-txt');
    const dot = document.getElementById('status-dot');

    if (data.title && titleEl) titleEl.innerText = data.title;
    if (data.desc && descEl) descEl.innerText = data.desc;
    if (data.status && statusTextEl) statusTextEl.innerText = data.status;
    if (data.discord && discordEl) discordEl.innerText = data.discord;

    // Update status dot color
    if (data.status && dot) {
        if (data.status === 'Active') {
            dot.style.background = '#22c55e';
            dot.style.boxShadow = '0 0 10px #22c55e';
        } else if (data.status === 'Building') {
            dot.style.background = '#eab308';
            dot.style.boxShadow = '0 0 10px #eab308';
        } else {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 10px #ef4444';
        }
    }

    // Also update admin form fields if they exist
    const adminTitle = document.getElementById('admin-proj-title');
    const adminDesc = document.getElementById('admin-proj-desc');
    const adminStatus = document.getElementById('admin-status-select');
    const adminDiscord = document.getElementById('admin-discord-msg');

    if (data.title && adminTitle) adminTitle.value = data.title;
    if (data.desc && adminDesc) adminDesc.value = data.desc;
    if (data.status && adminStatus) adminStatus.value = data.status;
    if (data.discord && adminDiscord) adminDiscord.value = data.discord;

    // Featured project tags
    if (Array.isArray(data.tags)) {
        if (typeof adminTags !== 'undefined') adminTags = data.tags.slice();
        if (typeof applyTagsToUI === 'function') applyTagsToUI(data.tags);
        if (typeof renderAdminTags === 'function') renderAdminTags();
    }

    // Live widgets: availability badge, latest-update note, feature toggles
    if (typeof Widgets !== 'undefined' && Widgets.applySettings) Widgets.applySettings(data);
}

// ============================================
// ENVIRONMENT DETECTION
// ============================================
const isLocal = window.location.protocol === 'file:';

// ============================================
// CORE SYSTEM OBJECT
// ============================================
const Core = {
    SystemLogs: {
        target: null,
        init: function () {
            this.target = document.getElementById('deployment-log');
        },
        write: function (msg, isUserCommand = false) {
            if (!this.target) return;
            const line = document.createElement('div');
            line.className = isUserCommand ? 'log-item log-cmd' : 'log-item';
            line.innerHTML = isUserCommand ? `&gt; ${msg}` : msg;
            this.target.appendChild(line);
            this.target.scrollTop = this.target.scrollHeight;

            // Also log to Firestore (non-blocking)
            if (firebaseReady && !isUserCommand) {
                FirestoreDB.addLogEntry(msg.replace(/<[^>]*>/g, ''), 'system');
            }
        },
        clear: function () {
            if (this.target) this.target.innerHTML = '';
        }
    },
    Commands: {
        list: {
            'help': 'Display active command catalog.',
            'clear': 'Flush system deployment logs.',
            'status': 'Verify global subsystem uptime.',
            'ping': 'Echo current localized server runtime metric.',
            'admin': 'Open Admin Settings Panel.',
            'discord': 'Inspect & manage Discord integration.',
            'firebase': 'Check real-time Firebase sync status.',
            'sync': 'Force sync with Firebase.',
            'home': 'Navigate to Dashboard.',
            'projects': 'Navigate to Projects page.',
            'about': 'Navigate to About page.',
            'contact': 'Navigate to Contact page.',
            'links': 'Navigate to Links / Socials page.',
            'blog': 'Navigate to Blog page.',
            'uses': 'Navigate to Uses / Setup page.',
            'resume': 'Navigate to Resume page.',
            'guestbook': 'Navigate to Guestbook.',
            'stats': 'Navigate to Site Stats.',
            'changelog': 'Navigate to Changelog.',
            'lock': 'Lock the admin panel.',
            'lockscreen': 'Lock the entire site (full-screen passcode).',
            'theme': 'Toggle light / dark theme.',
            'accent': 'Cycle the accent color.',
            'sound': 'Toggle interface sound FX.',
            'search': 'Search pages & commands (type: search <query>).'
        },
        execute: function (inputStr) {
            const clean = inputStr.trim();
            if (!clean) return;

            const trigger = clean.toLowerCase();
            Core.SystemLogs.write(clean, true);

            if (trigger === 'help') {
                let commandsString = 'Available commands:<br>';
                for (const [cmd, desc] of Object.entries(this.list)) {
                    commandsString += `<span style="color:#fff;">${cmd}</span> - ${desc}<br>`;
                }
                Core.SystemLogs.write(commandsString);
            }
            else if (trigger === 'clear') {
                Core.SystemLogs.clear();
            }
            else if (trigger === 'status') {
                const fbStatus = firebaseReady ? '<span style="color:#22c55e;">connected</span>' : '<span style="color:#ef4444;">disconnected</span>';
                Core.SystemLogs.write(`Subsystems: operational.<br>Firebase: ${fbStatus}<br>Database: aboutme-8a339`);
            }
            else if (trigger === 'ping') {
                const latencyEl = document.getElementById('latency-val');
                const currentMetric = latencyEl ? latencyEl.innerText : 'N/A';
                Core.SystemLogs.write(`Telemetry: ${currentMetric}`);
            }
            else if (trigger === 'admin') {
                toggleAdminModal(true);
                Core.SystemLogs.write("Admin Control Panel initialized.");
            }
            else if (trigger === 'discord') {
                const discordEl = document.getElementById('discord-activity-txt');
                const status = discordEl ? discordEl.innerText : 'Not configured';
                Core.SystemLogs.write(`Discord RPC: Configured.<br>&gt; Activity: ${status}`);
            }
            else if (trigger === 'firebase') {
                if (firebaseReady) {
                    Core.SystemLogs.write(`Firebase Status: <span style="color:#22c55e;">ONLINE</span><br>Project: aboutme-8a339<br>Firestore: Real-time sync active`);
                } else {
                    Core.SystemLogs.write(`Firebase Status: <span style="color:#ef4444;">OFFLINE</span><br>Using localStorage fallback.`);
                }
            }
            else if (trigger === 'sync') {
                Core.SystemLogs.write("Forcing Firebase sync...");
                FirestoreDB.loadSettings().then(data => {
                    if (data) {
                        applySettingsToUI(data);
                        Core.SystemLogs.write('<span style="color:#22c55e;">✓</span> Sync complete.');
                    } else {
                        Core.SystemLogs.write('<span style="color:#eab308;">⚠</span> No remote data found.');
                    }
                });
            }
            else if (trigger === 'home') {
                window.location.href = 'index.html';
            }
            else if (trigger === 'projects') {
                window.location.href = 'projects.html';
            }
            else if (trigger === 'about') {
                window.location.href = 'about.html';
            }
            else if (trigger === 'contact') {
                window.location.href = 'contact.html';
            }
            else if (trigger === 'links') {
                window.location.href = 'links.html';
            }
            else if (trigger === 'blog') {
                window.location.href = 'blog.html';
            }
            else if (trigger === 'uses') {
                window.location.href = 'uses.html';
            }
            else if (trigger === 'resume') {
                window.location.href = 'resume.html';
            }
            else if (trigger === 'guestbook') {
                window.location.href = 'guestbook.html';
            }
            else if (trigger === 'stats') {
                window.location.href = 'stats.html';
            }
            else if (trigger === 'changelog') {
                window.location.href = 'changelog.html';
            }
            else if (trigger === 'lock') {
                if (typeof Security !== 'undefined') {
                    Security.AdminGate.lock();
                    Core.SystemLogs.write('Admin panel locked.');
                }
            }
            else if (trigger === 'lockscreen' || trigger === 'sitelock') {
                if (typeof Security !== 'undefined' && Security.SiteLock) {
                    Core.SystemLogs.write('Engaging full-screen site lock...');
                    Security.SiteLock.lock();
                }
            }
            else if (trigger === 'theme') {
                if (typeof UI !== 'undefined') {
                    const t = UI.Theme.toggle();
                    Core.SystemLogs.write(`Theme switched to ${t}.`);
                }
            }
            else if (trigger === 'accent') {
                if (typeof UI !== 'undefined') {
                    const accents = ['green', 'blue', 'purple', 'orange', 'pink', 'cyan'];
                    const cur = UI.Theme.getAccent();
                    const next = accents[(accents.indexOf(cur) + 1) % accents.length];
                    UI.Theme.setAccent(next);
                    UI.toast(`🎨 Accent: ${next}`, 'info');
                    Core.SystemLogs.write(`Accent color set to ${next}.`);
                }
            }
            else if (trigger === 'sound') {
                if (typeof UI !== 'undefined') {
                    const on = UI.Sound.toggle();
                    Core.SystemLogs.write(`Sound FX ${on ? 'enabled' : 'disabled'}.`);
                }
            }
            else if (trigger.startsWith('search')) {
                const q = clean.slice(6).trim();
                const results = searchSite(q);
                if (!q) {
                    Core.SystemLogs.write('Usage: search &lt;query&gt; — e.g. "search resume".');
                } else if (results.length) {
                    Core.SystemLogs.write(`Found ${results.length} result(s) for "${q}":<br>` +
                        results.map(r => `<span style="color:#fff;">${r.title}</span> — ${r.url}`).join('<br>'));
                } else {
                    Core.SystemLogs.write(`No results for "${q}".`);
                }
            }
            else {
                Core.SystemLogs.write(`Command parsing error: "${clean}" not recognized. Try 'help'.`);
            }
        }
    }
};

// ============================================
// CURSOR GLOW EFFECT ENGINE
// ============================================
function bindCardGlow() {
    document.querySelectorAll('.bento-card').forEach(card => {
        if (card.dataset.glowBound) return;
        card.dataset.glowBound = 'true';
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// ============================================
// CARD REVEAL ENGINE (fade + rise, load + scroll)
// ============================================
function initCardReveal() {
    const cards = document.querySelectorAll('.bento-card, .page-hero');
    if (!cards.length) return;

    if (!('IntersectionObserver' in window)) {
        cards.forEach(card => card.classList.add('reveal-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const delay = Math.min(parseInt(card.dataset.revealIndex || '0', 10) * 70, 350);
                card.style.animationDelay = `${delay}ms`;
                card.classList.add('reveal-visible');
                obs.unobserve(card);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    cards.forEach((card, i) => {
        card.classList.add('reveal-init');
        card.dataset.revealIndex = i;
        observer.observe(card);
    });
}

// ============================================
// GITHUB ACTIVITY FETCHER
// ============================================
async function fetchGithubActivity() {
    const container = document.getElementById('deployment-log');
    if (!container) return;

    if (isLocal) {
        container.innerHTML = "<div class='log-item'><span style='color:#fff;'>Portfolio-Core</span>:<br>Local Sandbox Mode Active</div>";
        return;
    }
    try {
        const response = await fetch('https://api.github.com/users/DoniDonka/events/public');
        const data = await response.json();
        const push = data.filter(e => e.type === 'PushEvent').slice(0, 3);
        if (push.length > 0) {
            container.innerHTML = push.map(e => `<div class='log-item'><span style="color:#fff;">${e.repo.name.split('/')[1]}</span>:<br>${e.payload.commits[0]?.message || 'Update'}</div>`).join('');
        } else {
            container.innerHTML = "<div class='log-item'><span style='color:#fff;'>DONI-Core</span>:<br>System online & listening.</div>";
        }
    } catch (e) {
        container.innerHTML = "<div class='log-item'>Offline.</div>";
    }
}

// ============================================
// LATENCY MONITOR
// ============================================
function updateLatency() {
    const display = document.getElementById('latency-val');
    if (!display) return;

    if (isLocal) {
        display.innerText = "[LOG] Sync Status: 0ms (Local)";
        animateSparklines(8);
        return;
    }
    const start = Date.now();
    fetch(window.location.href, { mode: 'no-cors' }).then(() => {
        const diff = Date.now() - start;
        display.innerText = `[LOG] Sync Status: ${diff}ms`;
        animateSparklines(diff);
    }).catch(() => {
        display.innerText = `[LOG] Sync Status: Offline`;
    });
}

function animateSparklines(latency) {
    const bars = document.querySelectorAll('.sparkline-bar');
    bars.forEach(bar => {
        const randomVal = Math.min(100, Math.max(25, Math.floor(Math.random() * 70) + (latency > 50 ? 30 : 10)));
        bar.style.height = `${randomVal}%`;
    });
}

// ============================================
// TIME DISPLAY
// ============================================
function updateTime() {
    const el = document.getElementById('time-display');
    if (!el) return;
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    el.innerText = `My ${time} is your ${time}`;
}

// ============================================
// SITE SEARCH INDEX + FUZZY MATCH
// ============================================
const SEARCH_INDEX = [
    { title: 'Dashboard', url: 'index.html', keywords: 'home dashboard bento featured project telemetry' },
    { title: 'Projects', url: 'projects.html', keywords: 'projects work portfolio builds apps' },
    { title: 'About', url: 'about.html', keywords: 'about me bio story background' },
    { title: 'Contact', url: 'contact.html', keywords: 'contact email message form reach out hire' },
    { title: 'Links', url: 'links.html', keywords: 'links socials roblox youtube github discord games' },
    { title: 'Blog', url: 'blog.html', keywords: 'blog dev log posts writing articles' },
    { title: 'Uses', url: 'uses.html', keywords: 'uses setup hardware software gear stack nitro' },
    { title: 'Resume', url: 'resume.html', keywords: 'resume cv skills experience printable' },
    { title: 'Changelog', url: 'changelog.html', keywords: 'changelog versions history releases updates' },
    { title: 'Guestbook', url: 'guestbook.html', keywords: 'guestbook sign message leave note' },
    { title: 'Stats', url: 'stats.html', keywords: 'stats analytics page views visitors metrics' }
];

// tiny subsequence fuzzy matcher -> score (higher is better) or -1
function fuzzyScore(query, text) {
    query = query.toLowerCase();
    text = text.toLowerCase();
    if (!query) return 0;
    if (text.includes(query)) return 1000 - text.indexOf(query);
    let qi = 0, score = 0, streak = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
        if (text[i] === query[qi]) { qi++; streak++; score += streak; }
        else streak = 0;
    }
    return qi === query.length ? score : -1;
}

function searchSite(query) {
    if (!query) return [];
    return SEARCH_INDEX
        .map(p => ({ ...p, score: Math.max(fuzzyScore(query, p.title), fuzzyScore(query, p.keywords)) }))
        .filter(p => p.score >= 0)
        .sort((a, b) => b.score - a.score);
}

// ============================================
// COMMAND PALETTE (upgraded: search + keyboard nav)
// ============================================
let cmdActiveIndex = 0;
let cmdCurrentResults = [];

function buildCommandPalette() {
    // Remove any legacy inline palette so every page shares one consistent palette
    const existing = document.getElementById('cmd-palette');
    if (existing) existing.remove();

    const pal = document.createElement('div');
    pal.id = 'cmd-palette';
    pal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100000; backdrop-filter:blur(5px); justify-content:center; align-items:flex-start; padding-top:100px;';
    pal.innerHTML = `
        <div style="background:var(--elevated-bg); border-radius:12px; border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.8); padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted);">Command &amp; Search Palette</span>
                <span style="font-size:0.7rem; color:var(--text-muted);"><span class="kbd">↑</span> <span class="kbd">↓</span> navigate · <span class="kbd">↵</span> run · <span class="kbd">esc</span> close</span>
            </div>
            <input type="text" id="cmd-input" placeholder="Type a command or search pages…" autocomplete="off"
                style="width:100%; background:transparent; border:none; color:var(--text-main); font-size:1.1rem; outline:none; padding-bottom:10px; border-bottom:1px solid var(--border-color);">
            <div id="cmd-results" style="margin-top:14px; max-height:340px; overflow-y:auto;"></div>
        </div>`;
    document.body.appendChild(pal);
    return pal;
}

function paletteOpen() { return document.getElementById('cmd-palette')?.style.display === 'flex'; }

function togglePalette(show) {
    const pal = document.getElementById('cmd-palette');
    const input = document.getElementById('cmd-input');
    if (!pal) return;
    const willShow = show === undefined ? pal.style.display !== 'flex' : show;
    pal.style.display = willShow ? 'flex' : 'none';
    if (willShow) {
        if (input) { input.value = ''; input.focus(); }
        renderPaletteResults('');
        if (typeof UI !== 'undefined') UI.Sound.play('open');
    }
}

function renderPaletteResults(query) {
    const box = document.getElementById('cmd-results');
    if (!box) return;
    const q = query.trim();

    // commands
    const cmds = Object.entries(Core.Commands.list)
        .map(([cmd, desc]) => ({ cmd, desc, score: q ? fuzzyScore(q, cmd + ' ' + desc) : 0 }))
        .filter(c => c.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, q ? 6 : 8);

    // pages
    const pages = q ? searchSite(q).slice(0, 6) : SEARCH_INDEX.slice(0, 4);

    cmdCurrentResults = [
        ...cmds.map(c => ({ type: 'cmd', label: c.cmd, sub: c.desc, action: () => Core.Commands.execute(c.cmd) })),
        ...pages.map(p => ({ type: 'page', label: p.title, sub: p.url, action: () => { window.location.href = p.url; } }))
    ];
    cmdActiveIndex = 0;

    if (!cmdCurrentResults.length) {
        box.innerHTML = `<div class="cmd-empty">No matches for "${q}"</div>`;
        return;
    }

    let html = '';
    if (cmds.length) html += '<div class="cmd-section-label">Commands</div>';
    cmds.forEach((c, i) => {
        html += `<div class="cmd-result" data-idx="${i}"><span>&gt; ${c.cmd}</span><span class="cmd-result-type">${c.desc}</span></div>`;
    });
    if (pages.length) html += '<div class="cmd-section-label">Pages</div>';
    pages.forEach((p, i) => {
        html += `<div class="cmd-result" data-idx="${cmds.length + i}"><span>${p.title}</span><span class="cmd-result-type">page</span></div>`;
    });
    box.innerHTML = html;

    box.querySelectorAll('.cmd-result').forEach(el => {
        const idx = parseInt(el.dataset.idx, 10);
        el.addEventListener('mouseenter', () => setActiveResult(idx));
        el.addEventListener('click', () => runActiveResult(idx));
    });
    highlightActive();
}

function setActiveResult(idx) { cmdActiveIndex = idx; highlightActive(); }

function highlightActive() {
    const box = document.getElementById('cmd-results');
    if (!box) return;
    box.querySelectorAll('.cmd-result').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.idx, 10) === cmdActiveIndex);
    });
}

function runActiveResult(idx) {
    const i = idx === undefined ? cmdActiveIndex : idx;
    const item = cmdCurrentResults[i];
    togglePalette(false);
    if (item) item.action();
}

function initCommandPalette() {
    buildCommandPalette();
    const cmdInput = document.getElementById('cmd-input');

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            togglePalette();
        }
        if (e.key === 'Escape') {
            togglePalette(false);
            toggleAdminModal(false);
        }
    });

    if (!cmdInput) return;
    cmdInput.addEventListener('input', (e) => renderPaletteResults(e.target.value));
    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            cmdActiveIndex = Math.min(cmdActiveIndex + 1, cmdCurrentResults.length - 1);
            highlightActive();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            cmdActiveIndex = Math.max(cmdActiveIndex - 1, 0);
            highlightActive();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const raw = e.target.value.trim();
            // If it looks like a raw command with args (e.g. "search foo"), run it directly
            if (raw.includes(' ') && cmdCurrentResults[cmdActiveIndex]?.type !== 'page') {
                togglePalette(false);
                Core.Commands.execute(raw);
            } else {
                runActiveResult();
            }
        }
    });
}

function selectCmd(cmdName) {
    togglePalette(false);
    Core.Commands.execute(cmdName);
}

// ============================================
// DEVELOPER HUB TABS
// ============================================
function initHubTabs() {
    document.querySelectorAll('.hub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.hub-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
            const targetPane = document.getElementById(`tab-${targetTab}`);
            if (targetPane) targetPane.style.display = 'block';
        });
    });
}

// ============================================
// SNIPPET COPIER
// ============================================
function copySnippet(type) {
    const snippets = {
        glow: `card.addEventListener('mousemove', (e) => {\n  const rect = card.getBoundingClientRect();\n  card.style.setProperty('--mouse-x', \`\${e.clientX - rect.left}px\`);\n  card.style.setProperty('--mouse-y', \`\${e.clientY - rect.top}px\`);\n});`,
        firebase: `import { initializeApp } from "firebase/app";\nimport { getDatabase, ref, onValue } from "firebase/database";\nonValue(ref(db, 'dashboard/state'), (snapshot) => {\n  const data = snapshot.val();\n  updateUI(data);\n});`
    };
    const text = snippets[type] || '';
    navigator.clipboard.writeText(text);
    Core.SystemLogs.write(`Copied '${type}' snippet to clipboard.`);
}

// ============================================
// UTILITIES TOOL
// ============================================
function processUtil(type) {
    const val = document.getElementById('util-input')?.value;
    const out = document.getElementById('util-output');
    if (!out) return;
    if (!val) {
        out.innerText = "Please input text first.";
        return;
    }
    try {
        if (type === 'json') {
            out.innerText = JSON.stringify(JSON.parse(val), null, 2);
        } else {
            out.innerText = btoa(val);
        }
    } catch (err) {
        out.innerText = "Error: Invalid payload for conversion.";
    }
}

// ============================================
// ADMIN PANEL
// ============================================
function toggleAdminModal(show) {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
    if (show && typeof Security !== 'undefined') {
        Security.AdminGate.refreshUI();
    }
}

function initAdminPanel() {
    const logoBtn = document.getElementById('logo-btn');
    const statusBtn = document.getElementById('status-btn');
    const closeAdminBtn = document.getElementById('close-admin-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const saveAdminBtn = document.getElementById('save-admin-btn');

    if (logoBtn) logoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleAdminModal(true);
    });
    if (statusBtn) statusBtn.addEventListener('click', () => toggleAdminModal(true));
    if (closeAdminBtn) closeAdminBtn.addEventListener('click', () => toggleAdminModal(false));
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', () => Core.SystemLogs.clear());

    if (saveAdminBtn) {
        saveAdminBtn.addEventListener('click', async () => {
            const title = document.getElementById('admin-proj-title')?.value || '';
            const desc = document.getElementById('admin-proj-desc')?.value || '';
            const status = document.getElementById('admin-status-select')?.value || 'Active';
            const discord = document.getElementById('admin-discord-msg')?.value || '';

            const data = { title, desc, status, discord, tags: adminTags.slice() };

            // Update UI immediately
            applySettingsToUI(data);

            // Save to Firebase (and localStorage as backup)
            saveAdminBtn.innerText = 'Saving...';
            saveAdminBtn.disabled = true;

            const result = await FirestoreDB.saveSettings(data);

            if (result.success) {
                if (result.source === 'firestore') {
                    Core.SystemLogs.write('<span style="color:#22c55e;">✓</span> Settings synced to Firebase.');
                    if (typeof UI !== 'undefined') UI.toast('Settings synced to Firebase', 'success');
                } else {
                    Core.SystemLogs.write('<span style="color:#eab308;">⚠</span> Saved locally (Firebase offline).');
                    if (typeof UI !== 'undefined') UI.toast('Saved locally (Firebase offline)', 'info');
                }
            } else {
                Core.SystemLogs.write('<span style="color:#ef4444;">✗</span> Save failed. Stored locally.');
                if (typeof UI !== 'undefined') UI.toast('Save failed — stored locally', 'error');
            }

            saveAdminBtn.innerText = 'Save & Sync Dashboard';
            saveAdminBtn.disabled = false;
            toggleAdminModal(false);
        });
    }

    initAdminEnhancements();
}

// ============================================
// ADMIN PANEL ENHANCEMENTS (tabs, appearance, tags, guestbook, messages)
// ============================================
let adminTags = ['Node.js', 'Firebase Sync', 'Discord Bot'];

function initAdminEnhancements() {
    // Tab switching
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.atab;
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.toggle('active', p.id === `atab-${tab}`));
            if (typeof UI !== 'undefined') UI.Sound.play('click');
            if (tab === 'guestbook') renderAdminGuestbook();
            if (tab === 'messages') loadAdminMessages();
        });
    });

    // Appearance controls
    const themeBtn = document.getElementById('admin-theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', () => { if (typeof UI !== 'undefined') UI.Theme.toggle(); });
    const soundBtn = document.getElementById('admin-sound-btn');
    if (soundBtn) soundBtn.addEventListener('click', () => { if (typeof UI !== 'undefined') UI.Sound.toggle(); });
    const siteLockBtn = document.getElementById('admin-sitelock-btn');
    if (siteLockBtn) siteLockBtn.addEventListener('click', () => {
        toggleAdminModal(false);
        if (typeof Security !== 'undefined' && Security.SiteLock) Security.SiteLock.lock();
    });

    const accentRow = document.getElementById('admin-accent-row');
    if (accentRow && typeof UI !== 'undefined') {
        const ACCENTS = { green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4' };
        accentRow.innerHTML = '';
        Object.entries(ACCENTS).forEach(([name, hex]) => {
            const sw = document.createElement('div');
            sw.className = 'accent-swatch' + (UI.Theme.getAccent() === name ? ' selected' : '');
            sw.dataset.accent = name;
            sw.style.background = hex;
            sw.title = name;
            sw.addEventListener('click', () => { UI.Theme.setAccent(name); });
            accentRow.appendChild(sw);
        });
    }

    // Tags editor
    const tagAdd = document.getElementById('admin-tag-add');
    const tagInput = document.getElementById('admin-tag-input');
    const addTag = () => {
        const v = (tagInput?.value || '').trim();
        if (v && !adminTags.includes(v)) { adminTags.push(v); renderAdminTags(); }
        if (tagInput) tagInput.value = '';
    };
    if (tagAdd) tagAdd.addEventListener('click', addTag);
    if (tagInput) tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } });

    const tagsSave = document.getElementById('admin-tags-save');
    if (tagsSave) tagsSave.addEventListener('click', async () => {
        applyTagsToUI(adminTags);
        const result = await FirestoreDB.saveSettings({ tags: adminTags.slice() });
        if (typeof UI !== 'undefined') UI.toast(result.source === 'firestore' ? 'Tags synced' : 'Tags saved locally', result.source === 'firestore' ? 'success' : 'info');
    });
    renderAdminTags();

    // Messages refresh
    const msgRefresh = document.getElementById('admin-messages-refresh');
    if (msgRefresh) msgRefresh.addEventListener('click', loadAdminMessages);
}

function renderAdminTags() {
    const box = document.getElementById('admin-tags-editor');
    if (!box) return;
    box.innerHTML = '';
    if (!adminTags.length) { box.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No tags.</span>'; return; }
    adminTags.forEach((t, i) => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.innerHTML = `${escapeHtmlSafe(t)} <button title="Remove" data-i="${i}">✕</button>`;
        span.querySelector('button').addEventListener('click', () => { adminTags.splice(i, 1); renderAdminTags(); });
        box.appendChild(span);
    });
}

function applyTagsToUI(tags) {
    const container = document.getElementById('tags-container');
    if (!container || !Array.isArray(tags)) return;
    container.innerHTML = tags.map(t => `<span class="tag">${escapeHtmlSafe(t)}</span>`).join('');
}

function renderAdminGuestbook() {
    const list = document.getElementById('admin-guestbook-list');
    if (!list) return;
    const entries = JSON.parse(localStorage.getItem('doni_guestbook') || '[]');
    if (!entries.length) { list.innerHTML = '<div class="admin-list-empty">No guestbook entries.</div>'; return; }
    list.innerHTML = '';
    entries.slice().reverse().forEach((e) => {
        const realIndex = entries.indexOf(e);
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.innerHTML = `<div><strong>${escapeHtmlSafe(e.name)}</strong><div class="meta">${new Date(e.date).toLocaleString()}</div><div style="margin-top:4px;">${escapeHtmlSafe(e.message)}</div></div>`;
        const del = document.createElement('button');
        del.className = 'admin-del-btn';
        del.textContent = 'Delete';
        del.addEventListener('click', () => {
            const arr = JSON.parse(localStorage.getItem('doni_guestbook') || '[]');
            arr.splice(realIndex, 1);
            localStorage.setItem('doni_guestbook', JSON.stringify(arr));
            renderAdminGuestbook();
            if (typeof UI !== 'undefined') UI.toast('Guestbook entry deleted', 'success');
        });
        item.appendChild(del);
        list.appendChild(item);
    });
}

async function loadAdminMessages() {
    const list = document.getElementById('admin-messages-list');
    if (!list) return;
    if (!firebaseReady || !db) {
        list.innerHTML = '<div class="admin-list-empty">Firebase offline — messages unavailable.</div>';
        return;
    }
    list.innerHTML = '<div class="admin-list-empty">Loading…</div>';
    try {
        const snap = await db.collection('messages').orderBy('timestamp', 'desc').limit(50).get();
        if (snap.empty) { list.innerHTML = '<div class="admin-list-empty">No messages yet.</div>'; return; }
        list.innerHTML = '';
        snap.forEach(doc => {
            const m = doc.data();
            const when = m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString() : '';
            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `<div><strong>${escapeHtmlSafe(m.name || 'Anon')}</strong> <span class="meta">${escapeHtmlSafe(m.email || '')}</span><div class="meta">${escapeHtmlSafe(m.subject || '')} · ${when}</div><div style="margin-top:4px;">${escapeHtmlSafe(m.message || '')}</div></div>`;
            const del = document.createElement('button');
            del.className = 'admin-del-btn';
            del.textContent = 'Delete';
            del.addEventListener('click', async () => {
                try { await db.collection('messages').doc(doc.id).delete(); loadAdminMessages(); if (typeof UI !== 'undefined') UI.toast('Message deleted', 'success'); }
                catch (err) { if (typeof UI !== 'undefined') UI.toast('Delete failed (check rules)', 'error'); }
            });
            item.appendChild(del);
            list.appendChild(item);
        });
    } catch (err) {
        console.error('[Admin] messages load error:', err);
        list.innerHTML = '<div class="admin-list-empty">Could not load messages (check Firestore rules).</div>';
    }
}

function escapeHtmlSafe(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
}

// ============================================
// INTERACTIVE PREVIEW (Index Page)
// ============================================
function initPreviewControls() {
    let demoCounter = 0;
    const demoPingBtn = document.getElementById('demo-ping-btn');
    const demoResetBtn = document.getElementById('demo-reset-btn');
    const togglePreviewBtn = document.getElementById('toggle-preview-mode');

    if (demoPingBtn) {
        demoPingBtn.addEventListener('click', () => {
            demoCounter++;
            const stateVal = document.getElementById('demo-state-val');
            const widgetPill = document.getElementById('demo-widget-pill');
            if (stateVal) stateVal.innerText = `SYNC_PULSE_#${demoCounter} (OK)`;
            if (widgetPill) widgetPill.innerText = `PULSED (${demoCounter})`;
            Core.SystemLogs.write(`Manual pulse event triggered (#${demoCounter}).`);
        });
    }

    if (demoResetBtn) {
        demoResetBtn.addEventListener('click', () => {
            demoCounter = 0;
            const stateVal = document.getElementById('demo-state-val');
            const widgetPill = document.getElementById('demo-widget-pill');
            if (stateVal) stateVal.innerText = `ACTIVE_ONLINE`;
            if (widgetPill) widgetPill.innerText = `LIVE SYNC OK`;
        });
    }

    if (togglePreviewBtn) {
        togglePreviewBtn.addEventListener('click', () => {
            const label = document.getElementById('preview-tab-label');
            const widgetTitle = document.getElementById('demo-widget-title');
            if (label && label.innerText.includes('Sandbox')) {
                label.innerText = "Firebase Metrics Telemetry";
                if (widgetTitle) widgetTitle.innerText = "Real-time Node Telemetry";
            } else if (label) {
                label.innerText = "Core Runtime Sandbox";
                if (widgetTitle) widgetTitle.innerText = "Firebase Realtime Sync";
            }
        });
    }
}

// ============================================
// LOAD PERSISTED STATE (with Firebase priority)
// ============================================
async function loadPersistedState() {
    // First, try to load from localStorage for immediate display
    const localData = localStorage.getItem('doni_admin_state');
    if (localData) {
        try {
            applySettingsToUI(JSON.parse(localData));
        } catch (e) { }
    }

    // Then, if Firebase is ready, load from Firestore (will override via real-time listener)
    if (firebaseReady) {
        const firestoreData = await FirestoreDB.loadSettings();
        if (firestoreData) {
            applySettingsToUI(firestoreData);
        }
    }
}

// ============================================
// CONTACT FORM HANDLER
// ============================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    if (typeof Security !== 'undefined') {
        Security.FormGuard.initCaptcha();
        const refreshBtn = document.getElementById('captcha-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                Security.FormGuard.refreshAfterSubmit();
            });
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name')?.value || '';
        const email = document.getElementById('contact-email')?.value || '';
        const subject = document.getElementById('contact-subject')?.value || 'No subject';
        const message = document.getElementById('contact-message')?.value || '';
        const statusEl = document.getElementById('form-status');

        if (typeof Security !== 'undefined') {
            const guard = Security.FormGuard.validate();
            if (!guard.ok) {
                if (statusEl) {
                    statusEl.innerText = guard.error;
                    statusEl.style.color = '#ef4444';
                }
                Security.FormGuard.refreshAfterSubmit();
                return;
            }
        }

        if (!name || !email || !message) {
            if (statusEl) {
                statusEl.innerText = 'Please fill all required fields.';
                statusEl.style.color = '#ef4444';
            }
            return;
        }

        if (statusEl) {
            statusEl.innerText = 'Sending...';
            statusEl.style.color = '#eab308';
        }

        // Save to Firestore
        if (firebaseReady && db) {
            try {
                await db.collection('messages').add({
                    name,
                    email,
                    subject,
                    message,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });

                if (statusEl) {
                    statusEl.innerText = 'Message sent successfully! I\'ll get back to you soon.';
                    statusEl.style.color = '#22c55e';
                }
                form.reset();
                if (typeof Security !== 'undefined') Security.FormGuard.refreshAfterSubmit();
                Core.SystemLogs.write(`<span style="color:#22c55e;">✓</span> Message from ${name} saved to Firebase.`);
            } catch (error) {
                console.error('[Contact] Save error:', error);
                if (statusEl) {
                    statusEl.innerText = 'Error sending message. Please try again.';
                    statusEl.style.color = '#ef4444';
                }
            }
        } else {
            // Fallback - just show success (no actual storage)
            setTimeout(() => {
                if (statusEl) {
                    statusEl.innerText = 'Message sent! (Demo mode - Firebase offline)';
                    statusEl.style.color = '#22c55e';
                }
                form.reset();
                if (typeof Security !== 'undefined') Security.FormGuard.refreshAfterSubmit();
                Core.SystemLogs.write(`Contact form submitted by ${name}. (Local only)`);
            }, 1000);
        }
    });
}

// ============================================
// SERVICE WORKER (PWA offline support)
// ============================================
function registerServiceWorker() {
    if (isLocal) return; // service workers require http(s)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.warn('[PWA] Service worker registration failed:', err);
            });
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    // UI + site lock first (site lock may hide everything before anything else runs)
    if (typeof UI !== 'undefined') UI.init();
    if (typeof Security !== 'undefined' && Security.SiteLock) Security.SiteLock.init();

    Core.SystemLogs.init();
    bindCardGlow();
    initCardReveal();
    initCommandPalette();
    initHubTabs();
    initAdminPanel();
    initPreviewControls();
    initContactForm();
    registerServiceWorker();

    if (typeof Security !== 'undefined') {
        Security.initAdminGate();
    }
    if (typeof Features !== 'undefined') {
        Features.init();
    }

    // Initialize Firebase after a short delay to ensure DOM is ready
    setTimeout(() => {
        initFirebase();
        loadPersistedState();
    }, 100);

    updateTime();
    updateLatency();
    fetchGithubActivity();

    setInterval(updateTime, 1000);
    setInterval(updateLatency, 5000);
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
