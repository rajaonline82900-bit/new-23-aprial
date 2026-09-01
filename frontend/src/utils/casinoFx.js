// Casino audio + confetti helpers.
// All sounds are synthesized via Web Audio API — no external files, no
// autoplay-policy issues (they only trigger after a user gesture reaches
// the page: navigation, first click, etc.). Confetti uses `canvas-confetti`.

import confetti from 'canvas-confetti';

const MUTE_KEY = 'shiv_shakti_sound_muted';

export const isMuted = () => {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
};

export const setMuted = (v) => {
  try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event('shiv-shakti-mute-changed')); } catch { /* ignore */ }
};

let _audioCtx = null;
const getAudio = () => {
  if (typeof window === 'undefined') return null;
  if (isMuted()) return null;
  try {
    if (!_audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _audioCtx = new Ctx();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch { return null; }
};

// ────────────────────────────────────────────────────────────────────────────
// Card flip whoosh — short filtered-noise burst pitched down
export const playCardFlip = () => {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Noise buffer
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2400, now);
  bp.frequency.exponentialRampToValueAtTime(600, now + 0.22);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.28);
};

// Metallic bell "cha-ching" — three descending sine chirps
export const playCoinClink = () => {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [
    { f: 1568, d: 0.0, dur: 0.35 }, // G6
    { f: 2093, d: 0.08, dur: 0.35 }, // C7
    { f: 1319, d: 0.16, dur: 0.55 }, // E6 (tail)
  ];
  notes.forEach(({ f, d, dur }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + d);
    osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + d + dur);
    g.gain.setValueAtTime(0.0001, now + d);
    g.gain.exponentialRampToValueAtTime(0.35, now + d + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(now + d);
    osc.stop(now + d + dur + 0.05);
  });
};

// Lock click — dry high-pass click for "bets locked" moment
export const playLockClick = () => {
  const ctx = getAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.32, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
};

// ────────────────────────────────────────────────────────────────────────────
// Gold-themed confetti burst — three staggered shots from bottom corners.
export const fireWinnerConfetti = () => {
  if (typeof window === 'undefined') return;
  const colors = ['#FFD700', '#FDE047', '#FBBF24', '#DC2626', '#22C55E', '#FFFFFF'];
  const common = { spread: 90, ticks: 220, gravity: 0.9, decay: 0.92, startVelocity: 55, colors };
  confetti({ ...common, particleCount: 90, origin: { x: 0.15, y: 0.9 }, angle: 70 });
  confetti({ ...common, particleCount: 90, origin: { x: 0.85, y: 0.9 }, angle: 110 });
  setTimeout(() => {
    confetti({ ...common, particleCount: 140, spread: 130, origin: { x: 0.5, y: 0.7 }, startVelocity: 45 });
  }, 220);
};
