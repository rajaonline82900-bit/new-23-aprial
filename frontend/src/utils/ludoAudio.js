/**
 * Tiny Web Audio API utility for Ludo — no external deps, no MP3 files.
 * Synthesizes short pleasant tones for dice rolls, captures, wins, etc.
 * Also provides a lightweight looping "tune" for the game screen.
 */

let ctx = null;
let musicGain = null;
let musicTimer = null;
let muted = false;

function _ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function _resume() {
  if (ctx && ctx.state === 'suspended') {
    try { ctx.resume(); } catch { /* ignore */ }
  }
}

function _tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.25, ramp = true }) {
  const c = _ensureCtx();
  if (!c || muted) return;
  _resume();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  if (ramp) {
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.setValueAtTime(gain, t);
  }
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function _seq(notes) {
  const c = _ensureCtx();
  if (!c || muted) return;
  _resume();
  let start = 0;
  notes.forEach((n) => {
    setTimeout(() => _tone(n), start * 1000);
    start += n.dur * 0.85;
  });
}

// ---------- Public SFX ----------
export const playDiceRoll = () => {
  const c = _ensureCtx();
  if (!c || muted) return;
  _resume();
  // Quick rattle: rapid random-freq clicks
  for (let i = 0; i < 6; i++) {
    setTimeout(() => _tone({
      freq: 200 + Math.random() * 600,
      dur: 0.05,
      type: 'square',
      gain: 0.15,
    }), i * 45);
  }
};

export const playTokenMove = () => _tone({ freq: 660, dur: 0.09, type: 'triangle', gain: 0.15 });

export const playCapture = () => _seq([
  { freq: 500, dur: 0.12, type: 'sawtooth', gain: 0.22 },
  { freq: 350, dur: 0.14, type: 'sawtooth', gain: 0.22 },
  { freq: 200, dur: 0.20, type: 'sawtooth', gain: 0.22 },
]);

export const playTokenHome = () => _seq([
  { freq: 660, dur: 0.10, type: 'sine', gain: 0.25 },
  { freq: 880, dur: 0.12, type: 'sine', gain: 0.25 },
  { freq: 1100, dur: 0.18, type: 'sine', gain: 0.25 },
]);

export const playWin = () => _seq([
  { freq: 523, dur: 0.15, type: 'sine', gain: 0.28 },   // C5
  { freq: 659, dur: 0.15, type: 'sine', gain: 0.28 },   // E5
  { freq: 784, dur: 0.15, type: 'sine', gain: 0.28 },   // G5
  { freq: 1046, dur: 0.35, type: 'sine', gain: 0.30 },  // C6
]);

export const playLose = () => _seq([
  { freq: 400, dur: 0.20, type: 'triangle', gain: 0.22 },
  { freq: 300, dur: 0.20, type: 'triangle', gain: 0.22 },
  { freq: 200, dur: 0.35, type: 'triangle', gain: 0.22 },
]);

// ---------- Background music (subtle 4-note loop) ----------
// Cheerful C-major arpeggio: C E G C — repeats every ~4 sec at low volume.
export const startMusic = () => {
  const c = _ensureCtx();
  if (!c || musicTimer || muted) return;
  _resume();
  musicGain = c.createGain();
  musicGain.gain.setValueAtTime(0.05, c.currentTime); // very low
  musicGain.connect(c.destination);

  const loop = () => {
    if (muted) return;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C4 E4 G4 C5
    const noteDur = 0.6;
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * noteDur;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + noteDur - 0.05);
      osc.connect(g).connect(musicGain);
      osc.start(t);
      osc.stop(t + noteDur);
    });
  };
  loop();
  musicTimer = setInterval(loop, 2600);
};

export const stopMusic = () => {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicGain) {
    try { musicGain.disconnect(); } catch { /* ignore */ }
    musicGain = null;
  }
};

export const setMuted = (v) => {
  muted = !!v;
  if (muted) stopMusic();
};

export const isMuted = () => muted;
