import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const CHIPS = [20, 50, 100, 500, 1000];

const COLORS = [
  { key: 'red',    label: 'RED',    hex: '#DC2626', text: '#FFFFFF' },
  { key: 'white',  label: 'WHITE',  hex: '#F3F4F6', text: '#0A0A14' },
  { key: 'orange', label: 'ORANGE', hex: '#F97316', text: '#FFFFFF' },
];
const COLOR_HEX = { red: '#DC2626', white: '#F3F4F6', orange: '#F97316' };
const PAYOUT = 3;

// Reveal ball — shows the single winning color
const RevealBall = ({ color, phase }) => {
  const isRevealed = !!color && phase !== 'betting';
  const hex = isRevealed ? COLOR_HEX[color] : '#374151';
  return (
    <div className="relative flex items-center justify-center" style={{ width: 150, height: 150 }} data-testid="reveal-ball">
      <style>{`
        @keyframes cg-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes cg-pulse { 0%,100% { box-shadow: 0 0 24px rgba(255,215,0,0.5) } 50% { box-shadow: 0 0 48px rgba(255,215,0,0.9) } }
        @keyframes cg-pop { 0% { transform: scale(0.3); opacity:0 } 60% { transform: scale(1.2); opacity:1 } 100% { transform: scale(1); opacity:1 } }
        .cg-ring-spin { animation: cg-spin 1.4s linear infinite }
        .cg-ball-pulse { animation: cg-pulse 1.6s ease-in-out infinite }
        .cg-label-pop { animation: cg-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both }
      `}</style>
      {/* Outer tricolor spinning ring while betting; static color-matched when revealed */}
      <div
        className={isRevealed ? '' : 'cg-ring-spin'}
        style={{
          position: 'absolute', width: 150, height: 150, borderRadius: '50%',
          background: isRevealed
            ? `radial-gradient(circle, ${hex} 0%, ${hex}55 70%, transparent 100%)`
            : 'conic-gradient(#DC2626 0deg 120deg, #F3F4F6 120deg 240deg, #F97316 240deg 360deg)',
          padding: 8,
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.5))',
        }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0A0A14' }} />
      </div>
      {/* Inner ball with color */}
      <div
        className="cg-ball-pulse relative flex items-center justify-center"
        style={{
          width: 116, height: 116, borderRadius: '50%',
          background: isRevealed
            ? `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${hex} 45%, ${hex} 100%)`
            : 'radial-gradient(circle at 35% 30%, #1F2937 0%, #0A0A14 100%)',
          border: '3px solid #FDE047',
        }}>
        {isRevealed ? (
          <span className="cg-label-pop font-black tracking-widest"
                style={{
                  fontSize: 20,
                  color: color === 'white' ? '#0A0A14' : '#FFFFFF',
                  textShadow: color === 'white' ? 'none' : '0 2px 6px rgba(0,0,0,0.6)',
                }}>
            {color.toUpperCase()}
          </span>
        ) : (
          <span className="font-black text-yellow-300" style={{ fontSize: 34, opacity: 0.7 }}>?</span>
        )}
      </div>
    </div>
  );
};

const ColorGamePage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState({ min_bet: 20 });
  const [current, setCurrent] = useState(null);
  const [recentRounds, setRecentRounds] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [history, setHistory] = useState([]);
  const [chip, setChip] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [reveal, setReveal] = useState({ round_id: null, color: null });
  const revealedRoundRef = useRef(null);

  const token = localStorage.getItem('matka11_token') || '';
  const authH = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAll = useCallback(async () => {
    try {
      const [c, cur, rec, feed] = await Promise.all([
        axios.get(`${API}/api/color-game/config`),
        axios.get(`${API}/api/color-game/current`),
        axios.get(`${API}/api/color-game/recent-rounds?limit=15`),
        axios.get(`${API}/api/color-game/live-feed?limit=8`),
      ]);
      setConfig(c.data);
      setCurrent(cur.data);
      setRecentRounds(rec.data.rounds || []);
      setLiveFeed(feed.data.feed || []);
    } catch { /* noop */ }
  }, []);

  const fetchMyHistory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/color-game/history?limit=20`, authH);
      setHistory(r.data.bets || []);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    fetchMyHistory();
    const iv = setInterval(fetchAll, 500);
    const iv2 = setInterval(fetchMyHistory, 3000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [fetchAll, fetchMyHistory]);

  useEffect(() => {
    const latest = recentRounds[0];
    if (latest?.color && latest.round_id !== revealedRoundRef.current) {
      revealedRoundRef.current = latest.round_id;
      setReveal({ round_id: latest.round_id, color: latest.color });
      setTimeout(() => refreshUser(), 3500);
    }
  }, [recentRounds, refreshUser]);

  const placeBet = async (side) => {
    if (placing) return;
    if (current?.phase !== 'betting') { toast.error('Betting closed'); return; }
    setPlacing(true);
    try {
      await axios.post(`${API}/api/color-game/bet`, { side, amount: chip }, authH);
      toast.success(`₹${chip} on ${side.toUpperCase()} 🎯`);
      refreshUser();
      fetchMyHistory();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bet failed');
    }
    setPlacing(false);
  };

  const isBetting = current?.phase === 'betting';
  const remaining = current?.remaining || 0;

  // User's bets in current round — sum by side
  const myBetsThisRound = React.useMemo(() => {
    const map = { red: 0, white: 0, orange: 0 };
    if (!current?.round_id) return map;
    history.forEach((b) => {
      if (b.round_id === current.round_id && map[b.side] !== undefined) {
        map[b.side] += Number(b.amount || 0);
      }
    });
    return map;
  }, [history, current?.round_id]);

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(249, 115, 22, 0.15) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 80%, rgba(220, 38, 38, 0.14) 0%, transparent 55%), #0A0A14',
    }} data-testid="color-game-page">
      <header className="sticky top-0 z-40 backdrop-blur-lg" style={{ background: 'rgba(10, 10, 20, 0.8)', borderBottom: '1px solid rgba(255, 215, 0, 0.25)' }}>
        <div className="px-3 py-3 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/dashboard">
            <button className="p-2 rounded-xl active:scale-90" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(255,215,0,0.35)', color: '#FFD700' }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight leading-none"
              style={{ backgroundImage: 'linear-gradient(90deg, #DC2626 0%, #F3F4F6 50%, #F97316 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))' }}>
              🎨 COLOR GAME
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#FDE047', opacity: 0.85 }}>
              30 sec • Red / White / Orange • All 3x • Min ₹{config?.min_bet || 20}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(20, 169, 76, 0.15)', border: '1px solid rgba(34, 197, 94, 0.45)' }}>
            <WalletIcon className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span className="text-xs font-black text-[#4ADE80] tabular-nums">₹{Math.floor(user?.balance || 0)}</span>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Timer */}
        <div className="rounded-2xl p-3 flex items-center justify-between" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#FDE047]" />
            <span className="text-white font-bold text-sm">{isBetting ? 'Place your bet' : 'Result revealed!'}</span>
          </div>
          <div className="text-2xl font-black tabular-nums" style={{ color: isBetting ? '#4ADE80' : '#F87171', fontFamily: 'monospace' }}>
            00:{String(remaining).padStart(2, '0')}
          </div>
        </div>

        {/* Reveal Ball */}
        <div className="rounded-2xl p-6 flex items-center justify-center" style={{
          background: 'linear-gradient(180deg, rgba(6,10,15,0.6) 0%, rgba(6,10,15,0.9) 100%)',
          border: '2px solid rgba(255,215,0,0.4)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 8px 20px rgba(249,115,22,0.15)',
        }}>
          <RevealBall color={isBetting ? null : reveal.color} phase={current?.phase || 'waiting'} />
        </div>

        {/* Chip selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setChip(c)}
              className="shrink-0 w-14 h-14 rounded-full font-black text-xs tabular-nums active:scale-95 transition-all"
              style={{
                background: chip === c
                  ? 'conic-gradient(from 45deg, #FFD700 0deg 60deg, #DC2626 60deg 120deg, #FFD700 120deg 180deg, #F3F4F6 180deg 240deg, #FFD700 240deg 300deg, #F97316 300deg 360deg)'
                  : 'rgba(31,41,55,0.6)',
                color: chip === c ? '#0A0A14' : '#FDE047',
                border: chip === c ? '2px solid #FFF' : '2px solid rgba(255,215,0,0.35)',
                boxShadow: chip === c ? '0 6px 16px rgba(255,215,0,0.55)' : 'none',
              }}
              data-testid={`chip-${c}`}
            >₹{c}</button>
          ))}
        </div>

        {/* Bet buttons — Red / White / Orange */}
        <div className="grid grid-cols-3 gap-2">
          {COLORS.map((c) => {
            const myBet = myBetsThisRound[c.key] || 0;
            return (
              <button
                key={c.key}
                disabled={!isBetting || placing}
                onClick={() => placeBet(c.key)}
                data-testid={`bet-${c.key}`}
                className="relative rounded-2xl py-5 active:scale-95 disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg, ${c.hex} 0%, ${c.hex}99 100%)`,
                  border: `2.5px solid ${c.key === 'white' ? '#78716C' : '#FEF3C7'}`,
                  boxShadow: `0 6px 16px ${c.hex}80`,
                }}>
                {/* Lock overlay during reveal */}
                {!isBetting && (
                  <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)', border: '1.5px solid #FDE047' }}>
                    <span className="text-[11px]">🔒</span>
                  </div>
                )}
                {/* My bet badge */}
                {myBet > 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums"
                    style={{ background: '#0A0A14', color: '#FDE047', border: '1px solid #FDE047' }} data-testid={`my-bet-${c.key}`}>
                    You: ₹{Math.floor(myBet)}
                  </div>
                )}
                <div className="w-10 h-10 mx-auto mb-1 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${c.hex} 60%, ${c.hex} 100%)`,
                    border: '2px solid #FEF3C7',
                  }} />
                <div className="font-black text-sm tracking-widest" style={{ color: c.text, textShadow: c.key === 'white' ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' }}>{c.label}</div>
                <div className="text-[10px] font-bold" style={{ color: c.key === 'white' ? '#7C2D12' : '#FEF3C7' }}>3x Payout</div>
              </button>
            );
          })}
        </div>

        {/* Last 15 Results */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Last 15 Results</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {recentRounds.filter(r => r.color).slice(0, 15).map((r, i) => (
              <div key={i} className="shrink-0 w-9 h-9 rounded-full"
                style={{
                  background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${COLOR_HEX[r.color]} 60%, ${COLOR_HEX[r.color]} 100%)`,
                  border: '2px solid rgba(0,0,0,0.4)',
                }}
                title={r.color}
              />
            ))}
          </div>
        </div>

        {/* Live feed */}
        {liveFeed.length > 0 && (
          <div className="rounded-xl p-2" style={{ background: 'rgba(31,41,55,0.4)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">🔴 Live Bets</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {liveFeed.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-300">{b.name}</span>
                  <span className="font-black" style={{ color: COLOR_HEX[b.side] || '#FDE047' }}>
                    {b.side?.toUpperCase()} · ₹{Math.floor(b.amount || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bet history tickets */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2">Your Tickets ({history.length})</p>
          {history.length === 0 ? (
            <div className="rounded-xl py-6 text-center text-[11px] text-yellow-200/70"
              style={{ background: 'rgba(20,20,43,0.5)', border: '1px dashed rgba(255,215,0,0.3)' }}>
              🎨 Koi ticket abhi tak nahi — pehla bet lagao!
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((b, i) => {
                const isWin = b.status === 'won';
                const isPending = b.status === 'pending';
                const statusColor = isPending ? '#FBBF24' : isWin ? '#22C55E' : '#F87171';
                const label = isPending ? 'LIVE' : isWin ? 'WON' : 'LOST';
                return (
                  <div key={i} className="rounded-xl p-3" style={{
                    background: `linear-gradient(135deg, rgba(0,0,0,0.5) 0%, ${statusColor}22 100%)`,
                    border: `1.5px solid ${statusColor}55`,
                    boxShadow: `0 4px 10px ${statusColor}22`,
                  }} data-testid={`cg-ticket-${i}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded" style={{ background: statusColor, color: '#0A0A14' }}>{label}</span>
                      <span className="text-[9px] text-gray-400 tracking-wider">LB-CG-{String(b.bet_id).slice(-6).toUpperCase()}</span>
                      <span className="ml-auto text-[9px] text-gray-400">{new Date(b.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${COLOR_HEX[b.side]} 60%, ${COLOR_HEX[b.side]} 100%)`, border: '2px solid #FEF3C7' }} />
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-gray-400">Your Pick</p>
                          <p className="text-sm font-black uppercase" style={{ color: COLOR_HEX[b.side] }}>{b.side}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Bet</p>
                        <p className="text-sm font-black text-yellow-300">₹{Math.floor(b.amount)}</p>
                      </div>
                    </div>
                    {!isPending && (
                      <div className="mt-2 pt-2 border-t border-dashed border-white/10 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                          Winner: <span className="font-black uppercase" style={{ color: COLOR_HEX[b.color] || '#FFF' }}>{b.color}</span>
                        </span>
                        {isWin
                          ? <span className="text-xs font-black text-emerald-400">🏆 +₹{Math.floor(b.payout)}</span>
                          : <span className="text-xs font-black text-red-400">— ₹{Math.floor(b.amount)}</span>}
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

export default ColorGamePage;
