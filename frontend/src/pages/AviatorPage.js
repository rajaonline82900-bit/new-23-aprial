import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Plane, History, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const WS_URL = (API || '').replace(/^http/, 'ws') + '/api/aviator/ws';

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];

const AviatorPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [phase, setPhase] = useState('idle');     // 'betting' | 'flying' | 'crashed'
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(null);
  const [history, setHistory] = useState([]);
  const [bettingRemaining, setBettingRemaining] = useState(0);
  const [activeBets, setActiveBets] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [myBetsList, setMyBetsList] = useState([]);

  // Bet panel state
  const [betAmount, setBetAmount] = useState(10);
  const [autoCashout, setAutoCashout] = useState('');
  const [currentBet, setCurrentBet] = useState(null);   // { round_id, amount, auto_cashout, cashed_out_at }
  const [placing, setPlacing] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);

  const wsRef = useRef(null);
  const lastWonRef = useRef(null);

  // ---------- Initial state load ----------
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/aviator/state`, { withCredentials: true });
        if (data.state) {
          setPhase(data.state.phase);
          setMultiplier(data.state.multiplier || 1.0);
          if (data.state.phase === 'crashed') setCrashPoint(data.state.crash_point);
          if (data.state.phase === 'betting') setBettingRemaining(data.state.betting_remaining || 0);
        }
        if (data.history) setHistory(data.history);
      } catch (e) {
        // initial state fetch fail — websocket may still recover
      }
    })();
    fetchActiveBets();
  }, []);
  // ---------- Countdown ticker for betting phase ----------
  useEffect(() => {
    if (phase !== 'betting') return;
    const id = setInterval(() => {
      setBettingRemaining((r) => Math.max(0, r - 0.1));
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // ---------- WebSocket ----------
  useEffect(() => {
    let closedManually = false;
    let retryDelay = 1000;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { retryDelay = 1000; };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          handleWsMessage(msg);
        } catch (e) { /* ignore parse */ }
      };
      ws.onclose = () => {
        if (!closedManually) setTimeout(connect, retryDelay);
        retryDelay = Math.min(8000, retryDelay * 1.5);
      };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* ignore */ } };
    }
    connect();
    return () => { closedManually = true; try { wsRef.current?.close(); } catch (e) { /* ignore */ } };
  }, []);

  const handleWsMessage = (msg) => {
    if (msg.type === 'snapshot' || msg.type === 'round_start') {
      const s = msg.state;
      setPhase(s.phase);
      setMultiplier(s.multiplier || 1.0);
      if (s.phase === 'betting') {
        setBettingRemaining(s.betting_remaining || 0);
        setCurrentBet(null);
        setCrashPoint(null);
        lastWonRef.current = null;
      }
    } else if (msg.type === 'flying_start') {
      setPhase('flying');
      setMultiplier(1.0);
    } else if (msg.type === 'tick') {
      setMultiplier(msg.multiplier);
      // If user is in flying with auto_cashout, let backend handle, just update bet display
      setCurrentBet((b) => (b && !b.cashed_out_at && b.auto_cashout && msg.multiplier >= b.auto_cashout)
        ? { ...b, cashed_out_at: b.auto_cashout, won: +(b.amount * b.auto_cashout).toFixed(2) }
        : b);
    } else if (msg.type === 'crash') {
      setPhase('crashed');
      setCrashPoint(msg.crash_point);
      setMultiplier(msg.crash_point);
      // refresh history & balance
      setHistory((h) => [{ round_id: 'recent', crash_point: msg.crash_point }, ...h].slice(0, 30));
      setActiveBets([]);
      refreshUser();
      if (currentBet && !currentBet.cashed_out_at) {
        toast.error(`Crash @ ${msg.crash_point}x — Aap ₹${currentBet.amount} haar gaye`);
      }
    } else if (msg.type === 'cashout') {
      setActiveBets((arr) => arr.map((b) =>
        b.name === msg.name && b.amount === msg.amount && !b.cashed_out_at
          ? { ...b, cashed_out_at: msg.multiplier, won: msg.won }
          : b
      ));
    } else if (msg.type === 'new_bet') {
      setActiveBets((arr) => [...arr, { name: msg.name, amount: msg.amount, cashed_out_at: null }]);
    }
  };

  const fetchActiveBets = async () => {
    try {
      const { data } = await axios.get(`${API}/api/aviator/active-bets`, { withCredentials: true });
      setActiveBets(data.bets || []);
    } catch (e) { /* ignore */ }
  };

  // ---------- Actions ----------
  const placeBet = async () => {
    if (placing) return;
    if (phase !== 'betting') { toast.error('Wait for next round'); return; }
    if (!betAmount || betAmount < 5) { toast.error('Min bet ₹5'); return; }
    if ((user?.balance || 0) < betAmount) { toast.error('Insufficient balance'); return; }
    setPlacing(true);
    try {
      const body = { amount: Number(betAmount) };
      const co = Number(autoCashout);
      if (autoCashout && co >= 1.01) body.auto_cashout = co;
      const { data } = await axios.post(`${API}/api/aviator/bet`, body, { withCredentials: true });
      setCurrentBet({ round_id: data.round_id, amount: Number(betAmount), auto_cashout: body.auto_cashout || null, cashed_out_at: null });
      toast.success(`Bet ₹${betAmount} placed`);
      refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bet failed');
    } finally {
      setPlacing(false);
    }
  };

  const doCashout = async () => {
    if (cashingOut || !currentBet || currentBet.cashed_out_at) return;
    if (phase !== 'flying') return;
    setCashingOut(true);
    try {
      const { data } = await axios.post(`${API}/api/aviator/cashout`, {}, { withCredentials: true });
      setCurrentBet((b) => ({ ...b, cashed_out_at: data.multiplier, won: data.won }));
      lastWonRef.current = data.won;
      toast.success(`Cashed out @ ${data.multiplier}x — ₹${data.won}`);
      refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cashout failed');
    } finally {
      setCashingOut(false);
    }
  };

  const openHistory = async () => {
    try {
      const { data } = await axios.get(`${API}/api/aviator/my-bets?limit=30`, { withCredentials: true });
      setMyBetsList(data.bets || []);
      setShowHistory(true);
    } catch (e) {
      toast.error('History load fail');
    }
  };

  // ---------- Plane curve animation ----------
  const planePos = useMemo(() => {
    // Map multiplier to (x%, y%) along a quadratic curve.
    // multiplier 1 → bottom-left ; multiplier 5+ → top-right
    const m = Math.min(8, multiplier);
    const t = Math.min(1, Math.log(m) / Math.log(8)); // 0..1
    const x = 8 + t * 78;       // 8% .. 86%
    const y = 78 - t * 60;      // 78% .. 18%
    return { x, y };
  }, [multiplier]);

  const multColor = phase === 'crashed' ? '#EF4444' : (phase === 'flying' ? '#22D3EE' : '#FFD700');

  return (
    <div className="min-h-screen pb-32" style={{ background: '#0A0A14', color: '#FFFFFF' }} data-testid="aviator-page">
      {/* Header */}
      <div
        className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5"
        style={{ background: '#0A0A14', borderBottom: '1px solid #DC2626' }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 text-white font-semibold active:scale-95"
          data-testid="aviator-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <Plane className="w-5 h-5 text-[#DC2626]" strokeWidth={2.5} fill="#DC2626" />
          <span className="text-[#DC2626] font-black text-lg tracking-widest">AVIATOR</span>
        </div>
        <button
          onClick={openHistory}
          className="flex items-center gap-1 text-gray-300 active:scale-95"
          data-testid="aviator-history-btn"
        >
          <History className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(212, 175, 55, 0.5)' }}>
          <Wallet className="w-3.5 h-3.5 text-[#FFD700]" />
          <span className="text-[#FFD700] text-xs font-black tabular-nums" data-testid="aviator-balance">
            ₹{user?.balance?.toFixed(2) || '0.00'}
          </span>
        </div>
      </div>

      {/* Recent crashes ticker */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar" data-testid="aviator-history-strip">
        {history.slice(0, 20).map((h, i) => {
          const v = h.crash_point;
          const color = v >= 10 ? '#A855F7' : v >= 2 ? '#22D3EE' : v >= 1.5 ? '#FACC15' : '#EF4444';
          return (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.08)', color, border: `1px solid ${color}40` }}
            >
              {v.toFixed(2)}x
            </span>
          );
        })}
      </div>

      {/* Game viewport */}
      <div
        className="relative mx-3 rounded-xl overflow-hidden"
        style={{
          height: 'min(60vh, 380px)',
          background: 'radial-gradient(ellipse at bottom left, #2A0A0A 0%, #0A0A14 60%)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
        }}
        data-testid="aviator-viewport"
      >
        {/* Grid lines for visual depth (static — zero scroll cost) */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#DC2626" strokeWidth="0.1" />
          ))}
          {[25, 50, 75].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="#DC2626" strokeWidth="0.1" />
          ))}
        </svg>

        {/* Trajectory curve (drawn from bottom-left to plane position) */}
        {phase !== 'betting' && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#DC2626" stopOpacity="0" />
                <stop offset="100%" stopColor="#DC2626" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 100 Q ${planePos.x / 2} ${100} ${planePos.x} ${planePos.y} L ${planePos.x} 100 Z`}
              fill="url(#trailGrad)"
            />
            <path
              d={`M 0 100 Q ${planePos.x / 2} ${100} ${planePos.x} ${planePos.y}`}
              stroke="#EF4444"
              strokeWidth="0.6"
              fill="none"
            />
          </svg>
        )}

        {/* Multiplier */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === 'betting' && (
            <>
              <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Next Round In</p>
              <p
                className="font-black tabular-nums"
                style={{ color: '#FFD700', fontSize: '4rem', lineHeight: 1, fontFamily: 'Outfit, monospace' }}
                data-testid="aviator-countdown"
              >
                {bettingRemaining.toFixed(1)}s
              </p>
              <p className="text-gray-400 text-xs mt-2 font-semibold">Place your bet now</p>
            </>
          )}
          {phase === 'flying' && (
            <p
              className="font-black tabular-nums"
              style={{ color: multColor, fontSize: '5.5rem', lineHeight: 1, fontFamily: 'Outfit, monospace' }}
              data-testid="aviator-multiplier"
            >
              {multiplier.toFixed(2)}x
            </p>
          )}
          {phase === 'crashed' && (
            <>
              <p className="text-red-400 text-sm font-bold uppercase tracking-widest mb-2">Flew Away!</p>
              <p
                className="font-black tabular-nums"
                style={{ color: '#EF4444', fontSize: '5.5rem', lineHeight: 1, fontFamily: 'Outfit, monospace' }}
                data-testid="aviator-crash-point"
              >
                {(crashPoint || multiplier).toFixed(2)}x
              </p>
            </>
          )}
        </div>

        {/* Plane icon */}
        {phase === 'flying' && (
          <div
            className="absolute transition-none pointer-events-none"
            style={{
              left: `${planePos.x}%`,
              top: `${planePos.y}%`,
              transform: 'translate(-50%, -50%) rotate(-25deg)',
            }}
          >
            <Plane className="w-12 h-12 text-red-500" fill="#DC2626" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Live bets count */}
      <div className="flex items-center justify-between px-4 mt-3 mb-1">
        <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
          Live Bets <span className="text-white tabular-nums">{activeBets.length}</span>
        </span>
        {currentBet?.cashed_out_at && (
          <span className="text-green-400 text-sm font-black tabular-nums" data-testid="aviator-my-win">
            +₹{(currentBet.amount * currentBet.cashed_out_at).toFixed(2)} @ {currentBet.cashed_out_at}x
          </span>
        )}
      </div>

      {/* Live bets list (compact horizontal scroll) */}
      {activeBets.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 no-scrollbar">
          {activeBets.slice(0, 30).map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-1 rounded-md whitespace-nowrap flex-shrink-0"
              style={{
                background: b.cashed_out_at ? 'rgba(34, 197, 94, 0.15)' : 'rgba(220, 38, 38, 0.10)',
                border: `1px solid ${b.cashed_out_at ? 'rgba(34, 197, 94, 0.4)' : 'rgba(220, 38, 38, 0.35)'}`,
              }}
              data-testid={`aviator-live-bet-${i}`}
            >
              <span className="text-[10px] text-white font-bold">{b.name}</span>
              <span className="text-[10px] text-gray-400 tabular-nums">₹{b.amount}</span>
              {b.cashed_out_at && (
                <span className="text-[10px] text-green-400 font-black tabular-nums">{b.cashed_out_at}x</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bet panel - fixed bottom */}
      <div
        className="fixed bottom-0 left-0 right-0 px-3 py-3"
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          background: '#0F0F1A',
          borderTop: '1px solid rgba(220, 38, 38, 0.4)',
        }}
      >
        {/* Amount + quick chips row */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex-1 flex items-center gap-1 px-3 py-2 rounded-lg"
            style={{ background: '#1A1A2E', border: '1px solid rgba(220, 38, 38, 0.3)' }}
          >
            <span className="text-gray-400 text-sm font-bold">₹</span>
            <input
              type="number"
              inputMode="numeric"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value) || 0)}
              disabled={!!currentBet}
              data-testid="aviator-bet-amount"
              className="flex-1 bg-transparent outline-none text-white text-base font-black tabular-nums w-full disabled:opacity-50"
              style={{ minWidth: 0 }}
            />
            <button
              type="button"
              onClick={() => setBetAmount(Math.max(5, betAmount - 10))}
              disabled={!!currentBet}
              className="text-white text-xl font-black px-2 disabled:opacity-30"
              data-testid="aviator-amount-decr"
            >–</button>
            <button
              type="button"
              onClick={() => setBetAmount(betAmount + 10)}
              disabled={!!currentBet}
              className="text-white text-xl font-black px-2 disabled:opacity-30"
              data-testid="aviator-amount-incr"
            >+</button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Auto @"
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            disabled={!!currentBet}
            data-testid="aviator-auto-cashout"
            className="w-20 px-2 py-2 rounded-lg outline-none text-white text-sm font-bold text-center disabled:opacity-50"
            style={{ background: '#1A1A2E', border: '1px solid rgba(220, 38, 38, 0.3)' }}
          />
        </div>

        {/* Quick amount chips */}
        <div className="flex gap-1.5 mb-2">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBetAmount(v)}
              disabled={!!currentBet}
              data-testid={`aviator-quick-${v}`}
              className="flex-1 py-1 rounded-md text-xs font-bold text-white active:scale-95 disabled:opacity-40"
              style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.35)' }}
            >
              ₹{v}
            </button>
          ))}
        </div>

        {/* Action button */}
        {!currentBet ? (
          <button
            type="button"
            onClick={placeBet}
            disabled={placing || phase !== 'betting'}
            data-testid="aviator-place-bet"
            className="w-full py-3.5 rounded-lg text-white font-black text-base uppercase tracking-wider active:scale-95 disabled:opacity-40"
            style={{
              background: phase === 'betting' ? 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' : '#4B5563',
              boxShadow: phase === 'betting' ? '0 4px 14px rgba(22, 163, 74, 0.4)' : 'none',
            }}
          >
            {placing ? 'PLACING...' : phase === 'betting' ? `BET ₹${betAmount}` : 'WAIT FOR NEXT ROUND'}
          </button>
        ) : currentBet.cashed_out_at ? (
          <button
            type="button"
            disabled
            data-testid="aviator-cashed-out"
            className="w-full py-3.5 rounded-lg text-white font-black text-base uppercase tracking-wider"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}
          >
            CASHED OUT @ {currentBet.cashed_out_at}x &nbsp;•&nbsp; +₹{(currentBet.amount * currentBet.cashed_out_at).toFixed(2)}
          </button>
        ) : phase === 'flying' ? (
          <button
            type="button"
            onClick={doCashout}
            disabled={cashingOut}
            data-testid="aviator-cashout-btn"
            className="w-full py-3.5 rounded-lg text-white font-black text-base uppercase tracking-wider active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.45)',
            }}
          >
            {cashingOut ? 'CASHING OUT...' : `CASH OUT @ ${multiplier.toFixed(2)}x  •  ₹${(currentBet.amount * multiplier).toFixed(2)}`}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full py-3.5 rounded-lg text-gray-300 font-black text-base uppercase tracking-wider"
            style={{ background: '#1F2937', border: '1px solid #4B5563' }}
          >
            BET PLACED &nbsp;•&nbsp; ₹{currentBet.amount}  •  WAITING…
          </button>
        )}
      </div>

      {/* My bets history modal */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-hidden flex flex-col"
            style={{ background: '#0F0F1A', border: '1px solid rgba(220, 38, 38, 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 sticky top-0" style={{ background: '#0F0F1A', borderBottom: '1px solid rgba(220, 38, 38, 0.3)' }}>
              <h3 className="text-[#FFD700] font-bold text-base">Meri Aviator Bets</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 font-bold text-xl" data-testid="aviator-history-close">×</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {myBetsList.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Abhi tak koi bet nahi</p>
              ) : myBetsList.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: '#1A1A2E', border: '1px solid rgba(220, 38, 38, 0.25)' }}
                  data-testid={`aviator-bet-row-${b.id}`}
                >
                  <div>
                    <p className="text-white font-bold text-sm">₹{b.amount}</p>
                    <p className="text-gray-400 text-xs">{new Date(b.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    {b.status === 'won' ? (
                      <>
                        <p className="text-green-400 font-bold tabular-nums">+₹{b.won_amount}</p>
                        <p className="text-green-400 text-xs">@ {b.cashout_multiplier}x</p>
                      </>
                    ) : (
                      <p className="text-red-400 font-bold">LOST</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AviatorPage;
