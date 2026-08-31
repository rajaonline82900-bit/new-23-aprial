import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const CHIPS = [50, 100, 500, 1000, 5000];
const SUIT_COLOR = { '♠': '#0F172A', '♣': '#0F172A', '♥': '#DC2626', '♦': '#DC2626' };
const RANK_LABEL = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[r] || String(r);

// Realistic casino dealer girl — Unsplash photo with idle bob + deal animation
const DEALER_IMG = 'https://images.unsplash.com/photo-1787676415039-711a133e88c7?fm=jpg&q=75&w=280&h=360&fit=crop&crop=faces';
const DealerGirl = ({ dealing }) => (
  <div className="relative" style={{ width: 92, height: 118 }}>
    <style>{`
      @keyframes lb-dealer-idle { 0%,100% { transform: translateY(0) rotate(0deg) } 50% { transform: translateY(-4px) rotate(-1deg) } }
      @keyframes lb-dealer-deal { 0% { transform: translateY(0) scale(1) } 30% { transform: translateY(-6px) scale(1.03) rotate(-3deg) } 60% { transform: translateY(-2px) scale(1.02) rotate(3deg) } 100% { transform: translateY(0) scale(1) rotate(0deg) } }
      @keyframes lb-halo { 0%,100% { opacity:0.35; transform: scale(1) } 50% { opacity:0.7; transform: scale(1.1) } }
      .lb-dealer-photo { animation: lb-dealer-idle 3.2s ease-in-out infinite; transform-origin: center bottom }
      .lb-dealer-photo.dealing { animation: lb-dealer-deal 0.9s ease-in-out infinite }
      .lb-halo { animation: lb-halo 2.4s ease-in-out infinite }
    `}</style>
    {/* Gold halo */}
    <div className="lb-halo absolute inset-0 rounded-full" style={{
      background: 'radial-gradient(circle at 50% 45%, rgba(255,215,0,0.55) 0%, rgba(255,215,0,0) 65%)',
      filter: 'blur(6px)'
    }} />
    <div className={`lb-dealer-photo ${dealing ? 'dealing' : ''} relative w-full h-full`}>
      <img
        src={DEALER_IMG}
        alt="Casino Dealer"
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 20%',
          borderRadius: '50% 50% 45% 45% / 55% 55% 45% 45%',
          border: '2.5px solid #FDE047',
          boxShadow: '0 8px 20px rgba(220,38,38,0.35), 0 0 0 2px rgba(0,0,0,0.4), inset 0 -20px 25px rgba(0,0,0,0.35)',
        }}
      />
    </div>
    {/* Dealer name plate */}
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest"
      style={{
        background: 'linear-gradient(90deg, #78350F 0%, #FBBF24 50%, #78350F 100%)',
        color: '#1A0F00',
        border: '1px solid #FDE047',
        whiteSpace: 'nowrap',
      }}>DEALER</div>
  </div>
);

// Realistic poker card — corner labels (top-left + bottom-right rotated) + big center pip
const CardFace = ({ card, flipped, delay = 0, side = 'dragon' }) => {
  const isDragon = side === 'dragon';
  const backBg = isDragon
    ? 'linear-gradient(135deg, #7F1D1D 0%, #450a0a 55%, #1F0505 100%)'
    : 'linear-gradient(135deg, #7C2D12 0%, #431407 55%, #1C0503 100%)';
  const backAccent = isDragon ? '#DC2626' : '#F97316';
  const backGlyph = isDragon ? '🐉' : '🐯';
  const rank = card ? RANK_LABEL(card.rank) : '';
  const suit = card ? card.suit : '';
  const suitColor = card ? SUIT_COLOR[card.suit] : '#0F172A';
  return (
    <div className="relative" style={{ width: 92, height: 132, perspective: 900 }}>
      <div className="absolute inset-0" style={{
        transformStyle: 'preserve-3d',
        transition: `transform 0.75s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Back — dragon/tiger themed */}
        <div className="absolute inset-0 rounded-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            background: backBg,
            border: '3px solid #FDE047',
            boxShadow: '0 10px 22px rgba(0,0,0,0.65), inset 0 1px 2px rgba(255,215,0,0.4)',
          }}>
          {/* Inner double-border frame */}
          <div className="absolute inset-1.5 rounded-lg" style={{
            border: `1.5px solid ${backAccent}`,
            background: `repeating-linear-gradient(45deg, rgba(255,215,0,0.06) 0 4px, transparent 4px 8px)`,
          }} />
          {/* Central medallion */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full flex items-center justify-center"
              style={{
                width: 58, height: 58,
                background: `radial-gradient(circle at 35% 30%, #FEF3C7 0%, #FBBF24 45%, ${backAccent} 100%)`,
                border: `2.5px solid #FDE047`,
                boxShadow: `0 4px 10px rgba(0,0,0,0.5), inset 0 -6px 12px rgba(0,0,0,0.3)`,
                fontSize: 30,
                lineHeight: 1,
              }}>{backGlyph}</div>
          </div>
          {/* Corner filigree dots */}
          <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#FDE047' }} />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#FDE047' }} />
          <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#FDE047' }} />
          <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#FDE047' }} />
        </div>
        {/* Front — real poker card layout */}
        <div className="absolute inset-0 rounded-xl bg-white overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            border: '2.5px solid #E5E7EB',
            boxShadow: '0 10px 22px rgba(0,0,0,0.55), inset 0 -8px 16px rgba(0,0,0,0.05)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
          }}>
          {card ? (
            <>
              {/* Top-left corner */}
              <div className="absolute top-1.5 left-2 flex flex-col items-center leading-none" style={{ color: suitColor }}>
                <span className="font-black" style={{ fontSize: 18, fontFamily: 'Georgia, serif' }}>{rank}</span>
                <span style={{ fontSize: 14, marginTop: 1 }}>{suit}</span>
              </div>
              {/* Bottom-right corner (rotated 180) */}
              <div className="absolute bottom-1.5 right-2 flex flex-col items-center leading-none" style={{ color: suitColor, transform: 'rotate(180deg)' }}>
                <span className="font-black" style={{ fontSize: 18, fontFamily: 'Georgia, serif' }}>{rank}</span>
                <span style={{ fontSize: 14, marginTop: 1 }}>{suit}</span>
              </div>
              {/* Big center suit pip */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: 54, color: suitColor, lineHeight: 1, textShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>{suit}</span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-6xl text-gray-300">?</div>
          )}
        </div>
      </div>
    </div>
  );
};

const DragonTigerPage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [current, setCurrent] = useState(null);
  const [recentRounds, setRecentRounds] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [history, setHistory] = useState([]);
  const [chip, setChip] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [flip, setFlip] = useState({ d: false, t: false });
  const [revealCards, setRevealCards] = useState({ dragon: null, tiger: null, winner: null });

  const token = localStorage.getItem('matka11_token') || '';
  const authH = { headers: { Authorization: `Bearer ${token}` } };

  const fetchAll = useCallback(async () => {
    try {
      const [c, cur, rec, feed] = await Promise.all([
        axios.get(`${API}/api/dragon-tiger/config`),
        axios.get(`${API}/api/dragon-tiger/current`),
        axios.get(`${API}/api/dragon-tiger/recent-rounds?limit=10`),
        axios.get(`${API}/api/dragon-tiger/live-feed?limit=8`),
      ]);
      setConfig(c.data);
      setCurrent(cur.data);
      setRecentRounds(rec.data.rounds || []);
      setLiveFeed(feed.data.feed || []);
    } catch (e) {}
  }, []);

  const fetchMyHistory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/dragon-tiger/history?limit=20`, authH);
      setHistory(r.data.bets || []);
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    fetchMyHistory();
    const iv = setInterval(fetchAll, 500);
    const iv2 = setInterval(fetchMyHistory, 3000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [fetchAll, fetchMyHistory]);

  // Watch reveal: when latest recent round has winner, animate flip
  useEffect(() => {
    const latest = recentRounds[0];
    if (latest?.winner && latest.round_id !== revealCards.round_id) {
      setRevealCards({ round_id: latest.round_id, dragon: latest.dragon, tiger: latest.tiger, winner: latest.winner });
      setFlip({ d: false, t: false });
      setTimeout(() => setFlip((f) => ({ ...f, d: true })), 200);
      setTimeout(() => setFlip((f) => ({ ...f, t: true })), 900);
      // Reset flip for next round after 4s
      setTimeout(() => { setFlip({ d: false, t: false }); refreshUser(); }, 4500);
    }
  }, [recentRounds, revealCards.round_id, refreshUser]);

  const placeBet = async (side) => {
    if (placing) return;
    if (current?.phase !== 'betting') { toast.error('Betting closed'); return; }
    setPlacing(true);
    try {
      await axios.post(`${API}/api/dragon-tiger/bet`, { side, amount: chip }, authH);
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

  // User bets in current round — total per side
  const myBetsThisRound = React.useMemo(() => {
    const map = { dragon: 0, tie: 0, tiger: 0 };
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
      background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(220, 38, 38, 0.18) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 80%, rgba(255, 215, 0, 0.14) 0%, transparent 55%), #0A0A14',
    }} data-testid="dragon-tiger-page">
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
              style={{ backgroundImage: 'linear-gradient(90deg, #DC2626 0%, #FFD700 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.5))' }}>
              🐉 DRAGON TIGER 🐯
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#FDE047', opacity: 0.85 }}>
              30 sec Round • D/T 2x • Tie 50x • Min ₹{config?.min_bet || 50}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(20, 169, 76, 0.15)', border: '1px solid rgba(34, 197, 94, 0.45)' }}>
            <WalletIcon className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span className="text-xs font-black text-[#4ADE80] tabular-nums">₹{Math.floor(user?.balance || 0)}</span>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Timer + Phase */}
        <div className="rounded-2xl p-3 flex items-center justify-between" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#FDE047]" />
            <span className="text-white font-bold text-sm">{isBetting ? 'Place your bet' : 'Reveal Cards...'}</span>
          </div>
          <div className="text-2xl font-black tabular-nums" style={{ color: isBetting ? '#4ADE80' : '#F87171', fontFamily: 'monospace' }}>
            00:{String(remaining).padStart(2, '0')}
          </div>
        </div>

        {/* Cards area — Dragon left, Tiger right, animated girl dealer between */}
        <div className="rounded-2xl p-4 flex items-center justify-around" style={{
          background: 'linear-gradient(180deg, rgba(6,78,59,0.4) 0%, rgba(6,10,15,0.6) 100%)',
          border: '2px solid rgba(255,215,0,0.4)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 8px 20px rgba(220,38,38,0.15)',
        }}>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: '#DC2626' }}>🐉 Dragon</span>
            <CardFace card={revealCards.dragon} flipped={flip.d} side="dragon" />
            {revealCards.winner === 'dragon' && flip.d && <span className="text-[10px] font-black text-[#FDE047] animate-pulse">WINNER 🏆</span>}
          </div>
          <div className="flex flex-col items-center">
            <DealerGirl dealing={!isBetting} />
            {revealCards.winner === 'tie' && flip.d && flip.t && <span className="text-[9px] text-[#FDE047] font-black mt-2 animate-pulse">TIE! 50x</span>}
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: '#F97316' }}>🐯 Tiger</span>
            <CardFace card={revealCards.tiger} flipped={flip.t} delay={700} side="tiger" />
            {revealCards.winner === 'tiger' && flip.t && <span className="text-[10px] font-black text-[#FDE047] animate-pulse">WINNER 🏆</span>}
          </div>
        </div>

        {/* Chip selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => setChip(c)}
              className={`shrink-0 w-14 h-14 rounded-full font-black text-xs tabular-nums active:scale-95 transition-all`}
              style={{
                background: chip === c
                  ? 'conic-gradient(from 45deg, #FFD700 0deg 45deg, #DC2626 45deg 90deg, #FFD700 90deg 135deg, #DC2626 135deg 180deg, #FFD700 180deg 225deg, #DC2626 225deg 270deg, #FFD700 270deg 315deg, #DC2626 315deg 360deg)'
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

        {/* Bet buttons — Dragon / Tie / Tiger */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'dragon', label: 'DRAGON', emoji: '🐉', payout: '2x', bg: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)', border: '#FCA5A5', shadow: 'rgba(220,38,38,0.5)', text: '#FFFFFF', pay: '#FDE68A' },
            { key: 'tie', label: 'TIE', emoji: '🤝', payout: '50x', bg: 'linear-gradient(135deg, #FFD700 0%, #B45309 100%)', border: '#FEF3C7', shadow: 'rgba(255,215,0,0.5)', text: '#0A0A14', pay: '#7F1D1D' },
            { key: 'tiger', label: 'TIGER', emoji: '🐯', payout: '2x', bg: 'linear-gradient(135deg, #F97316 0%, #7C2D12 100%)', border: '#FED7AA', shadow: 'rgba(249,115,22,0.5)', text: '#FFFFFF', pay: '#FDE68A' },
          ].map((opt) => {
            const myBet = myBetsThisRound[opt.key] || 0;
            return (
              <button key={opt.key} disabled={!isBetting || placing} onClick={() => placeBet(opt.key)}
                data-testid={`bet-${opt.key}`}
                className="relative rounded-2xl py-4 active:scale-95 disabled:opacity-60"
                style={{ background: opt.bg, border: `2px solid ${opt.border}`, boxShadow: `0 6px 16px ${opt.shadow}` }}>
                {!isBetting && (
                  <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)', border: '1.5px solid #FDE047' }}>
                    <span className="text-[11px]">🔒</span>
                  </div>
                )}
                {myBet > 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black tabular-nums"
                    style={{ background: '#0A0A14', color: '#FDE047', border: '1px solid #FDE047' }} data-testid={`my-bet-${opt.key}`}>
                    You: ₹{Math.floor(myBet)}
                  </div>
                )}
                <div className="text-3xl mb-1">{opt.emoji}</div>
                <div className="font-black text-sm" style={{ color: opt.text }}>{opt.label}</div>
                <div className="text-[10px] font-bold" style={{ color: opt.pay }}>{opt.payout}</div>
              </button>
            );
          })}
        </div>

        {/* Recent rounds strip */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">Last 10 Results</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {recentRounds.filter(r => r.winner).slice(0, 10).map((r, i) => (
              <div key={i} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black"
                style={{
                  background: r.winner === 'dragon' ? '#DC2626' : r.winner === 'tiger' ? '#F97316' : '#FFD700',
                  color: r.winner === 'tie' ? '#0A0A14' : '#FFF',
                  border: '2px solid rgba(0,0,0,0.4)',
                }}
                title={`${r.winner}: D=${r.dragon?.rank}${r.dragon?.suit} T=${r.tiger?.rank}${r.tiger?.suit}`}
              >
                {r.winner === 'dragon' ? 'D' : r.winner === 'tiger' ? 'T' : 'T='}
              </div>
            ))}
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
                  <span className="font-black" style={{ color: b.side === 'dragon' ? '#F87171' : b.side === 'tiger' ? '#FB923C' : '#FDE047' }}>
                    {b.side?.toUpperCase()} · ₹{Math.floor(b.amount || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Casino-Style Bet History */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2">Your Tickets ({history.length})</p>
          {history.length === 0 ? (
            <div className="rounded-xl py-6 text-center text-[11px] text-yellow-200/70"
              style={{ background: 'rgba(20,20,43,0.5)', border: '1px dashed rgba(255,215,0,0.3)' }}>
              🎰 Koi ticket abhi tak nahi — pehla bet lagao aur casino ticket paayen!
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
                  }} data-testid={`dt-ticket-${i}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded" style={{ background: statusColor, color: '#0A0A14' }}>{label}</span>
                      <span className="text-[9px] text-gray-400 tracking-wider">LB-DT-{String(b.bet_id).slice(-6).toUpperCase()}</span>
                      <span className="ml-auto text-[9px] text-gray-400">{new Date(b.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{b.side === 'dragon' ? '🐉' : b.side === 'tiger' ? '🐯' : '🤝'}</span>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-black text-gray-400">Your Pick</p>
                          <p className="text-sm font-black uppercase" style={{ color: b.side === 'dragon' ? '#F87171' : b.side === 'tiger' ? '#FB923C' : '#FDE047' }}>{b.side}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black">Bet</p>
                        <p className="text-sm font-black text-yellow-300">₹{Math.floor(b.amount)}</p>
                      </div>
                    </div>
                    {!isPending && (
                      <div className="mt-2 pt-2 border-t border-dashed border-white/10 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Winner: <span className="font-black uppercase" style={{ color: b.winner === 'dragon' ? '#F87171' : b.winner === 'tiger' ? '#FB923C' : '#FDE047' }}>{b.winner}</span></span>
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

export default DragonTigerPage;
