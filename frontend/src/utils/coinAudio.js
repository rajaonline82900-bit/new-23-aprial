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

/** Realistic "coin flip" sound — combines a bright metallic ping with a warm
 *  brass ring undertone. Sounds like a real ₹10 coin flipped on marble. */
export function playCoinFlip() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;

    // ── Master output with limiter-ish envelope
    const master = c.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(0.45, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    master.connect(c.destination);

    // ── Layer 1: Bright high ping (the "ching")
    const ping = c.createOscillator();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(2400, now);
    ping.frequency.exponentialRampToValueAtTime(1100, now + 0.4);
    const pingGain = c.createGain();
    pingGain.gain.value = 0.6;
    ping.connect(pingGain).connect(master);
    ping.start(now);
    ping.stop(now + 0.5);

    // ── Layer 2: Warm brass mid-tone
    const brass = c.createOscillator();
    brass.type = 'sine';
    brass.frequency.setValueAtTime(1560, now);
    brass.frequency.exponentialRampToValueAtTime(780, now + 0.55);
    const brassGain = c.createGain();
    brassGain.gain.setValueAtTime(0.0001, now);
    brassGain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    brassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    brass.connect(brassGain).connect(master);
    brass.start(now);
    brass.stop(now + 0.65);

    // ── Layer 3: Sub metallic body (low resonance)
    const body = c.createOscillator();
    body.type = 'square';
    body.frequency.setValueAtTime(520, now);
    body.frequency.exponentialRampToValueAtTime(290, now + 0.4);
    const bodyGain = c.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.18, now + 0.01);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    body.connect(bodyGain).connect(master);
    body.start(now);
    body.stop(now + 0.42);

    // ── Layer 4: Attack click (short noise burst)
    const noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.015), c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    noise.connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 0.03);
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

/** Gentle "pluck" chime — replaces the irritating clock tick.
 *  Musical tone (D5 → A4 alternating) with soft harp-like attack + short reverb tail. */
let _tickAlt = false;
export function playClockTick() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    _tickAlt = !_tickAlt;
    // Musical note frequencies (D5=587.33, A4=440, F#4=369.99, D4=293.66)
    const freq = _tickAlt ? 587.33 : 440.0;

    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.18, now + 0.008);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    master.connect(c.destination);

    // Main harp-like tone
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, now);
    o.connect(master);
    o.start(now);
    o.stop(now + 0.30);

    // Subtle overtone (5th harmonic for warmth)
    const overtone = c.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 3, now);
    const ovGain = c.createGain();
    ovGain.gain.setValueAtTime(0.0001, now);
    ovGain.gain.linearRampToValueAtTime(0.06, now + 0.01);
    ovGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);
    overtone.connect(ovGain).connect(c.destination);
    overtone.start(now);
    overtone.stop(now + 0.22);
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
