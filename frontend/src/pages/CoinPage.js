import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, Clock, Zap, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FooterNav from '../components/FooterNav';
import {
  playCoinFlip, playCoinSpin, playClockTick, playCoinWin,
  setCoinMuted, setCoinUserMuted, isCoinUserMuted, unlockCoinAudio,
} from '../utils/coinAudio';

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
  const [liveFeed, setLiveFeed] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [flipAnim, setFlipAnim] = useState(false);
  // lastResult persists across rounds — face of the last winning side stays
  // visible during the next betting phase until the coin flips again.
  const [lastResult, setLastResult] = useState(() => {
    try { return localStorage.getItem('coin_last_result') || null; } catch (_) { return null; }
  });
  const [muted, setMuted] = useState(isCoinUserMuted());
  const prevRoundIdRef = useRef(null);
  const prevPhaseRef = useRef(null);
  const spinIntervalRef = useRef(null);
  const lastTickSecRef = useRef(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;
    // Enter coin page: sync playback mute to user preference (allow sounds)
    setCoinMuted(isCoinUserMuted());
    return () => {
      // Leave coin page: hard-mute so no sounds leak to background pages
      isActiveRef.current = false;
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      setCoinMuted(true);
    };
  }, []);

  const toggleMute = () => {
    const nm = !muted;
    setMuted(nm);
    setCoinUserMuted(nm);
  };

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

  const fetchLiveFeed = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/coin/live-feed?limit=12`);
      setLiveFeed(data.feed || []);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchCurrent();
    fetchMyCurrent();
    fetchRecent();
    fetchLiveFeed();
    const iv = setInterval(() => { fetchCurrent(); }, 500);   // faster to catch phase transitions
    const iv2 = setInterval(() => { fetchMyCurrent(); fetchRecent(); }, 3000);
    const iv3 = setInterval(() => { fetchLiveFeed(); }, 4000);

    // Unlock Web Audio on first user gesture anywhere on the page.
    // Mobile browsers block AudioContext until user interacts.
    const unlockOnce = () => {
      unlockCoinAudio();
      document.removeEventListener('click', unlockOnce);
      document.removeEventListener('touchstart', unlockOnce);
    };
    document.addEventListener('click', unlockOnce, { once: true });
    document.addEventListener('touchstart', unlockOnce, { once: true });

    return () => {
      clearInterval(iv); clearInterval(iv2); clearInterval(iv3);
      document.removeEventListener('click', unlockOnce);
      document.removeEventListener('touchstart', unlockOnce);
    };
  }, [fetchConfig, fetchCurrent, fetchMyCurrent, fetchRecent, fetchLiveFeed]);

  // Clock tick sound — last 10 seconds of betting phase
  useEffect(() => {
    if (!round) return;
    const sl = round.seconds_left;
    // Only tick during OPEN phase, last 10 sec
    if (round.phase === 'open' && sl > 0 && sl <= 10 && sl !== lastTickSecRef.current) {
      playClockTick();
      lastTickSecRef.current = sl;
    }
    if (round.phase !== 'open') {
      lastTickSecRef.current = null;
    }
  }, [round]);

  // Phase transition effects — flip animation + sounds
  useEffect(() => {
    if (!round) return;
    const prevRid = prevRoundIdRef.current;
    const prevPhase = prevPhaseRef.current;

    // Entering LOCKED → start flipping animation + spin whirr sound loop.
    // Do NOT clear lastResult on new round — face persists until we actually
    // toss again. Clear it only here, when the toss actually starts.
    if (round.phase === 'locked' && prevPhase !== 'locked') {
      setFlipAnim(true);
      playCoinFlip();   // initial launch sound
      // Loop spin whirr every ~180ms
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = setInterval(() => { playCoinSpin(); }, 180);
    }

    // Entering RESULT → stop flip, show landing side + ching sound
    if (round.phase === 'result' && prevPhase !== 'result') {
      setFlipAnim(false);
      setLastResult(round.result_side);
      try { localStorage.setItem('coin_last_result', round.result_side); } catch (_) { /* ignore */ }
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null; }
      // Final landing "ching"
      playCoinFlip();
      // Immediate + delayed refreshes: backend settles bets right after status
      // change, so first refresh may see old balance. Second refresh at 1.5s
      // catches the settled payout.
      refreshUser();
      fetchMyCurrent();
      fetchRecent();
      setTimeout(() => {
        refreshUser();
        fetchMyCurrent();
      }, 1500);
      // Show WIN / LOSS toast based on user's bets in this round
      if (myBets.length > 0) {
        const won = myBets.filter((b) => b.side === round.result_side);
        const lost = myBets.filter((b) => b.side !== round.result_side);
        const totalWin = won.reduce((s, b) => s + (b.amount * (config?.payout_multiplier || 2)), 0);
        const totalLost = lost.reduce((s, b) => s + b.amount, 0);
        if (won.length > 0) {
          toast.success(`🎉 आप जीते! +₹${Math.floor(totalWin).toLocaleString('en-IN')}`, { duration: 4000 });
          setTimeout(() => playCoinWin(), 350);
          try { navigator.vibrate?.([60, 30, 100, 30, 60]); } catch (_) { /* haptic */ }
        }
        if (lost.length > 0 && won.length === 0) {
          toast.error(`😔 Loss! −₹${Math.floor(totalLost).toLocaleString('en-IN')}`, { duration: 4000 });
          try { navigator.vibrate?.(80); } catch (_) { /* haptic */ }
        }
      }
    }

    prevRoundIdRef.current = round.round_id;
    prevPhaseRef.current = round.phase;
  }, [round, refreshUser, fetchMyCurrent, fetchRecent, myBets, config]);

  useEffect(() => () => {
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
  }, []);

  // Seed lastResult from most recent settled round on first load so that when
  // the user opens the page, coin already shows the previous winning face
  // instead of defaulting to HEAD.
  useEffect(() => {
    if (!lastResult && recentRounds.length > 0 && recentRounds[0]?.result_side) {
      setLastResult(recentRounds[0].result_side);
      try { localStorage.setItem('coin_last_result', recentRounds[0].result_side); } catch (_) { /* ignore */ }
    }
  }, [recentRounds, lastResult]);

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
      try { navigator.vibrate?.(20); } catch (_) { /* haptic unavailable */ }
      await refreshUser();
      fetchMyCurrent();
      fetchLiveFeed();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bet failed');
    } finally {
      setPlacing(false);
    }
  };

  const secondsLeft = round?.seconds_left || 0;
  const phase = round?.phase || 'waiting';
  const isLocked = phase !== 'open';
  const isLastTen = phase === 'open' && secondsLeft <= 10 && secondsLeft > 0;

  const fmtTsAgo = (s) => {
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    return `${m}m ago`;
  };

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
        <div className="px-3 py-3 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
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
              हर 1 मिनट में Result • 2x Payout • Min ₹{Math.floor(config?.min_bet || 10)}
            </p>
          </div>
          <button
            onClick={toggleMute}
            data-testid="coin-mute-btn"
            className="p-2 rounded-xl active:scale-90 transition"
            style={{ background: 'rgba(251, 191, 36, 0.12)', border: `1px solid ${THEME.glassBorder}`, color: THEME.goldSoft }}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
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

      <main className="px-3 py-4 space-y-3 relative" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Live Coin + Timer Card */}
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
            {/* Clock timer with tick animation on last 10s */}
            <div
              className={`flex items-center gap-1 font-black text-lg tabular-nums ${isLastTen ? 'coin-timer-urgent' : ''}`}
              style={{
                color: isLastTen ? '#F87171' : THEME.gold,
                textShadow: isLastTen ? '0 0 12px #EF4444' : 'none',
              }}
              data-testid="coin-timer"
            >
              <Clock className={`w-4 h-4 ${isLastTen ? 'coin-clock-tick' : ''}`} />
              {String(secondsLeft).padStart(2, '0')}s
            </div>
          </div>

          {/* Flat 3D coin — two faces (Head front, Tail back), spins on Y-axis.
              During LOCKED phase, CSS animates continuous rotateY (fast spin).
              On RESULT, animation is removed and static rotateY snaps to the
              winning face (0deg = Head, 180deg = Tail). */}
          <div className="flex flex-col items-center justify-center py-6">
            <div
              className="coin-perspective"
              style={{ width: 170, height: 170 }}
            >
              <div
                className={`coin-3d ${flipAnim ? 'coin-3d-spinning' : ''}`}
                data-testid="coin-visual"
                data-face={flipAnim ? 'spin' : (lastResult || 'head')}
                data-final={lastResult || 'head'}
                style={{
                  transform: flipAnim
                    ? undefined
                    : ((lastResult || 'head') === 'tail' ? 'rotateY(180deg)' : 'rotateY(0deg)'),
                }}
              >
                {/* HEAD face (front) */}
                <div className="coin-face coin-face-head">
                  <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: 'block' }}>
                    <defs>
                      <radialGradient id="gradFaceH" cx="50%" cy="50%" r="55%">
                        <stop offset="0%" stopColor="#FCD34D" />
                        <stop offset="70%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#B45309" />
                      </radialGradient>
                    </defs>
                    <circle cx="100" cy="100" r="98" fill="#78350F" />
                    <circle cx="100" cy="100" r="93" fill="#78350F" />
                    {Array.from({ length: 48 }).map((_, i) => {
                      const angle = (i * 360) / 48;
                      const rad = (angle * Math.PI) / 180;
                      const cx = 100 + 88 * Math.cos(rad);
                      const cy = 100 + 88 * Math.sin(rad);
                      return <circle key={i} cx={cx} cy={cy} r="2.2" fill="#FEF3C7" opacity="0.85" />;
                    })}
                    <circle cx="100" cy="100" r="82" fill="url(#gradFaceH)" />
                    <circle cx="100" cy="100" r="72" fill="none" stroke="#78350F" strokeWidth="1.5" opacity="0.55" />
                    <circle cx="100" cy="100" r="66" fill="none" stroke="#78350F" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.55" />
                    {[0, 90, 180, 270].map((deg) => {
                      const rad = ((deg - 90) * Math.PI) / 180;
                      const cx = 100 + 74 * Math.cos(rad);
                      const cy = 100 + 74 * Math.sin(rad);
                      return <text key={deg} x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#78350F" opacity="0.75">★</text>;
                    })}
                    <text x="100" y="126" textAnchor="middle" fontSize="95" fontWeight="900" fill="#78350F" fontFamily="Outfit, sans-serif"
                      style={{ paintOrder: 'stroke fill', stroke: '#FEF3C7', strokeWidth: 2 }}>H</text>
                  </svg>
                </div>

                {/* TAIL face (back — rotated 180deg on Y) */}
                <div className="coin-face coin-face-tail">
                  <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: 'block' }}>
                    <defs>
                      <radialGradient id="gradFaceT" cx="50%" cy="50%" r="55%">
                        <stop offset="0%" stopColor="#C4B5FD" />
                        <stop offset="70%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#4C1D95" />
                      </radialGradient>
                    </defs>
                    <circle cx="100" cy="100" r="98" fill="#2E1065" />
                    <circle cx="100" cy="100" r="93" fill="#2E1065" />
                    {Array.from({ length: 48 }).map((_, i) => {
                      const angle = (i * 360) / 48;
                      const rad = (angle * Math.PI) / 180;
                      const cx = 100 + 88 * Math.cos(rad);
                      const cy = 100 + 88 * Math.sin(rad);
                      return <circle key={i} cx={cx} cy={cy} r="2.2" fill="#DDD6FE" opacity="0.85" />;
                    })}
                    <circle cx="100" cy="100" r="82" fill="url(#gradFaceT)" />
                    <circle cx="100" cy="100" r="72" fill="none" stroke="#2E1065" strokeWidth="1.5" opacity="0.55" />
                    <circle cx="100" cy="100" r="66" fill="none" stroke="#2E1065" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.55" />
                    {[0, 90, 180, 270].map((deg) => {
                      const rad = ((deg - 90) * Math.PI) / 180;
                      const cx = 100 + 74 * Math.cos(rad);
                      const cy = 100 + 74 * Math.sin(rad);
                      return <text key={deg} x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#2E1065" opacity="0.75">★</text>;
                    })}
                    <text x="100" y="126" textAnchor="middle" fontSize="95" fontWeight="900" fill="#2E1065" fontFamily="Outfit, sans-serif"
                      style={{ paintOrder: 'stroke fill', stroke: '#DDD6FE', strokeWidth: 2 }}>T</text>
                  </svg>
                </div>
              </div>
            </div>

            {/* Result text overlay */}
            {phase === 'result' && lastResult && (
              <p
                className="text-2xl font-black mt-4 tracking-widest uppercase coin-result-pop"
                style={{
                  color: lastResult === 'head' ? THEME.headColor : THEME.tailColor,
                  textShadow: `0 0 24px ${lastResult === 'head' ? THEME.headColor : THEME.tailColor}90`,
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
              <span className="text-[9px] font-bold opacity-80">Win 2x • ₹{Math.floor(amount * 2)}</span>
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
              <span className="text-[9px] font-bold opacity-80">Win 2x • ₹{Math.floor(amount * 2)}</span>
            </div>
          </button>
        </div>

        {/* My active bets */}
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

        {/* ═══════════ LIVE BET FEED (real + fake mix) ═══════════ */}
        <div className="rounded-2xl p-3 relative overflow-hidden"
          style={{
            background: THEME.cardBg,
            border: `1px solid ${THEME.glassBorder}`,
          }}
          data-testid="coin-live-feed"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ background: '#EF4444' }} />
                <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: '#EF4444' }} />
              </span>
              <h3 className="text-white font-black text-[13px] uppercase tracking-widest">Live Bet Feed</h3>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: THEME.goldSoft, opacity: 0.6 }}>
              Auto refresh
            </span>
          </div>
          <div className="coin-feed-scroll relative overflow-hidden" style={{ height: 128 }}>
            <div className="coin-feed-track space-y-1.5">
              {[...liveFeed, ...liveFeed].map((f, i) => (
                <div key={i}
                  className="flex items-center justify-between text-[12px] py-1.5 px-2 rounded-lg"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    border: `1px solid ${f.side === 'head' ? THEME.headColor : THEME.tailColor}30`,
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                      style={{ background: f.side === 'head' ? THEME.headColor : THEME.tailColor, color: '#fff' }}
                    >
                      {f.side === 'head' ? 'H' : 'T'}
                    </span>
                    <span className="text-white font-bold truncate">{f.name}</span>
                    <span className="text-[9px] font-bold uppercase" style={{ color: f.side === 'head' ? THEME.headColor : THEME.tailColor }}>
                      {f.side}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-white font-black tabular-nums">₹{Math.floor(f.amount).toLocaleString('en-IN')}</span>
                    <span className="text-[9px]" style={{ color: THEME.goldSoft, opacity: 0.6 }}>{fmtTsAgo(f.ts_ago_sec)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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

        {/* Bottom info */}
        <div
          className="rounded-xl p-3 text-[10px] leading-relaxed"
          style={{
            background: 'rgba(31, 22, 8, 0.6)',
            border: `1px solid ${THEME.glassBorder}`,
            color: THEME.goldSoft,
            opacity: 0.85,
          }}
        >
          <p>• Har 1 minute me naya round + auto flip animation with sound.</p>
          <p>• Win par <span className="font-black" style={{ color: THEME.gold }}>2x payout</span> (no commission).</p>
          <p>• Last 10 seconds ⏰ clock tick sound + locked (koi bet nahi).</p>
          <p>• History → <Link to="/bets" className="underline font-black" style={{ color: THEME.goldBright }}>My Bets</Link> me date/time ke saath dekhein.</p>
        </div>
      </main>

      <FooterNav />
    </div>
  );
};

export default CoinPage;
