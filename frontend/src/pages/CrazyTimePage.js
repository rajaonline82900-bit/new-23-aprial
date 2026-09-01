import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fireWinnerConfetti, playCoinClink } from '../utils/casinoFx';

const API = process.env.REACT_APP_BACKEND_URL;
const CHIPS = [20, 50, 100, 500, 1000];

// 10 wheel segments — numbers 1-10, alternating rainbow colors
const SEG_COLORS = ['#DC2626','#F59E0B','#22C55E','#3B82F6','#EC4899','#8B5CF6','#EAB308','#0EA5E9','#F97316','#14B8A6'];
const SEGMENTS = Array.from({ length: 10 }, (_, i) => ({
  key: String(i + 1),
  label: String(i + 1),
  color: SEG_COLORS[i],
  text: '#FFFFFF',
  payout: 10,
}));
const NSEG = SEGMENTS.length;
const SEG_ANGLE = 360 / NSEG;

// Betting buttons — numbers 1-10, all pay 10x
const BET_OPTIONS = SEGMENTS.map((s) => ({ key: s.key, label: s.label, color: s.color, payout: '10x' }));

// Big spinning wheel SVG
const Wheel = ({ rotation }) => {
  const R = 130;
  return (
    <svg viewBox="-150 -150 300 300" width="100%" height="100%" style={{
      display: 'block',
      filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.6))',
    }}>
      <defs>
        <radialGradient id="wheelCenter" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="70%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>
      </defs>
      <g style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 4s cubic-bezier(0.15, 0.85, 0.35, 1)', transformOrigin: '0 0' }}>
        {SEGMENTS.map((s, i) => {
          const a1 = (i * SEG_ANGLE - 90) * Math.PI / 180;
          const a2 = ((i + 1) * SEG_ANGLE - 90) * Math.PI / 180;
          const x1 = R * Math.cos(a1), y1 = R * Math.sin(a1);
          const x2 = R * Math.cos(a2), y2 = R * Math.sin(a2);
          const mid = ((i + 0.5) * SEG_ANGLE - 90) * Math.PI / 180;
          const tx = R * 0.68 * Math.cos(mid);
          const ty = R * 0.68 * Math.sin(mid);
          const textRot = (i + 0.5) * SEG_ANGLE;
          return (
            <g key={i}>
              <path d={`M 0 0 L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`}
                    fill={s.color} stroke="#0A0A14" strokeWidth="1.5" />
              <g transform={`translate(${tx} ${ty}) rotate(${textRot})`}>
                <text textAnchor="middle" dominantBaseline="central"
                      fontSize="22"
                      fontWeight="900" fill={s.text}
                      style={{ fontFamily: 'Outfit, sans-serif', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                      stroke="#0A0A14" strokeWidth="0.6" paintOrder="stroke">{s.label}</text>
              </g>
            </g>
          );
        })}
        {/* Center hub */}
        <circle cx="0" cy="0" r="24" fill="url(#wheelCenter)" stroke="#78350F" strokeWidth="2" />
        <circle cx="0" cy="0" r="12" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1.5" />
      </g>
      {/* Outer gold ring */}
      <circle cx="0" cy="0" r={R + 2} fill="none" stroke="#FDE047" strokeWidth="4" />
      {/* Pointer at top */}
      <g>
        <path d="M 0 -145 L -10 -125 L 10 -125 Z" fill="#DC2626" stroke="#0A0A14" strokeWidth="2" />
        <circle cx="0" cy="-135" r="3" fill="#FDE047" />
      </g>
    </svg>
  );
};

const CrazyTimePage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState({ min_bet: 20 });
  const [current, setCurrent] = useState(null);
  const [recentRounds, setRecentRounds] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [history, setHistory] = useState([]);
  const [chip, setChip] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [revealed, setRevealed] = useState(null);
  const [livePlayers, setLivePlayers] = useState(null);
  const revealedRoundRef = useRef(null);
  const initializedRef = useRef(false);
  const winCelebratedRef = useRef(null);

  const token = localStorage.getItem('matka11_token') || '';
  const authH = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAll = useCallback(async () => {
    try {
      const [c, cur, rec, feed] = await Promise.all([
        axios.get(`${API}/api/crazy-time/config`),
        axios.get(`${API}/api/crazy-time/current`),
        axios.get(`${API}/api/crazy-time/recent-rounds?limit=15`),
        axios.get(`${API}/api/crazy-time/live-feed?limit=8`),
      ]);
      setConfig(c.data);
      setCurrent(cur.data);
      const rounds = rec.data.rounds || [];
      // On first load: mark the latest completed round as already-revealed so
      // the wheel does NOT spin on mount for a stale historical winner.
      if (!initializedRef.current) {
        initializedRef.current = true;
        if (rounds[0]?.winner) {
          revealedRoundRef.current = rounds[0].round_id;
          // Align wheel to that winner without animation feel
          const idx = SEGMENTS.findIndex((s) => s.key === rounds[0].winner);
          if (idx >= 0) setRotation(-((idx + 0.5) * SEG_ANGLE));
          setRevealed({ winner: rounds[0].winner, payout_mult: rounds[0].payout_mult });
        }
      }
      setRecentRounds(rounds);
      setLiveFeed(feed.data.feed || []);
    } catch { /* noop */ }
  }, []);

  const fetchMyHistory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/crazy-time/history?limit=20`, authH);
      setHistory(r.data.bets || []);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    fetchMyHistory();
    const iv = setInterval(fetchAll, 500);
    const iv2 = setInterval(fetchMyHistory, 3000);
    // Poll live-players every 10s
    const fetchLive = async () => {
      try {
        const r = await axios.get(`${API}/api/live-players`);
        setLivePlayers(r.data?.crazy_time || null);
      } catch { /* ignore */ }
    };
    fetchLive();
    const iv3 = setInterval(fetchLive, 10000);
    return () => { clearInterval(iv); clearInterval(iv2); clearInterval(iv3); };
  }, [fetchAll, fetchMyHistory]);

  // Spin wheel when new round has winner. Reveal banner ONLY after wheel stops.
  useEffect(() => {
    const latest = recentRounds[0];
    if (latest?.winner && latest.round_id !== revealedRoundRef.current) {
      revealedRoundRef.current = latest.round_id;
      const idx = SEGMENTS.findIndex((s) => s.key === latest.winner);
      if (idx >= 0) {
        const targetAngle = -((idx + 0.5) * SEG_ANGLE);
        // IMPORTANT: spins MUST be an integer so the final rotation ends exactly on target.
        // Fractional spins (e.g. 5.7 × 360) leave a residual offset → wheel visually
        // stops at the wrong segment even though the backend winner is correct.
        const spins = 5 + Math.floor(Math.random() * 3);  // 5..7 full turns
        setRotation((r) => {
          const base = Math.floor(r / 360) * 360;
          return base + spins * 360 + targetAngle;
        });
        // Hide any previous reveal while wheel is spinning
        setRevealed(null);
        // Reveal winner banner AFTER spin animation completes (4s CSS transition)
        setTimeout(() => {
          setRevealed({ winner: latest.winner, payout_mult: latest.payout_mult });
          refreshUser();
        }, 4100);
      }
    }
  }, [recentRounds, refreshUser]);

  // Win celebration: fires only after banner shows (post-spin)
  useEffect(() => {
    if (!revealed?.winner || !revealedRoundRef.current) return;
    if (winCelebratedRef.current === revealedRoundRef.current) return;
    const userWin = history.find(
      (b) => b.round_id === revealedRoundRef.current && b.segment === revealed.winner && b.status === 'won'
    );
    if (userWin) {
      winCelebratedRef.current = revealedRoundRef.current;
      fireWinnerConfetti();
      playCoinClink();
    }
  }, [history, revealed]);

  const placeBet = async (segment) => {
    if (placing) return;
    if (current?.phase !== 'betting') { toast.error('Betting closed'); return; }
    setPlacing(true);
    try {
      await axios.post(`${API}/api/crazy-time/bet`, { segment, amount: chip }, authH);
      toast.success(`₹${chip} on ${segment.toUpperCase()} 🎯`);
      refreshUser();
      fetchMyHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bet failed');
    }
    setPlacing(false);
  };

  const isBetting = current?.phase === 'betting';
  const remaining = current?.remaining || 0;

  // User bets in current round — total per segment
  const myBetsThisRound = React.useMemo(() => {
    const map = {};
    if (!current?.round_id) return map;
    history.forEach((b) => {
      if (b.round_id === current.round_id) {
        map[b.segment] = (map[b.segment] || 0) + Number(b.amount || 0);
      }
    });
    return map;
  }, [history, current?.round_id]);

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(220, 38, 38, 0.15) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 80%, rgba(251, 191, 36, 0.14) 0%, transparent 55%), #0A0A14',
    }} data-testid="crazy-time-page">
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
              style={{ backgroundImage: 'linear-gradient(90deg, #DC2626 0%, #FDE047 50%, #EC4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))' }}>
              🎡 CRAZY TIME
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#FDE047', opacity: 0.85 }}>
              30 sec • Money Wheel • Min ₹{config?.min_bet || 20}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(20, 169, 76, 0.15)', border: '1px solid rgba(34, 197, 94, 0.45)' }}>
            <WalletIcon className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span className="text-xs font-black text-[#4ADE80] tabular-nums">₹{Math.floor(user?.balance || 0)}</span>
          </div>
        </div>
        {livePlayers !== null && (
          <div className="px-3 pb-2 flex items-center gap-1.5" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 8px #22C55E', animation: 'pulse 2s ease-in-out infinite' }} />
            <span className="text-[10px] font-black tabular-nums text-[#4ADE80] uppercase tracking-widest" data-testid="live-players-count">
              {livePlayers.toLocaleString('en-IN')} playing now
            </span>
          </div>
        )}
      </header>

      <main className="px-3 py-4 space-y-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Timer */}
        <div className="rounded-2xl p-3 flex items-center justify-between" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#FDE047]" />
            <span className="text-white font-bold text-sm">{isBetting ? 'Place your bets!' : 'Spinning the wheel...'}</span>
          </div>
          <div className="text-2xl font-black tabular-nums" style={{ color: isBetting ? '#4ADE80' : '#F87171', fontFamily: 'monospace' }}>
            00:{String(remaining).padStart(2, '0')}
          </div>
        </div>

        {/* Wheel */}
        <div className="rounded-2xl p-4 flex items-center justify-center relative" style={{
          background: 'radial-gradient(ellipse at center, rgba(31,41,55,0.6) 0%, rgba(6,10,15,0.9) 100%)',
          border: '2px solid rgba(255,215,0,0.4)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 8px 20px rgba(220,38,38,0.15)',
        }}>
          <div style={{ width: 280, height: 280 }}>
            <Wheel rotation={rotation} />
          </div>
          {/* Winner banner during reveal */}
          {!isBetting && revealed && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full font-black text-sm tracking-widest"
              style={{
                background: 'linear-gradient(90deg, #DC2626 0%, #FDE047 50%, #DC2626 100%)',
                color: '#0A0A14',
                border: '2px solid #FEF3C7',
                boxShadow: '0 4px 12px rgba(255,215,0,0.5)',
              }}>
              {revealed.winner.toUpperCase()} · {revealed.payout_mult}x
            </div>
          )}
        </div>

        {/* Latest Results — moved to front (right after wheel) */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Latest Results (newest → left)</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {recentRounds.filter(r => r.winner).slice(0, 15).map((r, i) => {
              const seg = BET_OPTIONS.find(x => x.key === r.winner);
              return (
                <div key={i} className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                  style={{
                    background: seg?.color || '#666',
                    border: i === 0 ? '2.5px solid #FDE047' : '2px solid rgba(0,0,0,0.4)',
                    boxShadow: i === 0 ? '0 0 12px rgba(255,215,0,0.6)' : 'none',
                  }}
                  title={`${r.winner} · ${r.payout_mult}x`}
                >{seg?.label || '?'}</div>
              );
            })}
          </div>
        </div>

        {/* Chip selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setChip(c)}
              className="shrink-0 w-14 h-14 rounded-full font-black text-xs tabular-nums active:scale-95 transition-all"
              style={{
                background: chip === c
                  ? 'conic-gradient(from 45deg, #FFD700 0deg 45deg, #DC2626 45deg 90deg, #FFD700 90deg 135deg, #EC4899 135deg 180deg, #FFD700 180deg 225deg, #22C55E 225deg 270deg, #FFD700 270deg 315deg, #8B5CF6 315deg 360deg)'
                  : 'rgba(31,41,55,0.6)',
                color: chip === c ? '#0A0A14' : '#FDE047',
                border: chip === c ? '2px solid #FFF' : '2px solid rgba(255,215,0,0.35)',
                boxShadow: chip === c ? '0 6px 16px rgba(255,215,0,0.55)' : 'none',
              }}
              data-testid={`chip-${c}`}
            >₹{c}</button>
          ))}
        </div>

        {/* Bet buttons — 10 numbers (1-10) in 5×2 grid, each pays 10x */}
        <div className="grid grid-cols-5 gap-2">
          {BET_OPTIONS.map((b) => {
            const myBet = myBetsThisRound[b.key] || 0;
            return (
              <button
                key={b.key}
                disabled={!isBetting || placing}
                onClick={() => placeBet(b.key)}
                data-testid={`bet-${b.key}`}
                className="relative rounded-xl py-3 active:scale-95 disabled:opacity-60 flex flex-col items-center"
                style={{
                  background: `linear-gradient(180deg, ${b.color} 0%, ${b.color}99 100%)`,
                  border: '2px solid rgba(255,255,255,0.25)',
                  boxShadow: `0 4px 12px ${b.color}66`,
                }}>
                {!isBetting && (
                  <div className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid #FDE047' }}>
                    <span className="text-[9px]">🔒</span>
                  </div>
                )}
                {myBet > 0 && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-black tabular-nums whitespace-nowrap"
                    style={{ background: '#0A0A14', color: '#FDE047', border: '1px solid #FDE047' }} data-testid={`my-bet-${b.key}`}>
                    ₹{Math.floor(myBet)}
                  </div>
                )}
                <span className="text-white font-black text-lg tracking-wider" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{b.label}</span>
                <span className="text-[10px] font-bold text-yellow-100">{b.payout}</span>
              </button>
            );
          })}
        </div>

        {/* Recent results (removed — now shown at top under 'Latest Results') */}

        {/* Live feed */}
        {liveFeed.length > 0 && (
          <div className="rounded-xl p-2" style={{ background: 'rgba(31,41,55,0.4)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">🔴 Live Bets</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {liveFeed.map((b, i) => {
                const seg = BET_OPTIONS.find(x => x.key === b.segment);
                return (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300">{b.name}</span>
                    <span className="font-black" style={{ color: seg?.color || '#FDE047' }}>
                      {seg?.label || b.segment} · ₹{Math.floor(b.amount || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* My tickets */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2">Your Tickets ({history.length})</p>
          {history.length === 0 ? (
            <div className="rounded-xl py-6 text-center text-[11px] text-yellow-200/70"
              style={{ background: 'rgba(20,20,43,0.5)', border: '1px dashed rgba(255,215,0,0.3)' }}>
              🎡 Koi ticket abhi tak nahi — pehla bet lagao!
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((b, i) => {
                const isWin = b.status === 'won';
                const isPending = b.status === 'pending';
                const statusColor = isPending ? '#FBBF24' : isWin ? '#22C55E' : '#F87171';
                const label = isPending ? 'LIVE' : isWin ? 'WON' : 'LOST';
                const seg = BET_OPTIONS.find(x => x.key === b.segment);
                return (
                  <div key={i} className="rounded-xl p-3" style={{
                    background: `linear-gradient(135deg, rgba(0,0,0,0.5) 0%, ${statusColor}22 100%)`,
                    border: `1.5px solid ${statusColor}55`,
                  }} data-testid={`ct-ticket-${i}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded" style={{ background: statusColor, color: '#0A0A14' }}>{label}</span>
                      <span className="text-[9px] text-gray-400">LB-CT-{String(b.bet_id).slice(-6).toUpperCase()}</span>
                      {b.bet_count > 1 && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded ml-auto" style={{ background: '#FDE047', color: '#0A0A14' }}>
                          {b.bet_count}× BETS
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] uppercase text-gray-400">Pick</p>
                        <p className="text-sm font-black" style={{ color: seg?.color || '#FDE047' }}>{seg?.label || b.segment}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400">Total Bet {b.bet_count > 1 ? `(${b.bet_count} combined)` : ''}</p>
                        <p className="text-sm font-black text-yellow-300">₹{Math.floor(b.amount)}</p>
                      </div>
                    </div>
                    {!isPending && (
                      <div className="mt-2 pt-2 border-t border-dashed border-white/10 flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">Winner: <span className="font-black text-white">{b.winner || ''}</span></span>
                        {isWin
                          ? <span className="font-black text-emerald-400">🏆 +₹{Math.floor(b.payout)}</span>
                          : <span className="font-black text-red-400">-₹{Math.floor(b.amount)}</span>}
                      </div>
                    )}
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

export default CrazyTimePage;
