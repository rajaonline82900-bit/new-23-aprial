// Web Audio API sound helpers for Coin Toss — no external file, tiny synth.
// Kept in-file (no external assets) so it works offline in APK webview too.

let _ctx = null;
function ctx() {
  if (!_ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      _ctx = new AC();
    } catch (_) { _ctx = null; }
  }
  // Auto-resume if suspended (mobile browsers require user gesture)
  if (_ctx && _ctx.state === 'suspended') {
    try { _ctx.resume(); } catch (_) { /* silent */ }
  }
  return _ctx;
}

/** Call once from a user-gesture handler (click, tap) to unlock audio on
 * iOS/Android browsers. Safe to call multiple times. */
export function unlockCoinAudio() {
  const c = ctx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    // Play an inaudible silent tick to fully unlock the context
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.01);
  } catch (_) { /* silent */ }
}

let _muted = false;         // component-mute (hard-off when not on coin page)
let _userMuted = false;     // user's explicit preference (persists across mounts)
export const setCoinMuted = (v) => { _muted = !!v; };
export const setCoinUserMuted = (v) => { _userMuted = !!v; _muted = !!v; };
export const isCoinMuted = () => _muted;
export const isCoinUserMuted = () => _userMuted;

/** Bright metallic "ching" — used when coin lands or is flipped. */
export function playCoinFlip() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    // First short high ping
    const now = c.currentTime;
    const master = c.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(0.35, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    master.connect(c.destination);

    // Two overlapping detuned oscillators for a metallic sound
    [1300, 1620].forEach((freq, i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? 'triangle' : 'square';
      o.frequency.setValueAtTime(freq, now);
      o.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.45);
      const g = c.createGain();
      g.gain.value = i === 0 ? 0.8 : 0.35;
      o.connect(g).connect(master);
      o.start(now);
      o.stop(now + 0.5);
    });
  } catch (_) { /* audio unsupported */ }
}

/** Rapid "spinning" whirr while coin is flipping (call every ~150ms). */
export function playCoinSpin() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420 + Math.random() * 250, now);
    o.frequency.exponentialRampToValueAtTime(280, now + 0.13);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.10, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.16);
  } catch (_) { /* audio unsupported */ }
}

/** Mechanical clock TICK — sharp attack, quick decay, alternating hi/lo pitch
 *  to give a real "tick-tock" feel. */
let _tickAlt = false;
export function playClockTick() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    _tickAlt = !_tickAlt;
    const isTock = _tickAlt;   // alternate every call

    // Master gain envelope
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.32, now + 0.003);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    master.connect(c.destination);

    // Main pitched click (tick=high, tock=low)
    const o = c.createOscillator();
    o.type = 'square';
    const base = isTock ? 1400 : 2200;
    o.frequency.setValueAtTime(base, now);
    o.frequency.exponentialRampToValueAtTime(base * 0.4, now + 0.05);
    o.connect(master);
    o.start(now);
    o.stop(now + 0.10);

    // Add a short noise burst for the "click" attack (BufferSource of random noise)
    const noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.02), c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf;
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(0.35, now);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    noise.connect(nGain).connect(c.destination);
    noise.start(now);
    noise.stop(now + 0.03);
  } catch (_) { /* audio unsupported */ }
}

/** Win chime — short pleasant arpeggio. */
export function playCoinWin() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];   // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const t0 = now + i * 0.08;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t0);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.36);
    });
  } catch (_) { /* audio unsupported */ }
}
