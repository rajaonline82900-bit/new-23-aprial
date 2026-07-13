import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, History, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const WS_URL = (API || '').replace(/^http/, 'ws') + '/api/aviator/ws';

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];

/* ------------ Red propeller plane (Aviator-style) ------------ */
const PropellerPlane = ({ size = 72 }) => (
  <svg viewBox="0 0 100 60" width={size} height={size * 0.6} xmlns="http://www.w3.org/2000/svg">
    {/* propeller blur (front) */}
    <ellipse cx="92" cy="30" rx="3.5" ry="14" fill="#7F1D1D" opacity="0.55" />
    <line x1="92" y1="14" x2="92" y2="46" stroke="#FCA5A5" strokeWidth="1.2" />
    {/* fuselage */}
    <path
      d="M 8 32 Q 5 28 10 25 L 70 23 Q 88 22 92 30 Q 88 38 70 37 L 28 38 Q 14 38 8 32 Z"
      fill="#DC2626" stroke="#7F1D1D" strokeWidth="1"
    />
    {/* wing */}
    <path d="M 38 24 L 56 8 L 64 8 L 50 24 Z" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="0.8" />
    {/* lower wing */}
    <path d="M 38 36 L 52 50 L 60 50 L 50 36 Z" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="0.8" />
    {/* tail */}
    <path d="M 8 32 L 0 18 L 10 22 Z" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="0.8" />
    <path d="M 8 32 L 0 46 L 10 38 Z" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="0.8" />
    {/* cockpit window */}
    <path d="M 64 26 Q 70 24 74 28 L 74 31 L 64 31 Z" fill="#0A0A14" stroke="#7F1D1D" strokeWidth="0.5" />
    {/* X marks (tail decals) */}
    <text x="18" y="34" fontSize="6" fill="#FCA5A5" fontWeight="bold" fontFamily="sans-serif">X</text>
    <text x="76" y="34" fontSize="6" fill="#FCA5A5" fontWeight="bold" fontFamily="sans-serif">X</text>
  </svg>
);


/* ------------ Single Bet Panel (Spribe-style stacked) ------------ */
const BetPanel = ({
  panelId, phase, multiplier, balance,
  amount, setAmount, autoCashout, setAutoCashout,
  mode, setMode, currentBet, placing, cashingOut,
  onPlace, onCashout, onClose,
}) => {
  const winAmt = currentBet ? currentBet.amount * multiplier : 0;
  return (
    <div
      className="rounded-2xl p-2.5"
      style={{ background: '#141420', border: '1px solid rgba(220, 38, 38, 0.18)' }}
      data-testid={`aviator-panel-${panelId}`}
    >
      {/* Bet / Auto tabs */}
      <div className="flex items-center justify-center gap-1 mb-2 relative">
        <div className="inline-flex p-0.5 rounded-full" style={{ background: '#0A0A14' }}>
          {['bet', 'auto'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              data-testid={`panel-${panelId}-mode-${m}`}
              className="px-4 py-1 rounded-full text-xs font-bold capitalize"
              style={mode === m
                ? { background: '#2D2D40', color: '#FFFFFF' }
                : { background: 'transparent', color: '#9CA3AF' }
              }
            >
              {m === 'bet' ? 'Bet' : 'Auto'}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            data-testid={`panel-${panelId}-close`}
            className="absolute right-0 text-gray-400 active:scale-90"
            aria-label="Close panel"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Amount stepper + quick chips */}
        <div className="flex-1">
          <div
            className="flex items-center justify-between px-2 py-2 rounded-full mb-1.5"
            style={{ background: '#0A0A14', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <button
              type="button"
              onClick={() => setAmount(Math.max(5, Number(amount) - 10))}
              disabled={!!currentBet}
              data-testid={`panel-${panelId}-decr`}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 active:scale-90 disabled:opacity-30"
              style={{ background: '#2D2D40' }}
            >–</button>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              disabled={!!currentBet}
              data-testid={`panel-${panelId}-amount`}
              className="flex-1 bg-transparent outline-none text-white text-base font-black tabular-nums text-center w-full disabled:opacity-50"
              style={{ minWidth: 0 }}
            />
            <button
              type="button"
              onClick={() => setAmount(Number(amount) + 10)}
              disabled={!!currentBet}
              data-testid={`panel-${panelId}-incr`}
              className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 active:scale-90 disabled:opacity-30"
              style={{ background: '#2D2D40' }}
            >+</button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[1000, 2000, 10000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                disabled={!!currentBet}
                data-testid={`panel-${panelId}-quick-${v}`}
                className="text-[11px] font-bold py-1 rounded-full text-gray-300 active:scale-95 disabled:opacity-40"
                style={{ background: '#0A0A14', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {v.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
          {mode === 'auto' && (
            <input
              type="number"
              inputMode="decimal"
              placeholder="Auto cashout @"
              value={autoCashout}
              onChange={(e) => setAutoCashout(e.target.value)}
              disabled={!!currentBet}
              data-testid={`panel-${panelId}-auto-cashout`}
              className="w-full mt-1.5 px-3 py-1.5 rounded-full outline-none text-white text-xs font-bold text-center disabled:opacity-50"
              style={{ background: '#0A0A14', border: '1px solid rgba(220, 38, 38, 0.3)' }}
            />
          )}
        </div>

        <div className="flex-1">
          {!currentBet ? (
            <button
              type="button"
              onClick={onPlace}
              disabled={placing || phase !== 'betting'}
              data-testid={`panel-${panelId}-place`}
              className="w-full h-[88px] rounded-2xl text-white font-black flex flex-col items-center justify-center active:scale-95 disabled:opacity-40 leading-tight"
              style={{
                background: phase === 'betting' ? 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' : '#3F3F46',
                border: phase === 'betting' ? '2px solid #16A34A' : '1px solid #4B5563',
              }}
            >
              {phase === 'betting' ? (
                <>
                  <span className="text-base">Bet</span>
                  <span className="text-xl tabular-nums">{Number(amount).toFixed(2)}</span>
                </>
              ) : (
                <span className="text-sm uppercase tracking-wider">Wait for next round</span>
              )}
            </button>
          ) : currentBet.cashed_out_at ? (
            <button
              type="button"
              disabled
              data-testid={`panel-${panelId}-cashed`}
              className="w-full h-[88px] rounded-2xl text-white font-black flex flex-col items-center justify-center leading-tight"
              style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)' }}
            >
              <span className="text-xs uppercase tracking-widest">Cashed Out @ {currentBet.cashed_out_at}x</span>
              <span className="text-lg tabular-nums mt-0.5">+₹{(currentBet.amount * currentBet.cashed_out_at).toFixed(2)}</span>
            </button>
          ) : phase === 'flying' ? (
            <button
              type="button"
              onClick={onCashout}
              disabled={cashingOut}
              data-testid={`panel-${panelId}-cashout`}
              className="w-full h-[88px] rounded-2xl text-white font-black flex flex-col items-center justify-center active:scale-95 leading-tight"
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
                border: '2px solid #F59E0B',
              }}
            >
              <span className="text-xs uppercase tracking-widest">Cash Out</span>
              <span className="text-xl tabular-nums">₹{winAmt.toFixed(2)}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              data-testid={`panel-${panelId}-waiting`}
              className="w-full h-[88px] rounded-2xl text-gray-300 font-black flex flex-col items-center justify-center leading-tight"
              style={{ background: '#1F2937', border: '1px solid #4B5563' }}
            >
              <span className="text-xs uppercase">Bet Placed</span>
              <span className="text-lg tabular-nums">₹{currentBet.amount}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------ Main page ------------ */
const AviatorPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [phase, setPhase] = useState('idle');
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(null);
  const [history, setHistory] = useState([]);
  const [bettingRemaining, setBettingRemaining] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [myBetsList, setMyBetsList] = useState([]);

  // Two bet panels (Spribe parity)
  const [panel1, setPanel1] = useState({ amount: 100, autoCashout: '', mode: 'bet', bet: null, placing: false, cashingOut: false });
  const [panel2, setPanel2] = useState({ amount: 100, autoCashout: '', mode: 'bet', bet: null, placing: false, cashingOut: false });
  const [showPanel2, setShowPanel2] = useState(false);

  // Community feed
  const [feedTab, setFeedTab] = useState('all');
  const [feedItems, setFeedItems] = useState([]);
  const [feedMeta, setFeedMeta] = useState({ total: 0, totalWin: 0 });

  const wsRef = useRef(null);

  /* ---------- initial load + countdown ---------- */
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
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (phase !== 'betting') return;
    const id = setInterval(() => setBettingRemaining((r) => Math.max(0, r - 0.1)), 100);
    return () => clearInterval(id);
  }, [phase]);

  /* ---------- WebSocket with HTTP polling fallback ----------
     On some VPS / Nginx setups the WSS upgrade can fail silently. We:
     1. Always try WebSocket first (real-time, low latency).
     2. ALSO start an HTTP poller as a safety net. While the WS is healthy
        the poller is throttled to 2.5s; if WS goes >4s without a message
        the poller speeds up to 600ms so the game keeps moving even if
        WebSocket never works.
  */
  const lastWsMsgRef = useRef(Date.now());

  useEffect(() => {
    let closedManually = false;
    let retryDelay = 1000;
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { retryDelay = 1000; lastWsMsgRef.current = Date.now(); };
      ws.onmessage = (ev) => {
        lastWsMsgRef.current = Date.now();
        try {
          const msg = JSON.parse(ev.data);
          handleWsMessage(msg);
        } catch (e) { /* ignore */ }
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

  // HTTP polling safety net — keeps phase/multiplier in sync even when WS is dead.
  useEffect(() => {
    let alive = true;
    let lastCrashRoundId = null;
    const poll = async () => {
      if (!alive) return;
      try {
        const { data } = await axios.get(`${API}/api/aviator/state`, { withCredentials: true });
        if (data.state) {
          const s = data.state;
          setPhase((prev) => {
            // When poller observes a phase change, mimic the same UI side-effects as WS.
            if (prev !== s.phase) {
              if (s.phase === 'betting') {
                setCrashPoint(null);
                setPanel1((p) => ({ ...p, bet: null }));
                setPanel2((p) => ({ ...p, bet: null }));
              } else if (s.phase === 'crashed') {
                if (s.round_id && s.round_id !== lastCrashRoundId) {
                  lastCrashRoundId = s.round_id;
                  setHistory((h) => [{ round_id: s.round_id, crash_point: s.crash_point }, ...h].slice(0, 30));
                  refreshUser();
                }
                if (s.crash_point) setCrashPoint(s.crash_point);
              }
            }
            return s.phase;
          });
          setMultiplier(s.multiplier || 1.0);
          if (s.phase === 'betting') setBettingRemaining(s.betting_remaining || 0);
          if (s.phase === 'crashed' && s.crash_point) setCrashPoint(s.crash_point);
        }
        if (data.history && data.history.length > 0) {
          setHistory((cur) => (cur.length === 0 ? data.history : cur));
        }
      } catch (e) { /* ignore network blips */ }
    };
    // Kick off immediately, then loop.
    poll();
    const id = setInterval(() => {
      const sinceWs = Date.now() - lastWsMsgRef.current;
      // If WS hasn't sent anything in >4s, poll fast; otherwise slow.
      if (sinceWs > 4000) poll();
      else if (sinceWs > 1500) poll(); // mild backup
    }, 600);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const handleWsMessage = (msg) => {
    if (msg.type === 'snapshot' || msg.type === 'round_start') {
      const s = msg.state;
      setPhase(s.phase);
      setMultiplier(s.multiplier || 1.0);
      if (s.phase === 'betting') {
        setBettingRemaining(s.betting_remaining || 0);
        setCrashPoint(null);
        setPanel1((p) => ({ ...p, bet: null }));
        setPanel2((p) => ({ ...p, bet: null }));
      }
    } else if (msg.type === 'flying_start') {
      setPhase('flying');
      setMultiplier(1.0);


    } else if (msg.type === 'tick') {
      setMultiplier(msg.multiplier);
      [setPanel1, setPanel2].forEach((set) =>
        set((p) => {
          if (p.bet && !p.bet.cashed_out_at && p.bet.auto_cashout && msg.multiplier >= p.bet.auto_cashout) {

            return { ...p, bet: { ...p.bet, cashed_out_at: p.bet.auto_cashout } };
          }
          return p;
        })
      );
    } else if (msg.type === 'crash') {
      setPhase('crashed');
      setCrashPoint(msg.crash_point);
      setMultiplier(msg.crash_point);
      setHistory((h) => [{ round_id: 'recent', crash_point: msg.crash_point }, ...h].slice(0, 30));


      refreshUser();
    }
  };

  /* ---------- Community feed polling ---------- */
  useEffect(() => {
    let id;
    const fetchFeed = async () => {
      try {
        const { data } = await axios.get(`${API}/api/aviator/community-bets?tab=${feedTab}&limit=40`, { withCredentials: true });
        const items = data.bets || [];
        setFeedItems(items);
        const won = items.filter((b) => b.won != null);
        setFeedMeta({ total: items.length, totalWin: won.reduce((s, b) => s + (b.won || 0), 0) });
      } catch (e) { /* ignore */ }
    };
    fetchFeed();
    // refresh every 3s while round live; 6s while crashed/betting (lighter load)
    id = setInterval(fetchFeed, phase === 'flying' ? 3000 : 6000);
    return () => clearInterval(id);
  }, [feedTab, phase]);

  /* ---------- Actions ---------- */
  const placeBet = async (panelKey) => {
    const set = panelKey === 1 ? setPanel1 : setPanel2;
    const p = panelKey === 1 ? panel1 : panel2;
    if (p.placing) return;
    if (phase !== 'betting') { toast.error('Wait for next round'); return; }
    if (!p.amount || p.amount < 5) { toast.error('Min bet ₹5'); return; }
    if (p.bet) { toast.error('Already have an active bet'); return; }
    if ((user?.balance || 0) < p.amount) { toast.error('Insufficient balance'); return; }

    // Backend allows only 1 bet per user per round — check other panel
    const other = panelKey === 1 ? panel2 : panel1;
    if (other.bet && !other.bet.cashed_out_at) {
      toast.error('Already have an active bet in the other panel');
      return;
    }
    set((s) => ({ ...s, placing: true }));
    try {
      const body = { amount: Number(p.amount) };
      const co = Number(p.autoCashout);
      if (p.mode === 'auto' && co >= 1.01) body.auto_cashout = co;
      const { data } = await axios.post(`${API}/api/aviator/bet`, body, { withCredentials: true });
      set((s) => ({
        ...s,
        bet: { round_id: data.round_id, amount: Number(p.amount), auto_cashout: body.auto_cashout || null, cashed_out_at: null },
      }));

      toast.success(`Bet ₹${p.amount} placed`);
      refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bet failed');
    } finally {
      set((s) => ({ ...s, placing: false }));
    }
  };

  const cashOut = async (panelKey) => {
    const set = panelKey === 1 ? setPanel1 : setPanel2;
    const p = panelKey === 1 ? panel1 : panel2;
    if (p.cashingOut || !p.bet || p.bet.cashed_out_at) return;
    if (phase !== 'flying') return;
    set((s) => ({ ...s, cashingOut: true }));
    try {
      const { data } = await axios.post(`${API}/api/aviator/cashout`, {}, { withCredentials: true });
      set((s) => ({ ...s, bet: { ...s.bet, cashed_out_at: data.multiplier } }));

      toast.success(`Cashed out @ ${data.multiplier}x — ₹${data.won}`);
      refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cashout failed');
    } finally {
      set((s) => ({ ...s, cashingOut: false }));
    }
  };

  const openHistory = async () => {
    try {
      const { data } = await axios.get(`${API}/api/aviator/my-bets?limit=30`, { withCredentials: true });
      setMyBetsList(data.bets || []);
      setShowHistory(true);
    } catch (e) { toast.error('History load fail'); }
  };

  /* ---------- Plane position along curve ---------- */
  const planePos = useMemo(() => {
    const m = Math.min(8, multiplier);
    const t = Math.min(1, Math.log(m) / Math.log(8));
    const x = 8 + t * 78;
    const y = 78 - t * 60;
    return { x, y };
  }, [multiplier]);

  const multColor = phase === 'crashed' ? '#EF4444' : (phase === 'flying' ? '#FFFFFF' : '#FFD700');

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen pb-44" style={{ background: '#0A0A14', color: '#FFFFFF' }} data-testid="aviator-page">
      {/* Header */}
      <div
        className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5"
        style={{ background: '#0A0A14', borderBottom: '1px solid rgba(220, 38, 38, 0.5)' }}
      >
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-white active:scale-95" data-testid="aviator-back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <PropellerPlane size={28} />
          <span className="text-[#DC2626] font-black text-lg tracking-widest" style={{ fontFamily: 'Outfit, sans-serif', fontStyle: 'italic' }}>Aviator</span>
        </div>
        <button onClick={openHistory} className="text-gray-300 active:scale-95" data-testid="aviator-history-btn">
          <History className="w-5 h-5" />
        </button>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{ background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(212, 175, 55, 0.5)' }}
        >
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
              className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums whitespace-nowrap"
              style={{ background: 'transparent', color, border: `1px solid ${color}55` }}
            >
              {v.toFixed(2)}x
            </span>
          );
        })}
      </div>

      {/* Game viewport — Reddy66 style radial purple/red bg with sun-ray streaks.
          Streaks are 6 lightweight static SVG lines + a CSS conic-gradient backup.
          Reduced from 12→6 streaks for low-end Android WebView smoothness. */}
      <div
        className="relative mx-3 rounded-xl overflow-hidden"
        style={{
          height: 'min(45vh, 320px)',
          background: 'radial-gradient(ellipse at 30% 70%, #4C1D95 0%, #1E0B36 35%, #0A0A14 75%)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          contain: 'content',
        }}
        data-testid="aviator-viewport"
      >
        {/* Static sun-ray streaks — only 6, drawn once, never repainted on scroll */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="rayG" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(168, 85, 247, 0)" />
              <stop offset="20%" stopColor="rgba(168, 85, 247, 0.18)" />
              <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
            </linearGradient>
          </defs>
          {[25, 35, 45, 55, 65, 75].map((angle, i) => {
            const x2 = 100 * Math.cos((angle * Math.PI) / 180);
            const y2 = 100 - 100 * Math.sin((angle * Math.PI) / 180);
            return (
              <line key={i} x1="0" y1="100" x2={x2} y2={y2} stroke="url(#rayG)" strokeWidth="2.5" opacity={i % 2 === 0 ? 0.55 : 0.3} />
            );
          })}
        </svg>

        {/* Trajectory curve + plane */}
        {phase !== 'betting' && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="trailGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#DC2626" stopOpacity="0" />
                <stop offset="100%" stopColor="#DC2626" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 100 Q ${planePos.x / 2} 100 ${planePos.x} ${planePos.y} L ${planePos.x} 100 Z`}
              fill="url(#trailGrad)"
            />
            <path
              d={`M 0 100 Q ${planePos.x / 2} 100 ${planePos.x} ${planePos.y}`}
              stroke="#FF1744"
              strokeWidth="0.8"
              fill="none"
            />
          </svg>
        )}

        {/* Multiplier overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {phase === 'betting' && (
            <p className="text-gray-300 text-xs font-bold uppercase tracking-widest" style={{ position: 'absolute', top: '24%' }}>
              Place your bet — Plane taking off soon
            </p>
          )}
          {phase === 'flying' && (
            <p
              className="font-black tabular-nums"
              style={{ color: multColor, fontSize: '5.5rem', lineHeight: 1, fontFamily: 'Outfit, sans-serif' }}
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
                style={{ color: '#EF4444', fontSize: '5rem', lineHeight: 1, fontFamily: 'Outfit, sans-serif' }}
                data-testid="aviator-crash-point"
              >
                {(crashPoint || multiplier).toFixed(2)}x
              </p>
            </>
          )}
        </div>

        {/* Static grounded plane during betting phase (bottom-left, level on runway) */}
        {phase === 'betting' && (
          <div
            className="absolute pointer-events-none"
            style={{ left: '10%', bottom: '14%' }}
            data-testid="aviator-grounded-plane"
          >
            <PropellerPlane size={72} />
          </div>
        )}

        {/* Red progress bar (fills over 10s during betting phase) */}
        {phase === 'betting' && (
          <div
            className="absolute"
            style={{
              left: '6%',
              right: '6%',
              bottom: '9%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden',
              border: '1px solid rgba(220, 38, 38, 0.35)',
            }}
            data-testid="aviator-progress-track"
          >
            <div
              data-testid="aviator-progress-fill"
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, ((10 - bettingRemaining) / 10) * 100))}%`,
                background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 50%, #FCA5A5 100%)',
                boxShadow: '0 0 8px rgba(220, 38, 38, 0.7)',
                transition: 'width 120ms linear',
              }}
            />
          </div>
        )}

        {/* Plane sprite — GPU-accelerated transform + short transition so
            the plane visually glides between multiplier ticks (150ms) instead
            of jumping. `will-change` promotes to compositor layer for smooth
            animation on low-end Android. */}
        {phase === 'flying' && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: '1%',
              height: '1%',
              transform: `translate3d(${planePos.x * 100}%, ${planePos.y * 100}%, 0) translate(-50%, -50%) rotate(-25deg)`,
              transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            <PropellerPlane size={72} />
          </div>
        )}

        {/* Live bets count chip (bottom-right of viewport) */}
        <div
          className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="flex -space-x-1.5">
            {['#EF4444', '#A855F7', '#22D3EE'].map((c, i) => (
              <span key={i} className="w-4 h-4 rounded-full border border-black" style={{ background: c }} />
            ))}
          </div>
          <span className="text-white text-[11px] font-bold tabular-nums" data-testid="aviator-live-count">
            {feedMeta.total}
          </span>
        </div>
      </div>

      {/* Bet Panel 1 */}
      <div className="px-3 mt-3">
        <BetPanel
          panelId={1}
          phase={phase} multiplier={multiplier} balance={user?.balance}
          amount={panel1.amount} setAmount={(v) => setPanel1((p) => ({ ...p, amount: v }))}
          autoCashout={panel1.autoCashout} setAutoCashout={(v) => setPanel1((p) => ({ ...p, autoCashout: v }))}
          mode={panel1.mode} setMode={(v) => setPanel1((p) => ({ ...p, mode: v }))}
          currentBet={panel1.bet} placing={panel1.placing} cashingOut={panel1.cashingOut}
          onPlace={() => placeBet(1)} onCashout={() => cashOut(1)}
        />
      </div>

      {/* Bet Panel 2 (toggleable) */}
      {showPanel2 ? (
        <div className="px-3 mt-2">
          <BetPanel
            panelId={2}
            phase={phase} multiplier={multiplier} balance={user?.balance}
            amount={panel2.amount} setAmount={(v) => setPanel2((p) => ({ ...p, amount: v }))}
            autoCashout={panel2.autoCashout} setAutoCashout={(v) => setPanel2((p) => ({ ...p, autoCashout: v }))}
            mode={panel2.mode} setMode={(v) => setPanel2((p) => ({ ...p, mode: v }))}
            currentBet={panel2.bet} placing={panel2.placing} cashingOut={panel2.cashingOut}
            onPlace={() => placeBet(2)} onCashout={() => cashOut(2)}
            onClose={() => setShowPanel2(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPanel2(true)}
          data-testid="aviator-add-panel"
          className="mx-3 mt-2 w-[calc(100%-1.5rem)] py-1.5 rounded-full text-gray-400 text-xs font-bold flex items-center justify-center gap-1 active:scale-95"
          style={{ background: '#141420', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Add Second Bet
        </button>
      )}

      {/* RECENT WINNERS — prominent green highlight strip with names + amounts */}
      {(() => {
        const winners = feedItems.filter((b) => b.won && b.won > 0).slice(0, 10);
        if (winners.length === 0) return null;
        return (
          <div className="px-3 mt-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[#86EFAC] text-xs font-black uppercase tracking-widest">🏆 Recent Winners</span>
              <span className="text-gray-500 text-[10px]">{winners.length} jeete</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" data-testid="aviator-winners-strip">
              {winners.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.20) 0%, rgba(21, 128, 61, 0.10) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.45)',
                  }}
                  data-testid={`aviator-winner-${i}`}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                    style={{ background: ['#EF4444','#A855F7','#22D3EE','#FACC15','#34D399'][i % 5] }}
                  >
                    {w.name?.[0]?.toUpperCase() || 'P'}
                  </span>
                  <div className="leading-tight">
                    <p className="text-white text-[12px] font-bold whitespace-nowrap">{w.name}</p>
                    <p className="text-[#86EFAC] text-[13px] font-black tabular-nums whitespace-nowrap">
                      +₹{Number(w.won).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-cyan-400 text-[10px] font-bold ml-1">@ {w.multiplier?.toFixed(2)}x</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Community feed tabs */}
      <div className="px-3 mt-4">
        <div
          className="flex items-stretch gap-1 p-0.5 rounded-full"
          style={{ background: '#141420', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {[
            { id: 'all',      label: 'All Bets' },
            { id: 'previous', label: 'Previous' },
            { id: 'top',      label: 'Top' },
          ].map((t) => {
            const isActive = feedTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFeedTab(t.id)}
                data-testid={`feed-tab-${t.id}`}
                className="flex-1 py-1.5 rounded-full text-sm font-bold"
                style={isActive
                  ? { background: '#2D2D40', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#9CA3AF' }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Bets count + total win row */}
        <div className="flex items-center justify-between mt-3 mb-1.5 px-1">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {['#EF4444', '#A855F7', '#22D3EE'].map((c, i) => (
                <span key={i} className="w-6 h-6 rounded-full border-2 border-[#0A0A14]" style={{ background: c }} />
              ))}
            </div>
            <span className="text-gray-300 text-sm">
              <span className="text-white font-bold tabular-nums">{feedItems.length}/{feedMeta.total}</span>
              <span className="text-gray-500"> Bets</span>
            </span>
          </div>
          <div className="text-right">
            <p className="text-white text-base font-black tabular-nums">{feedMeta.totalWin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-gray-500 text-[10px]">Total win</p>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 px-2 pb-1 text-[10px] text-gray-500 uppercase tracking-wider">
          <div className="col-span-4">Player</div>
          <div className="col-span-3 text-right">Bet</div>
          <div className="col-span-2 text-right">X</div>
          <div className="col-span-3 text-right">Win</div>
        </div>

        {/* Bet rows */}
        <div className="space-y-1" data-testid="aviator-feed-list">
          {feedItems.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-6">Koi bet nahi</p>
          ) : feedItems.map((b, i) => {
            const isWon = b.won != null && b.won > 0;
            const multColor = b.multiplier >= 2 ? '#A855F7' : '#22D3EE';
            return (
              <div
                key={i}
                className="grid grid-cols-12 items-center px-2 py-1.5 rounded-full"
                style={{ background: isWon ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.025)' }}
                data-testid={`feed-row-${i}`}
              >
                <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                    style={{ background: ['#EF4444','#A855F7','#22D3EE','#FACC15','#34D399'][i % 5] }}
                  >
                    {b.name?.[0]?.toUpperCase() || 'P'}
                  </span>
                  <span className="text-white text-xs truncate">{b.name}</span>
                </div>
                <div className="col-span-3 text-right text-white text-xs tabular-nums">
                  {Number(b.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="col-span-2 text-right text-xs tabular-nums" style={{ color: b.multiplier ? multColor : 'transparent' }}>
                  {b.multiplier ? `${b.multiplier.toFixed(2)}x` : '—'}
                </div>
                <div className="col-span-3 text-right text-xs tabular-nums" style={{ color: isWon ? multColor : 'transparent' }}>
                  {isWon ? Number(b.won).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-gray-500 text-[10px] mt-4 mb-2">
          <span style={{ color: '#22D3EE' }}>✓</span>&nbsp;Provably Fair Game &nbsp;•&nbsp; matka11.online
        </p>
      </div>

      {/* My bets modal */}
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
