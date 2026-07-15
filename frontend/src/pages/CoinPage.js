import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Clock, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const THEME = {
  bg: '#0A0A0F',
  glassBg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.10) 0%, rgba(30, 20, 5, 0.55) 100%)',
  glassBorder: 'rgba(251, 191, 36, 0.35)',
  cardBg: 'linear-gradient(160deg, #1F1608 0%, #0A0704 100%)',
  gold: '#FBBF24',
  goldBright: '#FCD34D',
  goldSoft: '#FEF3C7',
  headColor: '#F97316',    // orange for Head
  tailColor: '#8B5CF6',    // violet for Tail
};

const CHIPS = [10, 50, 100, 500, 1000, 2000];

const CoinPage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [round, setRound] = useState(null);
  const [amount, setAmount] = useState(50);
  const [myBets, setMyBets] = useState([]);
  const [recentRounds, setRecentRounds] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [flipAnim, setFlipAnim] = useState(false);   // triggers coin flip CSS
  const [lastResult, setLastResult] = useState(null); // last shown result for animation
  const prevRoundIdRef = useRef(null);
  const prevPhaseRef = useRef(null);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/coin/config`);
      setConfig(data);
      setAmount(Math.max(data.min_bet, 50));
    } catch (e) { /* silent */ }
  }, []);

  const fetchCurrent = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/coin/current`);
      setRound(data);
    } catch (e) { /* silent */ }
  }, []);

  const fetchMyCurrent = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/coin/my-current`, { withCredentials: true });
      setMyBets(data.bets || []);
    } catch (e) { /* silent — not logged in */ }
  }, []);

  const fetchRecent = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/coin/rounds?limit=20`);
      setRecentRounds(data.rounds || []);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchCurrent();
    fetchMyCurrent();
    fetchRecent();
    // Poll every 800ms for smooth timer + round transitions
    const iv = setInterval(() => { fetchCurrent(); }, 800);
    const iv2 = setInterval(() => { fetchMyCurrent(); fetchRecent(); }, 3000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [fetchConfig, fetchCurrent, fetchMyCurrent, fetchRecent]);

  // Detect phase transitions to trigger animations / balance refresh
  useEffect(() => {
    if (!round) return;
    const prevRid = prevRoundIdRef.current;
    const prevPhase = prevPhaseRef.current;

    // New round started → clear last result overlay & reset flip
    if (round.round_id && prevRid && round.round_id !== prevRid) {
      setLastResult(null);
      setFlipAnim(false);
    }

    // Transitioned into 'locked' → start flip animation
    if (round.phase === 'locked' && prevPhase !== 'locked') {
      setFlipAnim(true);
    }

    // Transitioned into 'result' → show final side & refresh balance
    if (round.phase === 'result' && prevPhase !== 'result') {
      setFlipAnim(false);
      setLastResult(round.result_side);
      refreshUser();
      fetchMyCurrent();
      fetchRecent();
    }

    prevRoundIdRef.current = round.round_id;
    prevPhaseRef.current = round.phase;
  }, [round, refreshUser, fetchMyCurrent, fetchRecent]);

  const placeBet = async (side) => {
    if (placing) return;
    if (!round || round.phase !== 'open') {
      toast.error('Betting closed for this round');
      return;
    }
    if ((user?.balance || 0) < amount) {
      toast.error(`Balance kam hai — ₹${amount} chahiye`);
      return;
    }
    setPlacing(true);
    try {
      await axios.post(
        `${API_URL}/api/coin/bet`,
        { side, amount },
        { withCredentials: true }
      );
      toast.success(`₹${amount} on ${side.toUpperCase()} placed!`);
      await refreshUser();
      fetchMyCurrent();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bet failed');
    } finally {
      setPlacing(false);
    }
  };

  const secondsLeft = round?.seconds_left || 0;
  const phase = round?.phase || 'waiting';
  const isLocked = phase !== 'open';

  return (
    <div
      className="min-h-screen pb-24 text-white app-shell relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(251, 191, 36, 0.25) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 80%, rgba(249, 115, 22, 0.15) 0%, transparent 60%),
          ${THEME.bg}
        `,
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          background: 'rgba(10, 10, 15, 0.75)',
          borderBottom: `1px solid ${THEME.glassBorder}`,
        }}
      >
        <div className="px-3 py-3 flex items-center gap-3" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/dashboard">
            <button
              data-testid="coin-back-btn"
              className="p-2 rounded-xl active:scale-90 transition"
              style={{ background: 'rgba(251, 191, 36, 0.12)', border: `1px solid ${THEME.glassBorder}`, color: THEME.gold }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1
              className="text-xl font-black tracking-tight leading-none flex items-center gap-1.5"
              style={{
                background: `linear-gradient(90deg, ${THEME.goldBright} 0%, ${THEME.headColor} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 12px ${THEME.gold}88)`,
              }}
            >
              COIN TOSS
              <Zap className="w-4 h-4" style={{ color: THEME.gold, filter: `drop-shadow(0 0 4px ${THEME.gold})` }} />
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: THEME.goldSoft, opacity: 0.75 }}>
              हर 1 मिनट में Result • 1.8x Payout • Min ₹{Math.floor(config?.min_bet || 10)}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{
              background: 'rgba(16, 185, 129, 0.10)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 0 12px rgba(16,185,129,0.15)',
            }}
          >
            <WalletIcon className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
            <span className="text-[13px] font-black tabular-nums" style={{ color: '#34D399' }} data-testid="coin-balance">
              ₹{Math.floor(user?.balance || 0)}
            </span>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4 relative" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Live Coin Card */}
        <div
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: THEME.glassBg,
            border: `1.5px solid ${THEME.glassBorder}`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 12px 40px rgba(251, 191, 36, 0.18), inset 0 1px 0 rgba(252, 211, 77, 0.12)`,
          }}
        >
          {/* Countdown + Phase */}
          <div className="flex items-center justify-between mb-3">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest"
              style={{
                background: phase === 'open' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                border: `1px solid ${phase === 'open' ? '#34D399' : '#F87171'}70`,
                color: phase === 'open' ? '#34D399' : '#F87171',
              }}
              data-testid="coin-phase"
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: phase === 'open' ? '#34D399' : '#F87171' }} />
              {phase === 'open' ? 'BETTING OPEN' : phase === 'locked' ? 'FLIPPING...' : phase === 'result' ? `RESULT: ${(round?.result_side || '').toUpperCase()}` : 'WAITING'}
            </div>
            <div className="flex items-center gap-1 font-black text-lg tabular-nums" style={{ color: THEME.gold }} data-testid="coin-timer">
              <Clock className="w-4 h-4" />
              {String(secondsLeft).padStart(2, '0')}s
            </div>
          </div>

          {/* Coin visual */}
          <div className="flex flex-col items-center justify-center py-4">
            <div
              className={`coin-3d ${flipAnim ? 'coin-flipping' : ''} ${lastResult ? `coin-final-${lastResult}` : ''}`}
              data-testid="coin-visual"
              style={{
                width: 128,
                height: 128,
                position: 'relative',
                transformStyle: 'preserve-3d',
                filter: `drop-shadow(0 8px 24px ${THEME.gold}70)`,
              }}
            >
              {/* HEAD face */}
              <div
                className="coin-face coin-head"
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 30%, ${THEME.goldBright} 0%, ${THEME.gold} 45%, #B45309 100%)`,
                  border: '3px solid #78350F',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.75rem', fontWeight: 900, color: '#78350F',
                  fontFamily: 'Outfit, sans-serif',
                  boxShadow: `inset 0 4px 8px rgba(255,255,255,0.35), inset 0 -4px 8px rgba(120,53,15,0.35)`,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                }}
              >
                H
              </div>
              {/* TAIL face */}
              <div
                className="coin-face coin-tail"
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 30%, #C4B5FD 0%, ${THEME.tailColor} 45%, #4C1D95 100%)`,
                  border: '3px solid #2E1065',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.75rem', fontWeight: 900, color: '#2E1065',
                  fontFamily: 'Outfit, sans-serif',
                  boxShadow: `inset 0 4px 8px rgba(255,255,255,0.35), inset 0 -4px 8px rgba(46,16,101,0.35)`,
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                T
              </div>
            </div>
            {/* Result text overlay */}
            {phase === 'result' && lastResult && (
              <p
                className="text-2xl font-black mt-4 tracking-widest uppercase animate-pulse"
                style={{
                  color: lastResult === 'head' ? THEME.headColor : THEME.tailColor,
                  textShadow: `0 0 20px ${lastResult === 'head' ? THEME.headColor : THEME.tailColor}80`,
                }}
              >
                {lastResult} WINS
              </p>
            )}
          </div>

          {/* Round pool split */}
          {round && (round.totals?.head > 0 || round.totals?.tail > 0) && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="text-center rounded-xl p-2" style={{ background: 'rgba(249, 115, 22, 0.10)', border: `1px solid ${THEME.headColor}50` }}>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: THEME.headColor }}>Head Pool</p>
                <p className="text-sm font-black tabular-nums text-white">₹{Math.floor(round.totals?.head || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="text-center rounded-xl p-2" style={{ background: 'rgba(139, 92, 246, 0.10)', border: `1px solid ${THEME.tailColor}50` }}>
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: THEME.tailColor }}>Tail Pool</p>
                <p className="text-sm font-black tabular-nums text-white">₹{Math.floor(round.totals?.tail || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Amount selector */}
        <div className="rounded-2xl p-3"
          style={{
            background: THEME.cardBg,
            border: `1px solid ${THEME.glassBorder}`,
          }}
        >
          <p className="text-[10px] mb-2 font-black uppercase tracking-widest" style={{ color: THEME.goldSoft }}>
            Bet Amount
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {CHIPS.map((c) => {
              const isActive = amount === c;
              return (
                <button
                  key={c}
                  onClick={() => setAmount(c)}
                  data-testid={`coin-chip-${c}`}
                  disabled={c < (config?.min_bet || 10) || c > (config?.max_bet || 5000)}
                  className="py-2 rounded-lg text-xs font-black active:scale-95 transition disabled:opacity-30"
                  style={isActive
                    ? {
                        background: `linear-gradient(135deg, ${THEME.gold}, #D97706)`,
                        color: '#1F1608',
                        border: `1px solid ${THEME.goldBright}`,
                        boxShadow: `0 4px 14px ${THEME.gold}70`,
                      }
                    : {
                        background: 'rgba(31, 22, 8, 0.6)',
                        color: THEME.goldSoft,
                        border: '1px solid rgba(251, 191, 36, 0.15)',
                      }
                  }
                >
                  ₹{c >= 1000 ? `${c / 1000}K` : c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Head / Tail bet buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => placeBet('head')}
            disabled={isLocked || placing}
            data-testid="coin-bet-head"
            className="rounded-2xl py-4 font-black text-lg text-white active:scale-[0.97] transition disabled:opacity-40 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${THEME.headColor} 0%, #C2410C 100%)`,
              border: `1.5px solid #FED7AA`,
              boxShadow: isLocked ? 'none' : `0 6px 20px ${THEME.headColor}75, 0 0 12px #FED7AA55, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-3xl leading-none">H</span>
              <span className="text-[11px] font-black tracking-widest uppercase">Head</span>
              <span className="text-[9px] font-bold opacity-80">Win 1.8x • ₹{Math.floor(amount * 1.8)}</span>
            </div>
          </button>
          <button
            onClick={() => placeBet('tail')}
            disabled={isLocked || placing}
            data-testid="coin-bet-tail"
            className="rounded-2xl py-4 font-black text-lg text-white active:scale-[0.97] transition disabled:opacity-40 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${THEME.tailColor} 0%, #6D28D9 100%)`,
              border: `1.5px solid #DDD6FE`,
              boxShadow: isLocked ? 'none' : `0 6px 20px ${THEME.tailColor}75, 0 0 12px #DDD6FE55, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-3xl leading-none">T</span>
              <span className="text-[11px] font-black tracking-widest uppercase">Tail</span>
              <span className="text-[9px] font-bold opacity-80">Win 1.8x • ₹{Math.floor(amount * 1.8)}</span>
            </div>
          </button>
        </div>

        {/* My active bets in this round */}
        {myBets.length > 0 && (
          <div className="rounded-xl p-2 space-y-1"
            style={{ background: 'rgba(31, 22, 8, 0.6)', border: `1px solid ${THEME.glassBorder}` }}
            data-testid="coin-my-bets"
          >
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: THEME.goldSoft, opacity: 0.7 }}>Your Bets This Round</p>
            {myBets.map((b) => (
              <div key={b.bet_id} className="flex items-center justify-between text-[12px] font-bold py-1 px-2 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.3)' }}>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                    style={{ background: b.side === 'head' ? THEME.headColor : THEME.tailColor, color: '#fff' }}
                  >
                    {b.side === 'head' ? 'H' : 'T'}
                  </span>
                  <span className="text-white uppercase text-[10px]">{b.side}</span>
                </span>
                <span className="text-white tabular-nums">₹{Math.floor(b.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent results ticker */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span
              className="w-1 h-5 rounded-full"
              style={{ background: `linear-gradient(180deg, ${THEME.goldBright}, ${THEME.headColor})` }}
            />
            <h3 className="text-white font-black text-sm uppercase tracking-widest">Recent Results</h3>
          </div>
          {recentRounds.length === 0 ? (
            <p className="text-[11px] text-center py-3" style={{ color: THEME.goldSoft, opacity: 0.6 }}>
              No rounds yet — wait for the first flip!
            </p>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {recentRounds.map((r) => (
                <div
                  key={r.round_id}
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-[13px]"
                  style={{
                    background: r.result_side === 'head' ? THEME.headColor : THEME.tailColor,
                    color: '#fff',
                    border: `1.5px solid ${r.result_side === 'head' ? '#FED7AA' : '#DDD6FE'}`,
                    boxShadow: `0 2px 6px ${r.result_side === 'head' ? THEME.headColor : THEME.tailColor}55`,
                  }}
                  title={r.result_side}
                >
                  {r.result_side === 'head' ? 'H' : 'T'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom info card */}
        <div
          className="rounded-xl p-3 text-[10px] leading-relaxed"
          style={{
            background: 'rgba(31, 22, 8, 0.6)',
            border: `1px solid ${THEME.glassBorder}`,
            color: THEME.goldSoft,
            opacity: 0.85,
          }}
        >
          <p>• Har 1 minute me naya round + auto result.</p>
          <p>• Win par <span className="font-black" style={{ color: THEME.gold }}>1.8x payout</span> ({config?.commission_pct || 10}% commission).</p>
          <p>• Last 10 seconds locked (koi bet nahi).</p>
          <p>• History → <Link to="/bets" className="underline font-black" style={{ color: THEME.goldBright }}>My Bets</Link> me date/time ke saath dekhein.</p>
        </div>
      </main>

      <FooterNav />
    </div>
  );
};

export default CoinPage;
