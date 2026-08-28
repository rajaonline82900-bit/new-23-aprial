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

// Animated casino dealer girl — SVG illustration (no external assets)
const DealerGirl = ({ dealing }) => (
  <div className="relative" style={{ width: 88, height: 110 }}>
    <style>{`
      @keyframes lb-dealer-idle { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
      @keyframes lb-dealer-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.08) } }
      @keyframes lb-arm-left { 0%,100% { transform: rotate(-10deg) } 50% { transform: rotate(-38deg) } }
      @keyframes lb-arm-right { 0%,100% { transform: rotate(10deg) } 50% { transform: rotate(38deg) } }
      @keyframes lb-sparkle { 0%,100% { opacity: 0.2; transform: scale(0.8) } 50% { opacity: 1; transform: scale(1.15) } }
      .lb-dealer-body { animation: lb-dealer-idle 3s ease-in-out infinite; transform-origin: center bottom }
      .lb-eye { animation: lb-dealer-blink 4s ease-in-out infinite; transform-origin: center }
      .lb-arm-l { transform-origin: 30px 58px; animation: lb-arm-left 2s ease-in-out infinite }
      .lb-arm-r { transform-origin: 58px 58px; animation: lb-arm-right 2s ease-in-out infinite }
      .lb-sparkle { animation: lb-sparkle 1.4s ease-in-out infinite }
      .lb-dealer-dealing .lb-arm-l, .lb-dealer-dealing .lb-arm-r { animation-duration: 0.7s }
      .lb-dealer-dealing .lb-dealer-body { animation-duration: 1.2s }
    `}</style>
    <svg
      viewBox="0 0 88 110"
      width="88" height="110"
      className={dealing ? 'lb-dealer-dealing' : ''}
      style={{ filter: 'drop-shadow(0 6px 12px rgba(255,215,0,0.35))' }}
    >
      {/* sparkles */}
      <g className="lb-sparkle" style={{ transformOrigin: '12px 20px' }}>
        <path d="M12 16 L13 20 L17 21 L13 22 L12 26 L11 22 L7 21 L11 20 Z" fill="#FDE047"/>
      </g>
      <g className="lb-sparkle" style={{ transformOrigin: '76px 32px', animationDelay: '0.6s' }}>
        <path d="M76 28 L77 32 L81 33 L77 34 L76 38 L75 34 L71 33 L75 32 Z" fill="#FDE047"/>
      </g>

      <g className="lb-dealer-body">
        {/* Hair back */}
        <path d="M22 30 Q22 12 44 12 Q66 12 66 30 L66 46 Q66 40 60 40 L28 40 Q22 40 22 46 Z" fill="#1E1B4B"/>
        {/* Neck */}
        <rect x="40" y="38" width="8" height="8" fill="#F3D5B5"/>
        {/* Face */}
        <ellipse cx="44" cy="30" rx="15" ry="17" fill="#F8D5B0"/>
        {/* Hair front bangs */}
        <path d="M29 22 Q34 12 44 12 Q54 12 59 22 Q54 20 44 20 Q34 20 29 22 Z" fill="#1E1B4B"/>
        {/* Side hair strands */}
        <path d="M29 22 Q26 30 28 42 L30 42 Q30 32 32 24 Z" fill="#1E1B4B"/>
        <path d="M59 22 Q62 30 60 42 L58 42 Q58 32 56 24 Z" fill="#1E1B4B"/>
        {/* Eyes */}
        <ellipse className="lb-eye" cx="38" cy="30" rx="1.6" ry="2.2" fill="#0F172A"/>
        <ellipse className="lb-eye" cx="50" cy="30" rx="1.6" ry="2.2" fill="#0F172A"/>
        {/* Cheeks */}
        <circle cx="34" cy="34" r="1.6" fill="#F9A8D4" opacity="0.7"/>
        <circle cx="54" cy="34" r="1.6" fill="#F9A8D4" opacity="0.7"/>
        {/* Lips */}
        <path d="M40 37 Q44 40 48 37 Q44 38 40 37 Z" fill="#DC2626"/>
        {/* Earrings */}
        <circle cx="29" cy="32" r="1.5" fill="#FFD700"/>
        <circle cx="59" cy="32" r="1.5" fill="#FFD700"/>
        {/* Vest / body */}
        <path d="M28 46 L60 46 L64 90 L24 90 Z" fill="#0F172A"/>
        {/* Vest gold trim */}
        <path d="M28 46 L60 46 L61 52 L27 52 Z" fill="#FFD700"/>
        {/* White shirt collar */}
        <path d="M38 46 L50 46 L48 58 L44 62 L40 58 Z" fill="#FFFFFF"/>
        {/* Bow tie */}
        <path d="M40 48 L44 51 L48 48 L48 54 L44 51 L40 54 Z" fill="#DC2626"/>
        <circle cx="44" cy="51" r="1.2" fill="#FDE047"/>
        {/* Gold buttons */}
        <circle cx="44" cy="66" r="1.6" fill="#FFD700"/>
        <circle cx="44" cy="74" r="1.6" fill="#FFD700"/>
        <circle cx="44" cy="82" r="1.6" fill="#FFD700"/>
        {/* Left arm (reaches to dragon) */}
        <g className="lb-arm-l">
          <path d="M28 54 Q18 66 14 78 L20 82 Q26 70 32 60 Z" fill="#0F172A"/>
          <ellipse cx="16" cy="80" rx="4" ry="3.5" fill="#F8D5B0"/>
        </g>
        {/* Right arm (reaches to tiger) */}
        <g className="lb-arm-r">
          <path d="M60 54 Q70 66 74 78 L68 82 Q62 70 56 60 Z" fill="#0F172A"/>
          <ellipse cx="72" cy="80" rx="4" ry="3.5" fill="#F8D5B0"/>
        </g>
      </g>
      {/* Table shadow */}
      <ellipse cx="44" cy="104" rx="26" ry="3" fill="rgba(0,0,0,0.4)"/>
    </svg>
  </div>
);

const CardFace = ({ card, flipped, delay = 0 }) => (
  <div className="relative" style={{ width: 90, height: 130, perspective: 800 }}>
    <div className="absolute inset-0" style={{
      transformStyle: 'preserve-3d',
      transition: `transform 0.7s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
    }}>
      {/* Back */}
      <div className="absolute inset-0 rounded-xl flex items-center justify-center"
        style={{
          backfaceVisibility: 'hidden',
          background: 'linear-gradient(135deg, #B45309 0%, #78350F 50%, #451A03 100%)',
          border: '3px solid #FDE047',
          boxShadow: '0 8px 20px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,215,0,0.4)',
        }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: '#FEF3C7', border: '2px solid #78350F' }}>🐉</div>
      </div>
      {/* Front */}
      <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center bg-white"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          border: '3px solid #FDE047',
          boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
        }}>
        {card ? (
          <>
            <div className="text-4xl font-black" style={{ color: SUIT_COLOR[card.suit] }}>{RANK_LABEL(card.rank)}</div>
            <div className="text-4xl" style={{ color: SUIT_COLOR[card.suit] }}>{card.suit}</div>
          </>
        ) : <div className="text-6xl">?</div>}
      </div>
    </div>
  </div>
);

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
            <CardFace card={revealCards.dragon} flipped={flip.d} />
            {revealCards.winner === 'dragon' && flip.d && <span className="text-[10px] font-black text-[#FDE047] animate-pulse">WINNER 🏆</span>}
          </div>
          <div className="flex flex-col items-center">
            <DealerGirl dealing={!isBetting} />
            <span className="text-[9px] text-yellow-300 tracking-widest font-bold uppercase mt-1">Dealer</span>
            {revealCards.winner === 'tie' && flip.d && flip.t && <span className="text-[9px] text-[#FDE047] font-black mt-1 animate-pulse">TIE! 50x</span>}
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: '#F97316' }}>🐯 Tiger</span>
            <CardFace card={revealCards.tiger} flipped={flip.t} delay={700} />
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
          <button disabled={!isBetting || placing} onClick={() => placeBet('dragon')}
            data-testid="bet-dragon"
            className="rounded-2xl py-4 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)', border: '2px solid #FCA5A5', boxShadow: '0 6px 16px rgba(220,38,38,0.5)' }}>
            <div className="text-3xl mb-1">🐉</div>
            <div className="text-white font-black text-sm">DRAGON</div>
            <div className="text-[10px] font-bold text-yellow-200">2x</div>
          </button>
          <button disabled={!isBetting || placing} onClick={() => placeBet('tie')}
            data-testid="bet-tie"
            className="rounded-2xl py-4 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #FFD700 0%, #B45309 100%)', border: '2px solid #FEF3C7', boxShadow: '0 6px 16px rgba(255,215,0,0.5)' }}>
            <div className="text-3xl mb-1">🤝</div>
            <div className="text-black font-black text-sm">TIE</div>
            <div className="text-[10px] font-bold text-red-900">50x</div>
          </button>
          <button disabled={!isBetting || placing} onClick={() => placeBet('tiger')}
            data-testid="bet-tiger"
            className="rounded-2xl py-4 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #F97316 0%, #7C2D12 100%)', border: '2px solid #FED7AA', boxShadow: '0 6px 16px rgba(249,115,22,0.5)' }}>
            <div className="text-3xl mb-1">🐯</div>
            <div className="text-white font-black text-sm">TIGER</div>
            <div className="text-[10px] font-bold text-yellow-200">2x</div>
          </button>
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
