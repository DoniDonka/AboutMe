/* DONI | DEV — Badge Engine v3.4 */
(function() {
    const STORAGE_KEY = 'doni_badges';
    const EGG_KEY = 'doni_eggs_found';
    const BADGES = [
        { id: 'first-steps', name: 'First Steps', icon: '🚀', desc: 'Visit the site for the first time', unlocked: true },
        { id: 'explorer', name: 'Explorer', icon: '🗺️', desc: 'Visit 3+ different pages in one session', unlocked: false },
        { id: 'veteran', name: 'Veteran', icon: '⏱️', desc: 'Spend 5+ minutes on the site', unlocked: false },
        { id: 'commander', name: 'Commander', icon: '⌨️', desc: 'Use 5+ terminal commands', unlocked: false },
        { id: 'konami', name: 'Konami Code', icon: '🎮', desc: 'Enter the Konami code', unlocked: false },
        { id: 'night-owl', name: 'Night Owl', icon: '🌙', desc: 'Visit between midnight and 5am', unlocked: false },
        { id: 'signed', name: 'Signed', icon: '✍️', desc: 'Sign the guestbook', unlocked: false },
        { id: 'palette', name: 'Palette Pro', icon: '🎨', desc: 'Change the accent color 5+ times', unlocked: false },
        { id: 'flipper', name: 'Theme Flipper', icon: '☀️', desc: 'Toggle light/dark theme 10+ times', unlocked: false },
        { id: 'red-pill', name: 'Red Pill', icon: '💊', desc: 'Find the hidden admin page', unlocked: false },
        { id: 'easter-hunter', name: 'Egg Hunter', icon: '🥚', desc: 'Find all 5 hidden easter eggs', unlocked: false },
        { id: 'chatter', name: 'Chatter', icon: '💬', desc: 'Send 10+ chat messages', unlocked: false },
        { id: 'stylist', name: 'Stylist', icon: '🎭', desc: 'Change chat theme color', unlocked: false },
        { id: 'audiophile', name: 'Audiophile', icon: '🔊', desc: 'Enable soundscape', unlocked: false },
        { id: 'socialite', name: 'Socialite', icon: '🌟', desc: 'Use a chat reaction', unlocked: false }
    ];

    let unlocked = new Set();
    try { unlocked = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch (e) {}

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked])); }

    function unlock(id) {
        if (unlocked.has(id)) return;
        const badge = BADGES.find(b => b.id === id);
        if (!badge) return;
        unlocked.add(id); save();
        const toast = document.createElement('div');
        toast.className = 'badge-toast';
        toast.innerHTML = '<div class="badge-toast-icon">' + badge.icon + '</div><div class="badge-toast-text"><strong>Achievement Unlocked!</strong><span>' + badge.name + ' — ' + badge.desc + '</span></div>';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3500);
        if (window.DONI_SFX) window.DONI_SFX.success();
        updateBadgeUI();
    }

    function updateBadgeUI() {
        document.querySelectorAll('[data-badge-id]').forEach(el => {
            const id = el.dataset.badgeId;
            el.classList.toggle('unlocked', unlocked.has(id));
            el.classList.toggle('locked', !unlocked.has(id));
            const progress = el.querySelector('.badge-progress');
            if (progress) progress.style.width = unlocked.has(id) ? '100%' : '0%';
        });
        const counter = document.getElementById('badge-count');
        if (counter) counter.textContent = unlocked.size + '/' + BADGES.length;
    }

    function renderBadges(container) {
        if (!container) return;
        container.innerHTML = BADGES.map(b => {
            const isUnlocked = unlocked.has(b.id);
            return '<div class="badge-card ' + (isUnlocked ? 'unlocked' : 'locked') + '" data-badge-id="' + b.id + '"><div class="badge-icon">' + b.icon + '</div><div class="badge-name">' + b.name + '</div><div class="badge-desc">' + b.desc + '</div><div class="badge-progress-bar"><div class="badge-progress" style="width:' + (isUnlocked ? '100%' : '0%') + '"></div></div></div>';
        }).join('');
    }

    // Easter egg tracking
    function checkEasterEggs() {
        const found = JSON.parse(localStorage.getItem(EGG_KEY) || '[]');
        if (found.length >= 5) unlock('easter-hunter');
    }
    window.findEasterEgg = function(eggId) {
        const found = JSON.parse(localStorage.getItem(EGG_KEY) || '[]');
        if (!found.includes(eggId)) {
            found.push(eggId);
            localStorage.setItem(EGG_KEY, JSON.stringify(found));
            if (window.DONI_SFX) window.DONI_SFX.success();
        }
        checkEasterEggs();
    };

    // Chat message counter
    let chatCount = parseInt(localStorage.getItem('doni_chat_count') || '0');
    window.addEventListener('storage', (e) => {
        if (e.key === 'doni_chat_count') {
            chatCount = parseInt(e.newValue || '0');
            if (chatCount >= 10) unlock('chatter');
        }
    });

    // Sound badge
    if (localStorage.getItem('doni_sound') === 'true') unlock('audiophile');
    window.addEventListener('storage', (e) => {
        if (e.key === 'doni_sound' && e.newValue === 'true') unlock('audiophile');
    });

    // Auto-checks
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) unlock('night-owl');

    let cmdCount = 0;
    document.addEventListener('command-executed', () => { cmdCount++; if (cmdCount >= 5) unlock('commander'); });

    window.addEventListener('storage', (e) => {
        if (e.key === 'doni_theme_flips' && parseInt(e.newValue || '0') >= 10) unlock('flipper');
        if (e.key === 'doni_palette_changes' && parseInt(e.newValue || '0') >= 5) unlock('palette');
        if (e.key === 'doni_chat_theme') unlock('stylist');
        if (e.key === 'doni_chat_reaction') unlock('socialite');
    });

    window.unlockBadge = unlock;
    window.getBadges = () => BADGES.map(b => ({ ...b, unlocked: unlocked.has(b.id) }));
    window.renderBadges = renderBadges;

    document.addEventListener('DOMContentLoaded', () => {
        const grid = document.getElementById('badges-grid');
        if (grid) renderBadges(grid);
        updateBadgeUI();
        checkEasterEggs();
    });
})();
