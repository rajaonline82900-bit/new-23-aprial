import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Volume2, VolumeX, Trophy, RefreshCw } from 'lucide-react';

// ---------------- Demo credits (localStorage only, no real money) ----------------
const CREDITS_KEY = 'lb_cr_demo_credits';
const BEST_KEY = 'lb_cr_best_mult';
const HISTORY_KEY = 'lb_cr_history';
const SOUND_KEY = 'lb_cr_sound';
const DEFAULT_CREDITS = 5000;

const getStoredNum = (k, def) => {
  try { const v = parseFloat(localStorage.getItem(k)); return isNaN(v) ? def : v; }
  catch { return def; }
};
const setStored = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* noop */ } };

// ---------------- Game constants ----------------
const LANES = 8;                          // total lanes to cross
const MULTIPLIERS = [1.00, 1.20, 1.50, 2.00, 3.00, 5.00, 8.00, 12.00, 20.00]; // index = lanes crossed
const CHIP_STAKES = [20, 50, 100, 500];
const LANE_HEIGHT = 90;                   // px per lane
const CHICKEN_X = 60;                     // chicken fixed x (px from left within road)
const CHICKEN_HALF = 26;                  // collision radius
const HOP_DURATION = 350;                 // ms
const COLLISION_TOLERANCE = 34;           // px on each side of chicken center

const DIFFICULTY = {
  Easy:   { minSpeed: 60,  maxSpeed: 120, spawnMin: 1800, spawnMax: 3200 },
  Medium: { minSpeed: 100, maxSpeed: 200, spawnMin: 1200, spawnMax: 2400 },
  Hard:   { minSpeed: 160, maxSpeed: 320, spawnMin: 700,  spawnMax: 1500 },
};

// Vehicle types (rendered as small emoji-like SVG)
const VEHICLES = ['🚗', '🚕', '🚙', '🚐', '🚚', '🏎️', '🚑', '🚌'];

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ---------------- Chicken SVG (big cartoon) ----------------
const ChickenSVG = ({ dying = false, walking = false }) => (
  <svg viewBox="0 0 120 130" width="100%" height="100%" style={{ overflow: 'visible' }}>
    <defs>
      <radialGradient id="cbBody" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="70%" stopColor="#F3F4F6" />
        <stop offset="100%" stopColor="#D1D5DB" />
      </radialGradient>
      <radialGradient id="cbEye" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#FEF3C7" />
      </radialGradient>
    </defs>
    <g style={{ transformOrigin: '60px 100px' }}>
      <ellipse cx="60" cy="85" rx="45" ry="42" fill="url(#cbBody)" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M35 80 Q30 75 32 90 Q35 105 45 100 Q42 90 35 80 Z" fill="#E5E7EB" stroke="#0F172A" strokeWidth="2" />
      <circle cx="60" cy="42" r="30" fill="url(#cbBody)" stroke="#0F172A" strokeWidth="2.5" />
      <path d="M42 22 Q46 10 52 20 Q56 8 62 20 Q68 8 74 20 Q78 12 78 26 L48 26 Z"
            fill="#DC2626" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M56 58 Q58 68 62 62 Q60 68 66 62 Z" fill="#DC2626" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="48" cy="42" r="9" fill="url(#cbEye)" stroke="#0F172A" strokeWidth="2" />
      <circle cx="72" cy="42" r="9" fill="url(#cbEye)" stroke="#0F172A" strokeWidth="2" />
      <circle cx={dying ? '49' : '49'} cy={dying ? '46' : '43'} r={dying ? '5' : '4'} fill="#0F172A" />
      <circle cx={dying ? '73' : '73'} cy={dying ? '46' : '43'} r={dying ? '5' : '4'} fill="#0F172A" />
      {!dying && (<>
        <circle cx="50.5" cy="41.5" r="1.2" fill="#FFF" />
        <circle cx="74.5" cy="41.5" r="1.2" fill="#FFF" />
      </>)}
      {dying && (<>
        {/* X eyes */}
        <line x1="43" y1="37" x2="55" y2="49" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="55" y1="37" x2="43" y2="49" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="67" y1="37" x2="79" y2="49" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="79" y1="37" x2="67" y2="49" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
      </>)}
      <path d="M55 52 L65 52 L60 60 Z" fill="#FBBF24" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
      <g className={walking ? 'cb-walk' : ''}>
        <line x1="52" y1="122" x2="52" y2="128" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
        <line x1="68" y1="122" x2="68" y2="128" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
        <path d="M46 128 L52 128 L58 128" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M62 128 L68 128 L74 128" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </g>
  </svg>
);

// ---------------- Vehicle component ----------------
const Vehicle = ({ v }) => (
  <div className="absolute select-none" style={{
    left: v.x,
    top: v.y,
    width: 64,
    height: 40,
    transform: `translate(-50%, -50%) scaleX(${v.dir === 'left' ? -1 : 1})`,
    fontSize: 44,
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
    willChange: 'left',
    textAlign: 'center',
  }}>{v.type}</div>
);

// ---------------- Beeps (mini WebAudio) ----------------
const beep = (freq = 440, dur = 0.08, type = 'sine', vol = 0.15) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
    setTimeout(() => { try { ctx.close(); } catch { /* noop */ } }, (dur + 0.05) * 1000);
  } catch { /* noop */ }
};

const ChickenRoadPage = () => {
  // Persistent state
  const [credits, setCredits] = useState(() => getStoredNum(CREDITS_KEY, DEFAULT_CREDITS));
  const [bestMult, setBestMult] = useState(() => getStoredNum(BEST_KEY, 1.0));
  const [soundOn, setSoundOn] = useState(() => getStoredNum(SOUND_KEY, 1) === 1);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });

  // Game state
  const [phase, setPhase] = useState('idle'); // idle | playing | crashed | won
  const [stake, setStake] = useState(100);
  const [difficulty, setDifficulty] = useState('Easy');
  const [chickenLane, setChickenLane] = useState(0); // 0 = sidewalk, 1..LANES = crossed lanes
  const [hopping, setHopping] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [resultPopup, setResultPopup] = useState(null); // {type, mult, payout, stake}

  // Refs for animation loop
  const lastFrameRef = useRef(0);
  const rafRef = useRef(null);
  const spawnTimersRef = useRef([]);
  const roadRef = useRef(null);
  const immuneUntilRef = useRef(0);
  const chickenLaneRef = useRef(0);
  const phaseRef = useRef('idle');
  const vehiclesRef = useRef([]);

  useEffect(() => { chickenLaneRef.current = chickenLane; }, [chickenLane]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);

  useEffect(() => { setStored(CREDITS_KEY, credits); }, [credits]);
  useEffect(() => { setStored(BEST_KEY, bestMult); }, [bestMult]);
  useEffect(() => { setStored(SOUND_KEY, soundOn ? 1 : 0); }, [soundOn]);
  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30))); } catch { /* noop */ } }, [history]);

  const currentMult = MULTIPLIERS[chickenLane] || MULTIPLIERS[MULTIPLIERS.length - 1];
  const potentialPayout = Math.floor(stake * currentMult);

  const playBeep = useCallback((freq, dur) => { if (soundOn) beep(freq, dur); }, [soundOn]);

  // Spawn vehicles per lane
  const spawnVehicle = useCallback((lane, roadWidth) => {
    const cfg = DIFFICULTY[difficulty];
    const dir = Math.random() < 0.5 ? 'left' : 'right';
    const speed = rand(cfg.minSpeed, cfg.maxSpeed);
    const startX = dir === 'right' ? -60 : roadWidth + 60;
    const v = {
      id: Math.random().toString(36).slice(2, 9),
      lane,
      x: startX,
      y: 0, // set later based on lane position
      dir,
      speed,
      type: VEHICLES[randInt(0, VEHICLES.length - 1)],
    };
    setVehicles((vs) => [...vs, v]);
  }, [difficulty]);

  // Schedule per-lane spawn timers
  const scheduleSpawns = useCallback((roadWidth) => {
    // Clear existing
    spawnTimersRef.current.forEach((t) => clearTimeout(t));
    spawnTimersRef.current = [];
    const cfg = DIFFICULTY[difficulty];
    const scheduleOne = (lane) => {
      if (phaseRef.current !== 'playing') return;
      spawnVehicle(lane, roadWidth);
      const delay = rand(cfg.spawnMin, cfg.spawnMax);
      const t = setTimeout(() => scheduleOne(lane), delay);
      spawnTimersRef.current.push(t);
    };
    for (let lane = 1; lane <= LANES; lane++) {
      // stagger initial spawn a bit
      const initial = rand(200, cfg.spawnMax);
      const t = setTimeout(() => scheduleOne(lane), initial);
      spawnTimersRef.current.push(t);
    }
  }, [difficulty, spawnVehicle]);

  // Game loop — move vehicles and detect collision
  const loop = useCallback((ts) => {
    if (!lastFrameRef.current) lastFrameRef.current = ts;
    const dt = (ts - lastFrameRef.current) / 1000;
    lastFrameRef.current = ts;

    if (phaseRef.current === 'playing') {
      const roadEl = roadRef.current;
      if (!roadEl) { rafRef.current = requestAnimationFrame(loop); return; }
      const roadWidth = roadEl.clientWidth;

      // Update vehicle positions
      let crashed = false;
      const nowVehicles = vehiclesRef.current;
      const updated = [];
      for (const v of nowVehicles) {
        const dx = v.speed * dt * (v.dir === 'right' ? 1 : -1);
        const newX = v.x + dx;
        // Cull vehicles off-screen
        if ((v.dir === 'right' && newX > roadWidth + 80) ||
            (v.dir === 'left' && newX < -80)) continue;

        const newV = { ...v, x: newX };
        updated.push(newV);

        // Collision check: chicken is on this lane, not immune, not currently hopping mid-air
        if (v.lane === chickenLaneRef.current
            && chickenLaneRef.current > 0
            && ts > immuneUntilRef.current) {
          if (Math.abs(newX - CHICKEN_X) < COLLISION_TOLERANCE) {
            crashed = true;
          }
        }
      }
      setVehicles(updated);

      if (crashed) {
        onCrash();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start game
  const startGame = () => {
    if (phase === 'playing') return;
    if (stake > credits) { toast.error('Not enough demo credits'); return; }
    if (stake < 20) { toast.error('Min stake 20'); return; }
    setCredits((c) => c - stake);
    setChickenLane(0);
    setVehicles([]);
    setResultPopup(null);
    immuneUntilRef.current = 0;
    setPhase('playing');
    phaseRef.current = 'playing';
    playBeep(660, 0.1);
    // Kick off spawns
    setTimeout(() => {
      const w = roadRef.current?.clientWidth || 300;
      scheduleSpawns(w);
    }, 100);
  };

  // On CROSS tap — chicken hops to next lane
  const crossLane = () => {
    if (phase !== 'playing' || hopping) return;
    if (chickenLane >= LANES) return;
    setHopping(true);
    immuneUntilRef.current = performance.now() + HOP_DURATION + 30;
    playBeep(880, 0.05);
    setTimeout(() => {
      setChickenLane((l) => {
        const nl = l + 1;
        chickenLaneRef.current = nl;
        // Immediate collision check after landing
        setTimeout(() => {
          if (phaseRef.current !== 'playing') return;
          const vs = vehiclesRef.current;
          const hit = vs.some((v) => v.lane === nl && Math.abs(v.x - CHICKEN_X) < COLLISION_TOLERANCE);
          if (hit) onCrash();
        }, 30);
        // Won?
        if (nl >= LANES) {
          setTimeout(() => onCashout(true), 60);
        }
        return nl;
      });
      setHopping(false);
    }, HOP_DURATION);
  };

  // Collect / cashout
  const onCashout = (auto = false) => {
    if (phaseRef.current !== 'playing') return;
    const mult = MULTIPLIERS[chickenLaneRef.current] || 1.0;
    const payout = Math.floor(stake * mult);
    setPhase('won');
    phaseRef.current = 'won';
    setCredits((c) => c + payout);
    setBestMult((b) => Math.max(b, mult));
    setHistory((h) => [{ ts: Date.now(), stake, mult, payout, status: 'won' }, ...h].slice(0, 30));
    setResultPopup({ type: auto ? 'jackpot' : 'won', mult, payout, stake });
    playBeep(1200, 0.15, 'triangle');
    setTimeout(() => playBeep(1600, 0.15, 'triangle'), 100);
    cleanup();
  };

  const onCrash = () => {
    if (phaseRef.current !== 'playing') return;
    setPhase('crashed');
    phaseRef.current = 'crashed';
    setHistory((h) => [{ ts: Date.now(), stake, mult: 0, payout: 0, status: 'lost' }, ...h].slice(0, 30));
    setResultPopup({ type: 'crashed', mult: 0, payout: 0, stake });
    playBeep(140, 0.4, 'sawtooth', 0.3);
    cleanup();
  };

  const cleanup = () => {
    spawnTimersRef.current.forEach((t) => clearTimeout(t));
    spawnTimersRef.current = [];
  };

  const playAgain = () => {
    setPhase('idle');
    phaseRef.current = 'idle';
    setChickenLane(0);
    setVehicles([]);
    setResultPopup(null);
  };

  const topUpCredits = () => {
    if (credits > 100) return;
    setCredits(DEFAULT_CREDITS);
    toast.success('+₹5000 demo credits added');
  };

  // Start animation loop on mount, cleanup on unmount
  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach lane Y to newly spawned vehicles
  useEffect(() => {
    setVehicles((vs) => vs.map((v) => v.y === 0 ? { ...v, y: (LANES - v.lane + 0.5) * LANE_HEIGHT } : v));
  }, [vehicles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chicken pixel position within inner road area
  const chickenY = chickenLane === 0
    ? (LANES + 0.75) * LANE_HEIGHT - 90
    : (LANES - chickenLane + 0.4) * LANE_HEIGHT + LANE_HEIGHT * 0.6 - 90;

  // Camera keeps chicken around 70% down the viewport (~ y 260 of 380px)
  const ROAD_HEIGHT_PX = 380;
  const CHICKEN_TARGET_Y = 260;
  const rawCam = chickenY - CHICKEN_TARGET_Y;
  const maxCam = (LANES + 1) * LANE_HEIGHT - ROAD_HEIGHT_PX;
  const cameraY = Math.max(0, Math.min(rawCam, maxCam));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0F0F1A' }} data-testid="chicken-road-page">
      <style>{`
        @keyframes cb-walk { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
        @keyframes cb-hop { 0% { transform: translateY(0) scale(1) } 50% { transform: translateY(-30px) scale(1.1) } 100% { transform: translateY(0) scale(1) } }
        @keyframes cb-die { 0% { transform: rotate(0) scale(1); opacity:1 } 40% { transform: rotate(120deg) scale(1.2) } 100% { transform: rotate(360deg) scale(0.4); opacity: 0.3 } }
        @keyframes cb-pop { 0% { transform: scale(0.3); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes cb-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
        @keyframes cb-ticker-scroll { 0% { transform: translateX(100%) } 100% { transform: translateX(-100%) } }
        .cb-hop-anim { animation: cb-hop 0.35s ease-out }
        .cb-die-anim { animation: cb-die 0.9s ease-out forwards }
        .cb-pop { animation: cb-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) }
        .cb-shake { animation: cb-shake 0.4s ease-in-out }
        .cb-ticker { animation: cb-ticker-scroll 20s linear infinite }
        .cb-road-flash { animation: cb-shake 0.5s ease-in-out; box-shadow: inset 0 0 60px rgba(220,38,38,0.7) !important }
      `}</style>

      {/* Header — brand + credits + sound */}
      <header className="sticky top-0 z-40" style={{ background: '#000', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/dashboard">
            <button className="p-2 active:scale-90" style={{ color: '#FFF' }} data-testid="back-btn">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <div className="flex items-center gap-1 flex-1">
            <span className="text-white font-black tracking-tight" style={{ fontSize: 17, fontFamily: 'Outfit, sans-serif' }}>CHICKEN</span>
            <span className="font-black" style={{ fontSize: 21, color: '#DC2626', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>2</span>
            <span className="text-white font-black tracking-tight" style={{ fontSize: 17, fontFamily: 'Outfit, sans-serif' }}>ROAD</span>
            <span className="text-lg ml-1">🐔</span>
          </div>
          {/* Best */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}>
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] font-black text-yellow-300 tabular-nums" data-testid="best-mult">{bestMult.toFixed(2)}x</span>
          </div>
          {/* Sound toggle */}
          <button onClick={() => setSoundOn((s) => !s)} data-testid="sound-toggle"
            className="p-1.5 rounded-full active:scale-90" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {soundOn ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </header>

      {/* Stat bar: Current mult / Demo credits / Best */}
      <div className="grid grid-cols-3 gap-2 px-3 pt-2" style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(255,215,0,0.25)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Current</p>
          <p key={chickenLane} className="cb-pop text-lg font-black tabular-nums text-yellow-300" style={{ fontFamily: 'monospace', textShadow: '0 0 8px rgba(253,224,71,0.5)' }} data-testid="current-mult">
            {currentMult.toFixed(2)}x
          </p>
        </div>
        <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Demo Credits</p>
          <p className="text-lg font-black tabular-nums text-green-400" style={{ fontFamily: 'monospace' }} data-testid="demo-credits">
            ₹{Math.floor(credits)}
          </p>
        </div>
        <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(147,51,234,0.25)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Potential</p>
          <p className="text-lg font-black tabular-nums" style={{ color: '#DDD6FE', fontFamily: 'monospace' }}>
            ₹{phase === 'playing' ? potentialPayout : Math.floor(stake * currentMult)}
          </p>
        </div>
      </div>

      {/* Road scene — top-down, camera scrolls up as chicken advances */}
      <div className="relative rounded-2xl overflow-hidden" style={{
        width: 'calc(100% - 24px)',
        maxWidth: '480px', margin: '8px auto',
        height: 380,
        background: '#525252',
        border: '2px solid rgba(255,255,255,0.15)',
        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
      }} data-testid="road-scene">
        <div ref={roadRef} className="absolute inset-x-0 top-0" style={{
          height: (LANES + 1) * LANE_HEIGHT,
          transform: `translateY(-${cameraY}px)`,
          transition: 'transform 0.4s cubic-bezier(0.65, 0, 0.35, 1)',
          background: '#525252',
        }}>
          {/* Finish line grass (top of road) */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{
            height: LANE_HEIGHT * 0.6,
            background: 'linear-gradient(180deg, #14532D 0%, #16A34A 100%)',
            borderBottom: '3px solid #FDE047',
          }}>
            <span className="text-yellow-200 font-black text-sm tracking-widest">🏁 FINISH · {MULTIPLIERS[LANES].toFixed(2)}x 🏁</span>
          </div>

          {/* Lanes */}
          {Array.from({ length: LANES }).map((_, i) => {
            const laneNumber = LANES - i; // top = LANES, bottom = 1
            const isCurrent = laneNumber === chickenLane;
            const isCrossed = laneNumber < chickenLane;
            return (
              <div key={laneNumber} className="absolute inset-x-0" style={{
                top: (i + 0.6) * LANE_HEIGHT,
                height: LANE_HEIGHT,
                background: laneNumber % 2 === 0 ? '#4A4A52' : '#5A5A62',
                borderTop: '3px dashed rgba(253, 224, 71, 0.55)',
              }}>
                {/* Center dashed lane divider */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1 w-16"
                  style={{ background: 'rgba(253,224,71,0.3)', borderRadius: 2 }} />
                {/* Lane multiplier badge on left */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg font-black text-sm z-10" style={{
                  background: isCurrent ? '#FDE047' : isCrossed ? '#22C55E' : 'rgba(0,0,0,0.7)',
                  color: isCurrent || isCrossed ? '#0A0A14' : '#FDE047',
                  border: `2px solid ${isCurrent ? '#B45309' : isCrossed ? '#14532D' : 'rgba(253,224,71,0.5)'}`,
                  boxShadow: isCurrent ? '0 0 12px rgba(253,224,71,0.6)' : 'none',
                }}>
                  {MULTIPLIERS[laneNumber].toFixed(2)}x
                </div>
                {isCrossed && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xl">✓</div>
                )}
              </div>
            );
          })}

          {/* Sidewalk bottom (start) */}
          <div className="absolute inset-x-0 flex items-center justify-center" style={{
            bottom: 0,
            height: LANE_HEIGHT * 0.6,
            background: `repeating-linear-gradient(0deg, transparent 0 12px, rgba(0,0,0,0.25) 12px 14px), repeating-linear-gradient(90deg, transparent 0 24px, rgba(0,0,0,0.2) 24px 26px), linear-gradient(180deg, #A8A29E 0%, #78716C 100%)`,
            borderTop: '3px solid #292524',
          }}>
            <span className="text-[9px] font-black tracking-widest text-yellow-900 opacity-80">START · SIDEWALK</span>
          </div>

          {/* Vehicles */}
          {vehicles.map((v) => (<Vehicle key={v.id} v={v} />))}

          {/* Chicken — positioned by lane */}
          <div className="absolute" style={{
            left: CHICKEN_X - 45,
            top: chickenY,
            width: 90,
            height: 100,
            transition: 'top 0.35s cubic-bezier(0.65, 0, 0.35, 1)',
            zIndex: 5,
          }}>
            <div className={
              phase === 'crashed' ? 'cb-die-anim' :
              hopping ? 'cb-hop-anim' :
              ''
            } style={{ width: '100%', height: '100%' }}>
              <ChickenSVG dying={phase === 'crashed'} walking={phase === 'playing' && !hopping} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="rounded-2xl p-3 space-y-3" style={{
        width: 'calc(100% - 24px)',
        maxWidth: '480px', margin: '0 auto 12px',
        background: '#1F1F2E',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {phase !== 'playing' ? (
          <>
            {/* Stake input */}
            <div className="flex items-center gap-2 rounded-xl p-1" style={{ background: '#2A2A3D' }}>
              <button onClick={() => setStake(20)}
                className="px-3 py-2 rounded-lg font-black text-xs text-gray-200 active:scale-95"
                style={{ background: '#3A3A50' }} data-testid="min-btn">MIN</button>
              <input
                type="number"
                value={stake}
                min="20"
                onChange={(e) => setStake(Math.max(0, parseInt(e.target.value || '0', 10)))}
                data-testid="stake-input"
                className="flex-1 text-center font-black text-xl text-white bg-transparent outline-none tabular-nums"
              />
              <button onClick={() => setStake(Math.max(20, Math.floor(credits)))}
                className="px-3 py-2 rounded-lg font-black text-xs text-gray-200 active:scale-95"
                style={{ background: '#3A3A50' }} data-testid="max-btn">MAX</button>
            </div>
            {/* Quick chips */}
            <div className="grid grid-cols-4 gap-2">
              {CHIP_STAKES.map((c) => (
                <button key={c} onClick={() => setStake(c)}
                  data-testid={`chip-${c}`}
                  className={`flex items-center justify-center gap-1 py-2.5 rounded-xl font-black text-sm active:scale-95 ${stake === c ? 'text-yellow-300' : 'text-white'}`}
                  style={{
                    background: '#2A2A3D',
                    border: stake === c ? '1.5px solid #FDE047' : '1.5px solid transparent',
                  }}>
                  <span>{c}</span>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                    <span className="text-[10px] font-black text-gray-600">₹</span>
                  </div>
                </button>
              ))}
            </div>
            {/* Difficulty selector */}
            <div className="grid grid-cols-3 gap-2">
              {Object.keys(DIFFICULTY).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  data-testid={`diff-${d.toLowerCase()}`}
                  className={`py-2 rounded-lg font-black text-xs active:scale-95 ${difficulty === d ? 'text-yellow-300' : 'text-white'}`}
                  style={{
                    background: '#2A2A3D',
                    border: difficulty === d ? '1.5px solid #FDE047' : '1.5px solid transparent',
                  }}>{d}</button>
              ))}
            </div>
            {/* Play button */}
            <button onClick={startGame} disabled={stake > credits || stake < 20} data-testid="play-btn"
              className="w-full py-4 rounded-xl font-black text-2xl text-white active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
                boxShadow: '0 4px 0 #14532D, 0 8px 16px rgba(22,163,74,0.4)',
              }}>
              {credits <= 0 ? 'No Credits' : 'PLAY'}
            </button>
            {credits <= 100 && (
              <button onClick={topUpCredits} data-testid="topup-btn"
                className="w-full py-2 rounded-lg font-black text-xs text-yellow-300 active:scale-95"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}>
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Refill Demo Credits (+₹5000)
              </button>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={crossLane} disabled={hopping || chickenLane >= LANES} data-testid="cross-btn"
              className="py-5 rounded-xl font-black text-xl text-white active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
                boxShadow: '0 4px 0 #14532D, 0 8px 16px rgba(22,163,74,0.4)',
              }}>
              <span>CROSS →</span>
              <div className="text-[10px] font-bold text-yellow-100 opacity-90 mt-0.5">Next {(MULTIPLIERS[chickenLane + 1] || MULTIPLIERS[LANES]).toFixed(2)}x</div>
            </button>
            <button onClick={() => onCashout(false)} disabled={chickenLane === 0} data-testid="collect-btn"
              className="py-5 rounded-xl font-black text-xl text-black active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #FBBF24 0%, #B45309 100%)',
                boxShadow: '0 4px 0 #78350F, 0 8px 16px rgba(251,191,36,0.5)',
              }}>
              <span>COLLECT</span>
              <div className="text-[10px] font-bold opacity-90 mt-0.5">₹{potentialPayout}</div>
            </button>
          </div>
        )}
      </div>

      {/* Round history */}
      {history.length > 0 && (
        <div style={{ width: 'calc(100% - 24px)', maxWidth: '480px', margin: '0 auto 24px' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2 px-1">Round History ({history.length})</p>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {history.slice(0, 15).map((h, i) => (
              <div key={i} className="shrink-0 rounded-lg px-2 py-1 text-center min-w-[62px]" style={{
                background: h.status === 'won' ? 'rgba(34,197,94,0.18)' : 'rgba(220,38,38,0.18)',
                border: `1px solid ${h.status === 'won' ? 'rgba(34,197,94,0.5)' : 'rgba(220,38,38,0.5)'}`,
              }} data-testid={`history-${i}`}>
                <p className="text-[10px] font-black" style={{ color: h.status === 'won' ? '#4ADE80' : '#F87171' }}>
                  {h.status === 'won' ? `${h.mult.toFixed(2)}x` : '💥'}
                </p>
                <p className="text-[9px] text-gray-400">₹{h.stake}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result popup */}
      {resultPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="cb-pop w-full max-w-xs rounded-2xl p-6 text-center" style={{
            background: resultPopup.type === 'crashed'
              ? 'linear-gradient(180deg, #450A0A 0%, #0A0A14 100%)'
              : 'linear-gradient(180deg, #14532D 0%, #0A0A14 100%)',
            border: `2px solid ${resultPopup.type === 'crashed' ? '#DC2626' : '#22C55E'}`,
            boxShadow: `0 0 40px ${resultPopup.type === 'crashed' ? 'rgba(220,38,38,0.5)' : 'rgba(34,197,94,0.5)'}`,
          }}>
            <div className="text-6xl mb-2">
              {resultPopup.type === 'crashed' ? '💥' : resultPopup.type === 'jackpot' ? '🏆' : '🎉'}
            </div>
            <p className="font-black text-2xl mb-1" style={{ color: resultPopup.type === 'crashed' ? '#F87171' : '#FDE047' }}>
              {resultPopup.type === 'crashed' ? 'CRASHED!' : resultPopup.type === 'jackpot' ? 'JACKPOT!' : 'CASHED OUT!'}
            </p>
            {resultPopup.type !== 'crashed' ? (
              <>
                <p className="text-white text-sm mb-1">Multiplier: <span className="font-black text-yellow-300">{resultPopup.mult.toFixed(2)}x</span></p>
                <p className="text-white text-lg font-black">You won <span className="text-green-400">₹{resultPopup.payout}</span></p>
              </>
            ) : (
              <p className="text-white text-sm">Lost ₹{resultPopup.stake} · Try again!</p>
            )}
            <button onClick={playAgain} data-testid="play-again-btn"
              className="mt-4 w-full py-3 rounded-xl font-black text-lg text-white active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
                boxShadow: '0 4px 0 #14532D',
              }}>Play Again</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChickenRoadPage;
