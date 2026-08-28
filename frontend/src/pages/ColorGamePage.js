import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const CHIPS = [50, 100, 500, 1000, 5000];

// Number → color mapping
const NUM_COLORS = {
  0: ['red', 'violet'],
  5: ['green', 'violet'],
};
[1, 3, 7, 9].forEach((n) => (NUM_COLORS[n] = ['red']));
[2, 4, 6, 8].forEach((n) => (NUM_COLORS[n] = ['green']));

const COLOR_HEX = {
  red: '#DC2626',
  green: '#16A34A',
  violet: '#9333EA',
};

// Reveal ball — big glowing number with color ring
const RevealBall = ({ number, colors, phase }) => {
  const isRevealed = number !== null && number !== undefined && phase !== 'betting';
  const showColors = isRevealed ? colors || [] : [];
  const ringGradient = showColors.length === 2
    ? `conic-gradient(${COLOR_HEX[showColors[0]]} 0deg 180deg, ${COLOR_HEX[showColors[1]]} 180deg 360deg)`
    : showColors.length === 1
      ? `radial-gradient(circle, ${COLOR_HEX[showColors[0]]} 0%, ${COLOR_HEX[showColors[0]]}88 100%)`
      : 'conic-gradient(#DC2626 0deg 120deg, #16A34A 120deg 240deg, #9333EA 240deg 360deg)';
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }} data-testid="reveal-ball">
      <style>{`
        @keyframes cg-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes cg-pulse { 0%,100% { box-shadow: 0 0 24px rgba(255,215,0,0.5), 0 0 48px rgba(255,215,0,0.3) } 50% { box-shadow: 0 0 40px rgba(255,215,0,0.85), 0 0 80px rgba(255,215,0,0.5) } }
        @keyframes cg-bounce { 0% { transform: scale(0.2); opacity: 0 } 50% { transform: scale(1.15); opacity: 1 } 80% { transform: scale(0.95) } 100% { transform: scale(1); opacity: 1 } }
        .cg-ring-spin { animation: cg-spin 1.6s linear infinite }
        .cg-ball-pulse { animation: cg-pulse 1.8s ease-in-out infinite }
        .cg-num-bounce { animation: cg-bounce 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both }
      `}</style>
      {/* Outer color ring */}
      <div
        className={isRevealed ? '' : 'cg-ring-spin'}
        style={{
          position: 'absolute', width: 140, height: 140, borderRadius: '50%',
          background: ringGradient,
          padding: 6,
          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))',
        }}
      >
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: '#0A0A14',
        }} />
      </div>
      {/* Inner ball */}
      <div
        className="cg-ball-pulse relative flex items-center justify-center"
        style={{
          width: 108, height: 108, borderRadius: '50%',
          background: isRevealed
            ? `radial-gradient(circle at 35% 30%, ${COLOR_HEX[showColors[0]] || '#FDE047'} 0%, ${COLOR_HEX[showColors[showColors.length - 1]] || '#B45309'} 100%)`
            : 'radial-gradient(circle at 35% 30%, #1F2937 0%, #0A0A14 100%)',
          border: '3px solid #FDE047',
        }}
      >
        {isRevealed ? (
          <span className="cg-num-bounce font-black text-white" style={{ fontSize: 56, textShadow: '0 2px 8px rgba(0,0,0,0.6)', fontFamily: 'Georgia, serif' }}>
            {number}
          </span>
        ) : (
          <span className="font-black text-yellow-300 tabular-nums" style={{ fontSize: 40, opacity: 0.6 }}>?</span>
        )}
      </div>
    </div>
  );
};

const ColorGamePage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [current, setCurrent] = useState(null);
  const [recentRounds, setRecentRounds] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [history, setHistory] = useState([]);
  const [chip, setChip] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [reveal, setReveal] = useState({ round_id: null, number: null, colors: null });

  const token = localStorage.getItem('matka11_token') || '';
  const authH = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAll = useCallback(async () => {
    try {
      const [c, cur, rec, feed] = await Promise.all([
        axios.get(`${API}/api/color-game/config`),
        axios.get(`${API}/api/color-game/current`),
        axios.get(`${API}/api/color-game/recent-rounds?limit=10`),
        axios.get(`${API}/api/color-game/live-feed?limit=8`),
      ]);
      setConfig(c.data);
      setCurrent(cur.data);
      setRecentRounds(rec.data.rounds || []);
      setLiveFeed(feed.data.feed || []);
    } catch (e) { /* noop */ }
  }, []);

  const fetchMyHistory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/color-game/history?limit=20`, authH);
      setHistory(r.data.bets || []);
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    fetchMyHistory();
    const iv = setInterval(fetchAll, 500);
    const iv2 = setInterval(fetchMyHistory, 3000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [fetchAll, fetchMyHistory]);

  // Watch reveal
  useEffect(() => {
    const latest = recentRounds[0];
    if (latest && latest.number !== undefined && latest.round_id !== reveal.round_id) {
      setReveal({ round_id: latest.round_id, number: latest.number, colors: latest.colors });
      setTimeout(() => refreshUser(), 3500);
    }
  }, [recentRounds, reveal.round_id, refreshUser]);

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

  return (
    <div className="min-h-screen pb-24" style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(147, 51, 234, 0.18) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 80%, rgba(220, 38, 38, 0.14) 0%, transparent 55%), #0A0A14',
    }} data-testid="color-game-page">
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
              style={{ backgroundImage: 'linear-gradient(90deg, #DC2626 0%, #FDE047 50%, #16A34A 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))' }}>
              🎨 COLOR GAME
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#FDE047', opacity: 0.85 }}>
              30 sec • R/G 2x • Violet 4.5x • Min ₹{config?.min_bet || 50}
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
          background: 'linear-gradient(180deg, rgba(6,78,59,0.4) 0%, rgba(6,10,15,0.6) 100%)',
          border: '2px solid rgba(255,215,0,0.4)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 8px 20px rgba(147,51,234,0.15)',
        }}>
          <RevealBall
            number={isBetting ? null : reveal.number}
            colors={isBetting ? null : reveal.colors}
            phase={current?.phase || 'waiting'}
          />
        </div>

        {/* Chip selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setChip(c)}
              className={`shrink-0 w-14 h-14 rounded-full font-black text-xs tabular-nums active:scale-95 transition-all`}
              style={{
                background: chip === c
                  ? 'conic-gradient(from 45deg, #FFD700 0deg 45deg, #DC2626 45deg 90deg, #FFD700 90deg 135deg, #16A34A 135deg 180deg, #FFD700 180deg 225deg, #9333EA 225deg 270deg, #FFD700 270deg 315deg, #DC2626 315deg 360deg)'
                  : 'rgba(31,41,55,0.6)',
                color: chip === c ? '#0A0A14' : '#FDE047',
                border: chip === c ? '2px solid #FFF' : '2px solid rgba(255,215,0,0.35)',
                boxShadow: chip === c ? '0 6px 16px rgba(255,215,0,0.55)' : 'none',
              }}
              data-testid={`chip-${c}`}
            >
              ₹{c}
            </button>
          ))}
        </div>

        {/* Bet buttons — Red / Violet / Green */}
        <div className="grid grid-cols-3 gap-2">
          <button disabled={!isBetting || placing} onClick={() => placeBet('red')}
            data-testid="bet-red"
            className="rounded-2xl py-5 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)', border: '2px solid #FCA5A5', boxShadow: '0 6px 16px rgba(220,38,38,0.5)' }}>
            <div className="w-10 h-10 mx-auto mb-1 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #FEE2E2 0%, #DC2626 60%, #7F1D1D 100%)', border: '2px solid #FEF3C7' }} />
            <div className="text-white font-black text-sm tracking-wider">RED</div>
            <div className="text-[10px] font-bold text-yellow-200">2x</div>
          </button>
          <button disabled={!isBetting || placing} onClick={() => placeBet('violet')}
            data-testid="bet-violet"
            className="rounded-2xl py-5 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #9333EA 0%, #4C1D95 100%)', border: '2px solid #DDD6FE', boxShadow: '0 6px 16px rgba(147,51,234,0.5)' }}>
            <div className="w-10 h-10 mx-auto mb-1 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #EDE9FE 0%, #9333EA 60%, #4C1D95 100%)', border: '2px solid #FEF3C7' }} />
            <div className="text-white font-black text-sm tracking-wider">VIOLET</div>
            <div className="text-[10px] font-bold text-yellow-200">4.5x</div>
          </button>
          <button disabled={!isBetting || placing} onClick={() => placeBet('green')}
            data-testid="bet-green"
            className="rounded-2xl py-5 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #14532D 100%)', border: '2px solid #86EFAC', boxShadow: '0 6px 16px rgba(22,163,74,0.5)' }}>
            <div className="w-10 h-10 mx-auto mb-1 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #D1FAE5 0%, #16A34A 60%, #14532D 100%)', border: '2px solid #FEF3C7' }} />
            <div className="text-white font-black text-sm tracking-wider">GREEN</div>
            <div className="text-[10px] font-bold text-yellow-200">2x</div>
          </button>
        </div>

        {/* Info strip: number → color mapping */}
        <div className="rounded-xl p-2 text-center text-[10px] font-bold tracking-wide"
          style={{ background: 'rgba(31,41,55,0.4)', border: '1px solid rgba(255,215,0,0.2)', color: '#FDE047' }}>
          <span style={{ color: '#F87171' }}>0</span> = <span style={{ color: '#F87171' }}>RED</span>+<span style={{ color: '#C4B5FD' }}>VIOLET</span> · <span style={{ color: '#4ADE80' }}>5</span> = <span style={{ color: '#4ADE80' }}>GREEN</span>+<span style={{ color: '#C4B5FD' }}>VIOLET</span> · Odd = Red · Even = Green
        </div>

        {/* Last 10 results strip */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Last 10 Results</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {recentRounds.filter(r => r.number !== undefined).slice(0, 10).map((r, i) => {
              const cs = r.colors || [];
              const bg = cs.length === 2
                ? `conic-gradient(${COLOR_HEX[cs[0]]} 0deg 180deg, ${COLOR_HEX[cs[1]]} 180deg 360deg)`
                : `radial-gradient(circle, ${COLOR_HEX[cs[0]] || '#666'} 0%, ${COLOR_HEX[cs[0]] || '#333'}88 100%)`;
              return (
                <div key={i} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black text-white"
                  style={{ background: bg, border: '2px solid rgba(0,0,0,0.4)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                  title={`${r.number} — ${cs.join('+')}`}
                >{r.number}</div>
              );
            })}
          </div>
        </div>

        {/* Live feed */}
        {liveFeed.length > 0 && (
          <div className="rounded-xl p-2" style={{ background: 'rgba(31,41,55,0.4)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">🔴 Live Bets</p>
            <div className="space-y-1 max-h-20 overflow-y-auto">
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
                        <div className="w-8 h-8 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${COLOR_HEX[b.side]}dd 0%, ${COLOR_HEX[b.side]} 100%)`, border: '2px solid #FEF3C7' }} />
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
                          Result: <span className="font-black text-white">{b.number}</span> ·
                          {(b.colors || []).map((c, k) => (
                            <span key={k} className="ml-1 font-black uppercase" style={{ color: COLOR_HEX[c] }}>{c}</span>
                          ))}
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
