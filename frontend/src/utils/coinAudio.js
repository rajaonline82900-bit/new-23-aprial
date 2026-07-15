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
  return _ctx;
}

let _muted = false;
export const setCoinMuted = (v) => { _muted = !!v; };
export const isCoinMuted = () => _muted;

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

/** Old-clock TICK — short, dry, mechanical. */
export function playClockTick() {
  if (_muted) return;
  const c = ctx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    // Alternate hi/lo tick-tock feel via odd/even seconds
    const hi = Math.floor(now * 10) % 2 === 0;
    o.frequency.setValueAtTime(hi ? 2100 : 1700, now);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.20, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + 0.07);
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
