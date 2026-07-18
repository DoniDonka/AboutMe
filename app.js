/**
 * DONI | DEV - Core Application Engine
 * Version: 1.2
 * Vanilla JS - No frameworks
 */

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
            'home': 'Navigate to Dashboard.',
            'projects': 'Navigate to Projects page.',
            'about': 'Navigate to About page.',
            'contact': 'Navigate to Contact page.'
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
                Core.SystemLogs.write("Subsystems: operational.<br>Database Instance: connected.");
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
                Core.SystemLogs.write("Firebase Sync: Subscribed to 'dashboard/state'.");
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
        display.innerText = `[LOG] Sync Status: Local Sandbox Mode Active`;
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
// COMMAND PALETTE
// ============================================
function initCommandPalette() {
    const pal = document.getElementById('cmd-palette');
    const cmdInput = document.getElementById('cmd-input');
    if (!pal || !cmdInput) return;

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            pal.style.display = (pal.style.display === 'flex') ? 'none' : 'flex';
            if (pal.style.display === 'flex') {
                cmdInput.focus();
            }
        }
        if (e.key === 'Escape') {
            pal.style.display = 'none';
            toggleAdminModal(false);
        }
    });

    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const inputVal = e.target.value;
            Core.Commands.execute(inputVal);
            e.target.value = '';
            pal.style.display = 'none';
        }
    });
}

function selectCmd(cmdName) {
    const cmdInput = document.getElementById('cmd-input');
    const pal = document.getElementById('cmd-palette');
    if (cmdInput) cmdInput.value = cmdName;
    Core.Commands.execute(cmdName);
    if (pal) pal.style.display = 'none';
    if (cmdInput) cmdInput.value = '';
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
}

function initAdminPanel() {
    const logoBtn = document.getElementById('logo-btn');
    const statusBtn = document.getElementById('status-btn');
    const closeAdminBtn = document.getElementById('close-admin-btn');
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const saveAdminBtn = document.getElementById('save-admin-btn');

    if (logoBtn) logoBtn.addEventListener('click', () => toggleAdminModal(true));
    if (statusBtn) statusBtn.addEventListener('click', () => toggleAdminModal(true));
    if (closeAdminBtn) closeAdminBtn.addEventListener('click', () => toggleAdminModal(false));
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', () => Core.SystemLogs.clear());

    if (saveAdminBtn) {
        saveAdminBtn.addEventListener('click', () => {
            const title = document.getElementById('admin-proj-title')?.value || '';
            const desc = document.getElementById('admin-proj-desc')?.value || '';
            const status = document.getElementById('admin-status-select')?.value || 'Active';
            const discord = document.getElementById('admin-discord-msg')?.value || '';

            const titleEl = document.getElementById('project-title-heading');
            const descEl = document.getElementById('project-desc-text');
            const statusTextEl = document.getElementById('status-text');
            const discordEl = document.getElementById('discord-activity-txt');

            if (titleEl) titleEl.innerText = title;
            if (descEl) descEl.innerText = desc;
            if (statusTextEl) statusTextEl.innerText = status;
            if (discordEl) discordEl.innerText = discord;

            const dot = document.getElementById('status-dot');
            if (dot) {
                if (status === 'Active') {
                    dot.style.background = '#22c55e';
                    dot.style.boxShadow = '0 0 10px #22c55e';
                } else if (status === 'Building') {
                    dot.style.background = '#eab308';
                    dot.style.boxShadow = '0 0 10px #eab308';
                } else {
                    dot.style.background = '#ef4444';
                    dot.style.boxShadow = '0 0 10px #ef4444';
                }
            }

            localStorage.setItem('doni_admin_state', JSON.stringify({ title, desc, status, discord }));
            Core.SystemLogs.write("Admin settings saved & synced.");
            toggleAdminModal(false);
        });
    }
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
// LOAD PERSISTED STATE
// ============================================
function loadPersistedState() {
    const saved = localStorage.getItem('doni_admin_state');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const titleEl = document.getElementById('project-title-heading');
            const descEl = document.getElementById('project-desc-text');
            const statusTextEl = document.getElementById('status-text');
            const discordEl = document.getElementById('discord-activity-txt');

            if (data.title && titleEl) titleEl.innerText = data.title;
            if (data.desc && descEl) descEl.innerText = data.desc;
            if (data.status && statusTextEl) statusTextEl.innerText = data.status;
            if (data.discord && discordEl) discordEl.innerText = data.discord;

            if (data.status) {
                const dot = document.getElementById('status-dot');
                if (dot) {
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
            }
        } catch (e) { }
    }
}

// ============================================
// CONTACT FORM HANDLER
// ============================================
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('contact-name')?.value || '';
        const email = document.getElementById('contact-email')?.value || '';
        const message = document.getElementById('contact-message')?.value || '';
        const statusEl = document.getElementById('form-status');

        if (!name || !email || !message) {
            if (statusEl) {
                statusEl.innerText = 'Please fill all fields.';
                statusEl.style.color = '#ef4444';
            }
            return;
        }

        // Simulate send (replace with actual API call later)
        if (statusEl) {
            statusEl.innerText = 'Sending...';
            statusEl.style.color = '#eab308';
        }

        setTimeout(() => {
            if (statusEl) {
                statusEl.innerText = 'Message sent successfully! I\'ll get back to you soon.';
                statusEl.style.color = '#22c55e';
            }
            form.reset();
            Core.SystemLogs.write(`Contact form submitted by ${name}.`);
        }, 1200);
    });
}

// ============================================
// INITIALIZATION
// ============================================
function init() {
    Core.SystemLogs.init();
    bindCardGlow();
    initCommandPalette();
    initHubTabs();
    initAdminPanel();
    initPreviewControls();
    initContactForm();
    loadPersistedState();

    updateTime();
    updateLatency();
    fetchGithubActivity();

    setInterval(updateTime, 1000);
    setInterval(updateLatency, 5000);
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', init);
