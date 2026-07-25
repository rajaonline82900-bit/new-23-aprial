import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Dice5, Spade } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

// Bet type tabs — matches Reddy66 layout
const TYPE_DEFS = [
  { id: 'single',        api: 'single_ank',    label: 'SINGLE',        rate: 9.5,  icon: 'dice'   },
  { id: 'single_patti',  api: 'single_panna',  label: 'SINGLE PATTI',  rate: 125,  icon: 'spade1' },
  { id: 'double_patti',  api: 'double_panna',  label: 'DOUBLE PATTI',  rate: 250,  icon: 'spade2' },
  { id: 'triple_patti',  api: 'triple_panna',  label: 'TRIPLE PATTI',  rate: 900,  icon: 'spade3' },
  { id: 'jodi',          api: 'kalyan_jodi',   label: 'JODI',          rate: 90,   icon: 'dice2'  },
];

const AMOUNTS = [10, 50, 100, 200, 500, 1000, 2000, 5000];

// Compute valid panna lists once
function computePannas() {
  const single = {}, double = {}, triple = {};
  for (let i = 0; i <= 9; i++) { single[i] = []; double[i] = []; triple[i] = []; }
  for (let n = 0; n < 1000; n++) {
    const s = n.toString().padStart(3, '0');
    const d = s.split('').map(Number);
    // Panna is a sorted-digit combination — only count canonical form (non-decreasing)
    if (!(d[0] <= d[1] && d[1] <= d[2])) continue;
    const ank = (d[0] + d[1] + d[2]) % 10;
    const uniq = new Set(d).size;
    if (uniq === 3) single[ank].push(s);
    else if (uniq === 1) triple[ank].push(s);
    else double[ank].push(s);
  }
  return { single, double, triple };
}
const PANNAS = computePannas();

// Tab icon component
const TabIcon = ({ type, color = '#7C3AED' }) => {
  const base = { stroke: color, strokeWidth: 1.5, fill: 'none' };
  if (type === 'dice' || type === 'dice2') {
    return <Dice5 className="w-7 h-7" style={{ color }} />;
  }
  if (type === 'spade1') return <Spade className="w-7 h-7" style={{ color }} fill="none" strokeWidth={1.6} />;
  if (type === 'spade2') return (
    <div className="flex items-end gap-0.5">
      <Spade className="w-5 h-5" style={{ color }} fill="none" strokeWidth={1.6} />
      <Spade className="w-5 h-5 -ml-1.5" style={{ color }} fill="none" strokeWidth={1.6} />
    </div>
  );
  if (type === 'spade3') return (
    <div className="flex items-end -space-x-1.5">
      <Spade className="w-4 h-4" style={{ color }} fill="none" strokeWidth={1.6} />
      <Spade className="w-4 h-4" style={{ color }} fill="none" strokeWidth={1.6} />
      <Spade className="w-4 h-4" style={{ color }} fill="none" strokeWidth={1.6} />
    </div>
  );
  return null;
};

const fmtTime = (t) => {
  const [h, m] = (t || '00:00').split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
};

const KalyanGamePage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [game, setGame] = useState(null);
  const [activeType, setActiveType] = useState('single');
  const [session, setSession] = useState('open');
  const [amount, setAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [minBets, setMinBets] = useState({});
  const [selected, setSelected] = useState({}); // { digit: stake }
  const [submitting, setSubmitting] = useState(false);
  const [showBets, setShowBets] = useState(false);
  const [myBets, setMyBets] = useState([]);

  // Fetch per-bet-type minimum bet config (admin-configurable)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/kalyan/min-bets`, { withCredentials: true });
        setMinBets(data?.min_bets || {});
      } catch (_) { /* fallback to defaults on server */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/games`, { withCredentials: true });
        const g = (data.games || []).find(x => x.id === gameId);
        setGame(g);
      } catch (e) {
        // game not found — leave loading
      }
    })();
  }, [gameId]);

  // Reset selection when bet type or session changes
  useEffect(() => { setSelected({}); }, [activeType, session]);

  // Jodi is ONLY allowed in OPEN session (per matka rules — Close session
  // has no Jodi bet). Switching to Jodi auto-selects Open session.
  useEffect(() => { if (activeType === 'jodi') setSession('open'); }, [activeType]);

  // Live clock — used to gate UI based on open_time / close_time (IST).
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    // Convert to IST minutes-since-midnight
    const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return ist.getHours() * 60 + ist.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      setNowMin(ist.getHours() * 60 + ist.getMinutes());
    };
    const id = setInterval(tick, 30 * 1000); // every 30s is plenty
    return () => clearInterval(id);
  }, []);

  const hhmmToMin = (s) => {
    if (!s || !s.includes(':')) return -1;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };

  const openMin = hhmmToMin(game?.open_time || game?.start_time);
  const closeMin = hhmmToMin(game?.close_time || game?.end_time);
  const isOpenClosed = openMin >= 0 && nowMin >= openMin;   // Open cutoff hit
  const isCloseClosed = closeMin >= 0 && (
    // Handle cross-midnight (close < open) — treat as valid until then
    closeMin >= openMin ? nowMin >= closeMin : (nowMin >= closeMin && nowMin < openMin)
  );
  const isJodiBlocked = isOpenClosed;  // Jodi disallowed after open_time
  const marketClosed = isCloseClosed;  // Both sessions blocked

  // If Jodi is the active type and Open time has passed, auto-switch to Single
  useEffect(() => {
    if (activeType === 'jodi' && isJodiBlocked) setActiveType('single');
    // If Open session selected but Open closed, switch to Close
    if (session === 'open' && isOpenClosed && !marketClosed) setSession('close');
  }, [activeType, session, isJodiBlocked, isOpenClosed, marketClosed]);

  const type = TYPE_DEFS.find(t => t.id === activeType);
  const rate = type?.rate || 0;

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const totalStake = Object.values(selected).reduce((s, v) => s + (Number(v) || 0), 0);

  const toggleDigit = (d) => {
    if (!amount) { toast.error('Pehle amount select karo'); return; }
    setSelected(prev => {
      const next = { ...prev };
      if (next[d]) delete next[d];
      else next[d] = amount;
      return next;
    });
  };

  const updateAmount = (d, val) => {
    setSelected(prev => ({ ...prev, [d]: val }));
  };

  const clearAll = () => { setSelected({}); setAmount(null); };

  const submitBets = async () => {
    const activeApi = (TYPE_DEFS.find(t => t.id === activeType) || {}).api;
    const curMin = minBets[activeApi] || 10;
    const digits = Object.keys(selected).filter(d => Number(selected[d]) >= curMin);
    if (digits.length === 0) { toast.error(`Kam se kam ₹${curMin} ke digit select karo`); return; }
    if (digits.some(d => Number(selected[d]) < curMin)) {
      toast.error(`Har bet ₹${curMin} se kam nahi ho sakti`);
      return;
    }
    // Group by amount so we can use the batch endpoint efficiently
    setSubmitting(true);
    try {
      const groups = {};
      digits.forEach(d => {
        const a = Number(selected[d]);
        groups[a] = groups[a] || [];
        groups[a].push(d);
      });
      const tasks = Object.entries(groups).map(([amt, list]) =>
        axios.post(`${API}/api/kalyan/bet/batch`, {
          game_id: gameId,
          bet_type: type.api,
          session,
          amount: Number(amt),
          digits: list,
          date: todayStr(),
        }, { withCredentials: true })
      );
      const results = await Promise.all(tasks);
      const totalCount = results.reduce((s, r) => s + (r.data?.count || 0), 0);
      toast.success(`${totalCount} bets lag gayi, ₹${totalStake} stake`);
      clearAll();
      await refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bet submit fail');
    } finally {
      setSubmitting(false);
    }
  };

  const openBetsModal = async () => {
    try {
      const { data } = await axios.get(
        `${API}/api/kalyan/my-bets?game_id=${gameId}&date=${todayStr()}`,
        { withCredentials: true }
      );
      setMyBets(data.bets || []);
      setShowBets(true);
    } catch (e) {
      toast.error('Bets load fail');
    }
  };

  // Digit grid — varies by bet type
  const digitGroups = useMemo(() => {
    if (activeType === 'single') {
      return [{ title: null, digits: ['0','1','2','3','4','5','6','7','8','9'] }];
    }
    if (activeType === 'jodi') {
      const arr = [];
      for (let i = 0; i < 100; i++) arr.push(i.toString().padStart(2, '0'));
      return [{ title: null, digits: arr }];
    }
    if (activeType === 'triple_patti') {
      return [{ title: null, digits: ['000','111','222','333','444','555','666','777','888','999'] }];
    }
    if (activeType === 'single_patti' || activeType === 'double_patti') {
      const src = activeType === 'single_patti' ? PANNAS.single : PANNAS.double;
      const groups = [];
      for (let a = 0; a <= 9; a++) {
        if ((src[a] || []).length > 0) groups.push({ title: `Panna of ank ${a}`, digits: src[a] });
      }
      return groups;
    }
    return [];
  }, [activeType]);

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FFFFFF' }}>
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-32"
      style={{ background: '#FFFFFF' }}
      data-testid="kalyan-page"
    >
      {/* Header — Reddy66 style: black bar with game name pill + BETS + Back */}
      <div className="bg-black px-3 py-3 flex items-center gap-2 sticky top-0 z-30">
        <div
          className="flex-1 bg-gray-300 rounded-full px-4 py-2 text-center"
          data-testid="kalyan-game-name"
        >
          <span className="text-black font-bold text-sm uppercase tracking-wide">{game.name}</span>
        </div>
        <button
          onClick={openBetsModal}
          className="text-white font-bold text-sm px-2 active:scale-95"
          data-testid="kalyan-bets-link"
        >
          BETS
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-black text-white border-2 border-white rounded-lg px-3 py-1.5 flex items-center gap-1 active:scale-95"
          data-testid="kalyan-back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Back</span>
        </button>
      </div>

      {/* MARKET label + Open/Close time display + Rate */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-black font-bold text-sm uppercase tracking-wide">MARKET</span>
          <span className="text-green-600 font-bold italic text-sm" data-testid="kalyan-rate">Rate : {rate}</span>
        </div>
        {/* Time display bar — admin-set open/close times */}
        <div className="flex items-center justify-between gap-2" data-testid="kalyan-time-display">
          <div className="flex-1 px-3 py-1.5 rounded-lg border" style={{
            background: isOpenClosed ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.10)',
            borderColor: isOpenClosed ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.4)',
          }}>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isOpenClosed ? '#DC2626' : '#16A34A' }}>
              {isOpenClosed ? 'Open Closed' : 'Open bets till'}
            </p>
            <p className="text-black font-black text-sm tabular-nums" data-testid="kalyan-open-time">
              {fmtTime(game.open_time || '--:--')}
            </p>
          </div>
          <div className="flex-1 px-3 py-1.5 rounded-lg border" style={{
            background: marketClosed ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)',
            borderColor: marketClosed ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.35)',
          }}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-red-600">
              {marketClosed ? 'Market Closed' : 'Close bets till'}
            </p>
            <p className="text-black font-black text-sm tabular-nums" data-testid="kalyan-close-time">
              {fmtTime(game.close_time || game.end_time || '--:--')}
            </p>
          </div>
        </div>
      </div>

      {/* OPEN / CLOSE session toggle */}
      <div className="grid grid-cols-2 gap-3 px-4">
        {[
          { id: 'open',  label: 'OPEN',  cutoff: game.open_time,                   disabled: isOpenClosed || marketClosed },
          { id: 'close', label: 'CLOSE', cutoff: game.close_time || game.end_time, disabled: activeType === 'jodi' || marketClosed },
        ].map(s => {
          const active = session === s.id;
          const handleSessionClick = () => {
            if (!s.disabled) { setSession(s.id); return; }
            if (marketClosed) {
              toast.error('Market band ho chuka hai — abhi bet nahi lag sakti', { duration: 3500 });
            } else if (s.id === 'open' && isOpenClosed) {
              toast.error(
                `Open ka time nikal chuka (${fmtTime(game.open_time)}). Ab sirf CLOSE section me Single / Single Patti / Double Patti / Triple Patti lag sakti hai.`,
                { duration: 4500 }
              );
            } else if (s.id === 'close' && activeType === 'jodi') {
              toast.error('Jodi ke saath sirf OPEN session hoti hai. Single / Patti chuno CLOSE ke liye.', { duration: 4000 });
            }
          };
          return (
            <button
              key={s.id}
              type="button"
              onClick={handleSessionClick}
              data-testid={`kalyan-session-${s.id}`}
              className={`py-2.5 rounded-lg text-center font-semibold text-[13px] tracking-wide leading-tight ${
                s.disabled ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 text-black'
              }`}
              style={active && !s.disabled ? { border: '2px solid #2563EB', background: '#E5E7EB' } : { border: '1px solid transparent' }}
              title={s.disabled ? (s.id === 'open' ? 'Open ka time nikal chuka' : 'Jodi bet Close session me nahi lagti') : ''}
            >
              <div>{s.label}</div>
              <div className="text-[10px] font-normal opacity-70">till {fmtTime(s.cutoff)}</div>
            </button>
          );
        })}
      </div>

      {/* 5 bet-type tabs with icons — Jodi tab disabled once open_time passed */}
      <div className="grid grid-cols-5 gap-2 px-4 mt-3">
        {TYPE_DEFS.map(t => {
          const active = activeType === t.id;
          const disabled = (t.id === 'jodi' && isJodiBlocked) || marketClosed;
          const handleClick = () => {
            if (disabled) {
              if (marketClosed) {
                toast.error('Market band ho chuka hai — abhi bet nahi lag sakti', {
                  duration: 3500,
                });
              } else if (t.id === 'jodi' && isJodiBlocked) {
                toast.error(
                  `Jodi bet ka time nikal chuka (Open ${fmtTime(game.open_time)}). Ab sirf CLOSE me Single / Single Patti / Double Patti / Triple Patti lag sakti hai.`,
                  { duration: 4500 }
                );
              }
              return;
            }
            setActiveType(t.id);
          };
          return (
            <button
              key={t.id}
              type="button"
              onClick={handleClick}
              data-testid={`kalyan-type-${t.id}`}
              className={`rounded-lg py-2 px-1 flex flex-col items-center justify-center gap-1 active:scale-95 ${
                disabled ? 'opacity-40' : ''
              }`}
              style={active && !disabled
                ? { border: '2px solid #2563EB', background: '#FFFFFF' }
                : { border: '1px solid #E5E7EB', background: '#FFFFFF' }
              }
              title={disabled && t.id === 'jodi' ? 'Jodi ka time nikal chuka' : (marketClosed ? 'Market band ho gaya' : '')}
            >
              <TabIcon type={t.icon} />
              <span className="text-[10px] font-bold text-black leading-tight text-center">
                {t.label.split(' ').map((w, i) => (
                  <span key={i} className="block">{w}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Select Amounts */}
      <div className="px-4 mt-5">
        <h3 className="text-center text-red-700 font-bold text-base mb-3">Select Amount</h3>
        {/* Manual amount input — user can type any custom value */}
        {(() => {
          const activeApi = (TYPE_DEFS.find(t => t.id === activeType) || {}).api;
          const curMin = minBets[activeApi] || 10;
          return (
            <div className="mb-3">
              <div className="flex items-stretch gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={curMin}
                    step="1"
                    value={customAmount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '');
                      setCustomAmount(v);
                      const num = parseInt(v, 10);
                      setAmount(Number.isFinite(num) ? num : null);
                    }}
                    placeholder={`Manual amount (min ₹${curMin})`}
                    data-testid="kalyan-custom-amount"
                    className="w-full h-11 pl-8 pr-3 rounded-md border-2 text-base font-bold text-black"
                    style={{ borderColor: '#2563EB', background: '#F8FAFC' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setCustomAmount(''); setAmount(null); }}
                  className="h-11 px-3 rounded-md text-xs font-bold text-gray-700 border border-gray-300 bg-white"
                >Clear</button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">
                Minimum for <b>{(TYPE_DEFS.find(t => t.id === activeType) || {}).label}</b>: ₹{curMin}
              </p>
            </div>
          );
        })()}
        <div className="grid grid-cols-4 gap-2">
          {AMOUNTS.map(v => {
            const active = amount === v && !customAmount;
            return (
              <button
                key={v}
                type="button"
                onClick={() => { setAmount(v); setCustomAmount(''); }}
                data-testid={`kalyan-amount-${v}`}
                className="rounded-md py-2 text-center font-semibold text-sm active:scale-95"
                style={active
                  ? { border: '2px solid #2563EB', background: '#EFF6FF', color: '#000' }
                  : { border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#000' }
                }
              >
                ₹ {v}
              </button>
            );
          })}
        </div>
      </div>

      {/* Select Digits / Panna Digits */}
      <div className="px-4 mt-6">
        <h3 className="text-center text-red-700 font-bold text-base mb-3">
          {activeType === 'single' || activeType === 'jodi' ? 'Select Digits' : 'Select Panna Digits'}
        </h3>
        {digitGroups.map((grp, gi) => (
          <div key={gi} className="mb-4">
            {grp.title && (
              <p className="text-center text-red-700 font-bold text-sm mb-2">{grp.title}</p>
            )}
            <div className={`grid gap-2 ${activeType === 'jodi' ? 'grid-cols-4' : 'grid-cols-4'}`}>
              {grp.digits.map(d => {
                const isSelected = selected[d] != null;
                return (
                  <div key={d} className="flex flex-col items-center">
                    <span className="text-[12px] text-black font-bold mb-0.5">{d}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={selected[d] ?? ''}
                      onFocus={() => toggleDigit(d)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          // remove from selection
                          setSelected(prev => { const n = { ...prev }; delete n[d]; return n; });
                        } else {
                          updateAmount(d, val);
                        }
                      }}
                      data-testid={`kalyan-digit-${d}`}
                      className="w-full h-9 rounded-md text-center text-sm font-semibold outline-none"
                      style={{
                        border: isSelected ? '2px solid #2563EB' : '1px solid #D1D5DB',
                        background: isSelected ? '#EFF6FF' : '#FFFFFF',
                        color: '#000000',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected digits summary */}
      <div className="px-4 mt-4">
        <p className="text-black font-bold text-sm">
          SELECTED DIGITS:&nbsp;
          <span className="text-blue-700" data-testid="kalyan-selected-list">
            {Object.keys(selected).join(', ') || '—'}
          </span>
        </p>
        <p className="text-black font-bold text-sm mt-1">
          Total Stake : <span className="text-blue-700 tabular-nums" data-testid="kalyan-total-stake">{totalStake}</span>
        </p>
      </div>

      {/* Sticky bottom action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-gray-200 px-4 py-3 flex gap-3"
        style={{ maxWidth: '480px', margin: '0 auto', background: '#FFFFFF' }}
      >
        <button
          type="button"
          onClick={clearAll}
          data-testid="kalyan-clear-all"
          className="flex-1 rounded-lg py-3 font-bold text-black active:scale-95"
          style={{ background: '#FDD9A0' }}
        >
          CLEAR ALL
        </button>
        <button
          type="button"
          onClick={submitBets}
          disabled={submitting || totalStake === 0}
          data-testid="kalyan-submit-bet"
          className="flex-1 rounded-lg py-3 font-bold text-white active:scale-95 disabled:opacity-50"
          style={{ background: '#B91C1C' }}
        >
          {submitting ? 'SUBMITTING...' : 'SUBMIT BET'}
        </button>
      </div>

      {/* Bets modal — opens via "BETS" link in header */}
      {showBets && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
          onClick={() => setShowBets(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-hidden flex flex-col"
            style={{ background: '#FFFFFF' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0"
              style={{ background: '#FFFFFF' }}
            >
              <h3 className="text-black font-bold text-base">Aaj ki Bets ({myBets.length})</h3>
              <button onClick={() => setShowBets(false)} className="text-gray-500 font-bold text-xl" data-testid="kalyan-bets-close">×</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {myBets.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">Aaj koi bet nahi</p>
              ) : myBets.map(b => (
                <div key={b.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between" data-testid={`kalyan-bet-row-${b.id}`}>
                  <div>
                    <p className="text-black font-bold text-sm">
                      {TYPE_DEFS.find(t => t.api === b.bet_type)?.label || b.bet_type}
                    </p>
                    <p className="text-gray-500 text-xs">{b.session} • <span className="font-mono">{b.digit}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-black font-bold">₹{b.amount}</p>
                    <p className={`text-xs font-bold ${
                      b.status === 'won' ? 'text-green-600' :
                      b.status === 'lost' ? 'text-red-500' :
                      b.status === 'reversed' ? 'text-orange-500' : 'text-gray-500'
                    }`}>
                      {b.status.toUpperCase()}
                    </p>
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

export default KalyanGamePage;
