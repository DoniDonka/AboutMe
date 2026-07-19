/* DONI | DEV — Soundscape v3.3 */
(function() {
    let audioCtx = null, droneNodes = [], isPlaying = false, masterGain = null;

    function soundEnabled() { return localStorage.getItem('doni_sound') === 'true'; }

    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.08;
        masterGain.connect(audioCtx.destination);
    }

    function startDrone() {
        if (!soundEnabled() || isPlaying) return;
        initAudio(); isPlaying = true;
        [110, 164.81, 196, 246.94].forEach((freq, i) => {
            const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
            const lfo = audioCtx.createOscillator(), lfoGain = audioCtx.createGain();
            osc.type = i % 2 === 0 ? 'sine' : 'triangle';
            osc.frequency.value = freq;
            lfo.frequency.value = 0.1 + (i * 0.05);
            lfoGain.gain.value = 2;
            lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
            gain.gain.value = 0;
            gain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 2);
            osc.connect(gain); gain.connect(masterGain);
            osc.start(); lfo.start();
            droneNodes.push({ osc, gain, lfo, lfoGain });
        });
    }

    function stopDrone() {
        if (!isPlaying) return;
        droneNodes.forEach(n => {
            try {
                n.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
                setTimeout(() => { n.osc.stop(); n.lfo.stop(); }, 1100);
            } catch (e) {}
        });
        droneNodes = []; isPlaying = false;
    }

    function playTone(freq, duration, vol, type) {
        if (!soundEnabled()) return;
        initAudio();
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.type = type; osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(masterGain);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    }

    const sfx = {
        hover: () => playTone(800, 0.02, 0.015, 'sine'),
        click: () => playTone(1200, 0.04, 0.02, 'sine'),
        toggle: () => playTone(600, 0.06, 0.025, 'triangle'),
        success: () => {
            playTone(523.25, 0.08, 0.03, 'sine');
            setTimeout(() => playTone(659.25, 0.08, 0.03, 'sine'), 80);
            setTimeout(() => playTone(783.99, 0.12, 0.03, 'sine'), 160);
        },
        error: () => {
            playTone(200, 0.15, 0.04, 'sawtooth');
            setTimeout(() => playTone(150, 0.15, 0.04, 'sawtooth'), 100);
        }
    };

    function attachSounds() {
        document.querySelectorAll('a, button, [role="button"], .bento-card').forEach(el => {
            el.addEventListener('mouseenter', () => sfx.hover());
            el.addEventListener('click', () => sfx.click());
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'doni_sound') {
            if (e.newValue === 'true') startDrone(); else stopDrone();
        }
    });

    window.DONI_SFX = sfx;
    window.DONI_DRONE = { start: startDrone, stop: stopDrone };

    if (soundEnabled()) {
        document.addEventListener('DOMContentLoaded', () => { startDrone(); attachSounds(); });
    }

    new MutationObserver(() => attachSounds()).observe(document.body, { childList: true, subtree: true });
})();
