import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Play, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const CHIPS = [50, 100, 500, 1000, 5000];
const MAX_STEP = 25;
// Same table as backend
const MULTIPLIERS = [
  1.00, 1.10, 1.24, 1.40, 1.58, 1.79,
  2.02, 2.28, 2.58, 2.92, 3.30, 3.73,
  4.21, 4.76, 5.38, 6.08, 6.87, 7.77,
  8.79, 9.93, 11.22, 12.68, 14.33, 16.19,
  18.29, 20.67,
];

// Visible lanes on-screen (7 upcoming)
const VISIBLE_LANES = 7;

const ChickenRoadPage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [chip, setChip] = useState(50);
  const [game, setGame] = useState(null); // {game_id, bet, current_step, multiplier}
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [crashFlash, setCrashFlash] = useState(null); // {step}

  const token = localStorage.getItem('matka11_token') || '';
  const authH = { headers: { Authorization: `Bearer ${token}` } };

  const fetchConfig = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/chicken-road/config`); setConfig(r.data); } catch (e) { /* noop */ }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/chicken-road/active`, authH);
      if (r.data.active) setGame(r.data.active);
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/chicken-road/history?limit=20`, authH);
      setHistory(r.data.games || []);
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFeed = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/chicken-road/live-feed?limit=8`); setLiveFeed(r.data.feed || []); } catch (e) { /* noop */ }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchActive();
    fetchHistory();
    fetchFeed();
    const iv = setInterval(fetchFeed, 4000);
    return () => clearInterval(iv);
  }, [fetchConfig, fetchActive, fetchHistory, fetchFeed]);

  const startGame = async () => {
    if (busy || game) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/chicken-road/start`, { amount: chip }, authH);
      setGame(r.data);
      setCrashFlash(null);
      refreshUser();
      toast.success(`Chicken ready to cross! ₹${chip} bet 🐔`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Start failed');
    }
    setBusy(false);
  };

  const stepGame = async () => {
    if (busy || !game) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/chicken-road/step`, {}, authH);
      if (r.data.crashed) {
        setCrashFlash({ step: r.data.step });
        toast.error(`💥 CRASH at step ${r.data.step}! ₹${game.bet} lost`);
        setGame(null);
        fetchHistory();
        fetchFeed();
        setTimeout(() => setCrashFlash(null), 2600);
      } else {
        setGame((g) => ({ ...g, current_step: r.data.step, multiplier: r.data.multiplier }));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Step failed');
    }
    setBusy(false);
  };

  const cashout = async () => {
    if (busy || !game) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/chicken-road/cashout`, {}, authH);
      toast.success(`🏆 Cashed out ${r.data.multiplier.toFixed(2)}x = ₹${Math.floor(r.data.payout)}!`);
      setGame(null);
      refreshUser();
      fetchHistory();
      fetchFeed();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cashout failed');
    }
    setBusy(false);
  };

  const isActive = !!game;
  const step = game?.current_step || 0;
  const currentMult = MULTIPLIERS[step] || 1.0;
  const nextMult = MULTIPLIERS[step + 1] || MULTIPLIERS[MAX_STEP];

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(250, 204, 21, 0.15) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 80%, rgba(220, 38, 38, 0.18) 0%, transparent 55%), #0A0A14',
    }} data-testid="chicken-road-page">
      <style>{`
        @keyframes cr-chicken-hop { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) rotate(-3deg) } }
        @keyframes cr-chicken-die { 0% { transform: rotate(0deg) scale(1); opacity:1 } 40% { transform: rotate(90deg) scale(1.4); opacity:1 } 100% { transform: rotate(180deg) scale(0.6); opacity:0.3 } }
        @keyframes cr-car { 0% { transform: translateX(150%) } 45% { transform: translateX(0%) } 100% { transform: translateX(-150%) } }
        @keyframes cr-flash { 0%,100% { background: transparent } 30%,60% { background: rgba(220,38,38,0.5) } }
        @keyframes cr-mult-pop { 0% { transform: scale(0.4); opacity:0 } 60% { transform: scale(1.2); opacity:1 } 100% { transform: scale(1); opacity:1 } }
        .cr-chicken { animation: cr-chicken-hop 1.2s ease-in-out infinite; transform-origin: center bottom; font-size: 42px; line-height: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6)) }
        .cr-chicken-dead { animation: cr-chicken-die 0.7s ease-out forwards }
        .cr-crash-car { animation: cr-car 0.7s ease-out forwards; font-size: 44px; position:absolute; top: 50%; left: 0; transform: translateY(-50%); filter: drop-shadow(0 4px 6px rgba(0,0,0,0.7)) }
        .cr-flash-overlay { animation: cr-flash 0.9s ease-in-out 2 }
        .cr-mult-pop { animation: cr-mult-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-lg" style={{ background: 'rgba(10, 10, 20, 0.8)', borderBottom: '1px solid rgba(255, 215, 0, 0.25)' }}>
        <div className="px-3 py-3 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/dashboard">
            <button className="p-2 rounded-xl active:scale-90" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(255,215,0,0.35)', color: '#FFD700' }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight leading-none"
              style={{ backgroundImage: 'linear-gradient(90deg, #FBBF24 0%, #F97316 60%, #DC2626 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))' }}>
              🐔 CHICKEN ROAD
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#FDE047', opacity: 0.85 }}>
              Cross the road • Up to 20.67x • Min ₹{config?.min_bet || 50}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(20, 169, 76, 0.15)', border: '1px solid rgba(34, 197, 94, 0.45)' }}>
            <WalletIcon className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span className="text-xs font-black text-[#4ADE80] tabular-nums">₹{Math.floor(user?.balance || 0)}</span>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Multiplier display */}
        <div className="rounded-2xl p-3 flex items-center justify-between" style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(220,38,38,0.15) 100%)',
          border: '1.5px solid rgba(255,215,0,0.35)',
        }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Current</p>
            <p key={step} className="cr-mult-pop text-3xl font-black tabular-nums" style={{
              color: '#FDE047',
              fontFamily: 'monospace',
              textShadow: '0 0 12px rgba(255,215,0,0.6)',
            }}>{currentMult.toFixed(2)}x</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Next Step</p>
            <p className="text-lg font-black tabular-nums text-green-400" style={{ fontFamily: 'monospace' }}>
              {step >= MAX_STEP ? '—' : `${nextMult.toFixed(2)}x`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Step</p>
            <p className="text-lg font-black tabular-nums text-white" style={{ fontFamily: 'monospace' }}>{step}/{MAX_STEP}</p>
          </div>
        </div>

        {/* Road scene */}
        <div className={`relative rounded-2xl overflow-hidden ${crashFlash ? 'cr-flash-overlay' : ''}`} style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
          border: '2px solid rgba(255,215,0,0.4)',
          height: 240,
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4)',
        }}>
          {/* Sky */}
          <div className="absolute inset-x-0 top-0 h-8" style={{
            background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
            borderBottom: '2px solid #FDE047',
          }}>
            <span className="absolute top-1 left-3 text-xs">☁️</span>
            <span className="absolute top-1 right-3 text-xs">🌙</span>
          </div>

          {/* Grass strip at bottom (finish line grass) */}
          <div className="absolute inset-x-0 bottom-0 h-6" style={{
            background: 'linear-gradient(180deg, #14532D 0%, #0F3315 100%)',
            borderTop: '2px dashed #FDE047',
          }}>
            <div className="absolute inset-0 flex items-center justify-around text-[10px] text-yellow-300 font-black tracking-widest">
              🏁 FINISH LINE 🏁
            </div>
          </div>

          {/* Lanes */}
          <div className="absolute inset-x-0 top-8 bottom-6 flex">
            {Array.from({ length: VISIBLE_LANES }).map((_, laneIdx) => {
              // laneIdx 0 = current position, 1..VISIBLE_LANES-1 = upcoming
              const targetStep = step + laneIdx;
              const laneMultiplier = MULTIPLIERS[targetStep] || null;
              const isCurrent = laneIdx === 0;
              const isPassed = laneIdx === 0 && step > 0;
              const laneBg = laneIdx % 2 === 0
                ? 'repeating-linear-gradient(90deg, #2d2d3d 0 40px, #35354a 40px 80px)'
                : 'repeating-linear-gradient(90deg, #26263a 0 40px, #2e2e42 40px 80px)';
              return (
                <div key={laneIdx} className="relative flex-1 flex flex-col items-center justify-between py-2"
                  style={{
                    background: laneBg,
                    borderRight: laneIdx < VISIBLE_LANES - 1 ? '2px dashed rgba(253, 224, 71, 0.4)' : 'none',
                  }}>
                  {/* Multiplier label */}
                  {laneMultiplier && (
                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded"
                      style={{
                        background: isCurrent ? '#FDE047' : 'rgba(0,0,0,0.5)',
                        color: isCurrent ? '#0A0A14' : '#FDE047',
                        border: `1px solid ${isCurrent ? '#F59E0B' : 'rgba(253,224,71,0.4)'}`,
                        boxShadow: isCurrent ? '0 0 10px rgba(253,224,71,0.6)' : 'none',
                      }}>
                      {laneMultiplier.toFixed(2)}x
                    </div>
                  )}
                  {/* Chicken position — always in first lane */}
                  {isCurrent && (
                    <div className="relative">
                      {crashFlash ? (
                        <>
                          <div className="cr-chicken cr-chicken-dead">🐔</div>
                          <div className="cr-crash-car">🚗</div>
                        </>
                      ) : (
                        <div className={isActive ? 'cr-chicken' : 'cr-chicken'} style={!isActive ? { opacity: 0.4 } : undefined}>🐔</div>
                      )}
                    </div>
                  )}
                  {isPassed && !isCurrent && (
                    <div className="text-lg opacity-40">✓</div>
                  )}
                  {/* Empty spacer */}
                  {!isCurrent && !isPassed && <div />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        {!isActive ? (
          <>
            {/* Chip selector — pick bet before starting */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => setChip(c)}
                  className="shrink-0 w-14 h-14 rounded-full font-black text-xs tabular-nums active:scale-95 transition-all"
                  style={{
                    background: chip === c
                      ? 'conic-gradient(from 45deg, #FFD700 0deg 45deg, #DC2626 45deg 90deg, #FFD700 90deg 135deg, #F97316 135deg 180deg, #FFD700 180deg 225deg, #DC2626 225deg 270deg, #FFD700 270deg 315deg, #F97316 315deg 360deg)'
                      : 'rgba(31,41,55,0.6)',
                    color: chip === c ? '#0A0A14' : '#FDE047',
                    border: chip === c ? '2px solid #FFF' : '2px solid rgba(255,215,0,0.35)',
                    boxShadow: chip === c ? '0 6px 16px rgba(255,215,0,0.55)' : 'none',
                  }}
                  data-testid={`chip-${c}`}
                >₹{c}</button>
              ))}
            </div>
            <button disabled={busy} onClick={startGame} data-testid="start-btn"
              className="w-full rounded-2xl py-5 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #FBBF24 0%, #F97316 50%, #DC2626 100%)',
                border: '2.5px solid #FEF3C7',
                boxShadow: '0 8px 20px rgba(251,191,36,0.5)',
                color: '#0A0A14',
              }}>
              <Play className="w-6 h-6" />
              <span className="text-lg font-black tracking-widest">START — ₹{chip}</span>
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy || step >= MAX_STEP} onClick={stepGame} data-testid="step-btn"
              className="rounded-2xl py-5 active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #16A34A 0%, #14532D 100%)',
                border: '2.5px solid #86EFAC',
                boxShadow: '0 6px 16px rgba(22,163,74,0.5)',
              }}>
              <span className="text-3xl mb-1">🐔</span>
              <span className="text-white font-black text-sm tracking-widest">STEP</span>
              <span className="text-[10px] font-bold text-yellow-200">Next {nextMult.toFixed(2)}x</span>
            </button>
            <button disabled={busy || step === 0} onClick={cashout} data-testid="cashout-btn"
              className="rounded-2xl py-5 active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #FBBF24 0%, #B45309 100%)',
                border: '2.5px solid #FEF3C7',
                boxShadow: '0 6px 16px rgba(251,191,36,0.5)',
                color: '#0A0A14',
              }}>
              <LogOut className="w-6 h-6" />
              <span className="font-black text-sm tracking-widest">CASHOUT</span>
              <span className="text-[10px] font-bold">₹{Math.floor(game.bet * currentMult)}</span>
            </button>
          </div>
        )}

        {/* Live feed */}
        {liveFeed.length > 0 && (
          <div className="rounded-xl p-2" style={{ background: 'rgba(31,41,55,0.4)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">🔴 Live Results</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {liveFeed.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-300">{b.name} · ₹{Math.floor(b.bet || 0)}</span>
                  {b.status === 'won'
                    ? <span className="font-black text-emerald-400">🏆 {(b.multiplier || 0).toFixed(2)}x · ₹{Math.floor(b.payout || 0)}</span>
                    : <span className="font-black text-red-400">💥 CRASH</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Casino-Style Bet History */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2">Your Rides ({history.length})</p>
          {history.length === 0 ? (
            <div className="rounded-xl py-6 text-center text-[11px] text-yellow-200/70"
              style={{ background: 'rgba(20,20,43,0.5)', border: '1px dashed rgba(255,215,0,0.3)' }}>
              🐔 Koi ride abhi tak nahi — chicken ko road cross karao!
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((g, i) => {
                const isWin = g.status === 'won';
                const statusColor = isWin ? '#22C55E' : '#F87171';
                const label = isWin ? 'CASHED' : 'CRASHED';
                return (
                  <div key={i} className="rounded-xl p-3" style={{
                    background: `linear-gradient(135deg, rgba(0,0,0,0.5) 0%, ${statusColor}22 100%)`,
                    border: `1.5px solid ${statusColor}55`,
                    boxShadow: `0 4px 10px ${statusColor}22`,
                  }} data-testid={`cr-ticket-${i}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded" style={{ background: statusColor, color: '#0A0A14' }}>{label}</span>
                      <span className="text-[9px] text-gray-400 tracking-wider">LB-CR-{String(g.game_id).slice(-6).toUpperCase()}</span>
                      <span className="ml-auto text-[9px] text-gray-400">{new Date(g.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🐔</span>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-gray-400">Steps</p>
                          <p className="text-sm font-black text-white">{g.crashed_at_step ?? g.current_step ?? 0} / {MAX_STEP}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Bet</p>
                        <p className="text-sm font-black text-yellow-300">₹{Math.floor(g.bet)}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-dashed border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Multiplier: <span className="font-black" style={{ color: statusColor }}>{(g.multiplier || 0).toFixed(2)}x</span>
                      </span>
                      {isWin
                        ? <span className="text-xs font-black text-emerald-400">🏆 +₹{Math.floor(g.payout)}</span>
                        : <span className="text-xs font-black text-red-400">— ₹{Math.floor(g.bet)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ChickenRoadPage;
