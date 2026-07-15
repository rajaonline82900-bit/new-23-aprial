import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Coins, Loader2,
  Trophy, Plane, Dice5, Sparkles, Circle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => {
  if (!d) return new Date();
  const s = String(d);
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
};

// ---------- Small format helpers ----------
const fmtDate = (d) => utcDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtTime = (d) => utcDate(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtAmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

// Category icon + accent color per bet
const CAT_META = {
  aviator:  { icon: Plane, color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', label: 'Aviator' },
  kalyan:   { icon: Sparkles, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Kalyan' },
  gali:     { icon: Dice5, color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', label: 'Gali/Disawar' },
  ludo:     { icon: Dice5, color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', label: 'Ludo' },
  coin:     { icon: Circle, color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', label: 'Coin Toss' },
};

const getCatMeta = (bet) => {
  if (bet.bet_type === 'coin' || bet.game_category === 'coin') return CAT_META.coin;
  if (bet.bet_type === 'aviator' || bet.game_category === 'aviator') return CAT_META.aviator;
  if (bet.game_category === 'ludo') return CAT_META.ludo;
  if (bet.game_category === 'kalyan') return CAT_META.kalyan;
  return CAT_META.gali;
};

// Status pill component
const StatusPill = ({ status }) => {
  if (status === 'won') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
      <CheckCircle2 className="w-3 h-3" /> WON
    </span>
  );
  if (status === 'lost') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/40">
      <XCircle className="w-3 h-3" /> LOST
    </span>
  );
  if (status === 'cancelled' || status === 'reversed') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-500/20 text-gray-300 border border-gray-500/40">
      CANCELLED
    </span>
  );
  // Pending — show as "PLACED" (green tick) so users see it as a successful placement,
  // not a suspicious "pending" state. Result declare hone ke baad won/lost me convert hoga.
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
      <CheckCircle2 className="w-3 h-3" /> PLACED
    </span>
  );
};

// Unified filter chip — attractive with icon + count
const FilterChip = ({ id, label, Icon, active, onClick, count, activeColor, activeGrad }) => (
  <button
    onClick={onClick}
    data-testid={`filter-${id}`}
    className="shrink-0 flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all"
    style={{
      background: active ? (activeGrad || activeColor) : 'rgba(255,255,255,0.045)',
      color: active ? '#0F0A00' : '#D1D5DB',
      border: `1px solid ${active ? (activeColor || 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.08)'}`,
      boxShadow: active ? `0 3px 10px ${activeColor}55, inset 0 1px 0 rgba(255,255,255,0.25)` : 'none',
      transform: active ? 'scale(1)' : 'scale(0.97)',
      letterSpacing: '0.02em',
    }}
  >
    <span
      className="w-4 h-4 rounded-full flex items-center justify-center"
      style={{ background: active ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.06)' }}
    >
      <Icon className="w-2.5 h-2.5" style={{ color: active ? '#0F0A00' : '#9CA3AF' }} strokeWidth={2.5} />
    </span>
    <span>{label}</span>
    {count !== undefined && (
      <span
        className="tabular-nums font-black text-[9px] px-1 rounded"
        style={{
          background: active ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.10)',
          color: active ? '#0F0A00' : '#D1D5DB',
        }}
      >
        {count}
      </span>
    )}
  </button>
);

const BetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchBets = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch main bets + coin bets in parallel, then merge and sort by date
      const [betsRes, coinRes] = await Promise.all([
        axios.get(`${API_URL}/api/bets?limit=200`, { withCredentials: true }),
        axios.get(`${API_URL}/api/coin/history?limit=100`, { withCredentials: true }).catch(() => ({ data: { bets: [] } })),
      ]);
      const mainBets = betsRes.data.bets || [];
      const coinBets = (coinRes.data.bets || []).map((c) => ({
        _id: c.bet_id,
        bet_type: 'coin',
        game_category: 'coin',
        game_name: 'Coin Toss',
        session: c.side ? c.side.toUpperCase() : '',
        number: c.side === 'head' ? 'H' : 'T',
        amount: c.amount,
        winnings: c.status === 'won' ? c.payout : 0,
        status: c.status === 'pending' ? 'pending' : c.status,
        result: c.result_side ? (c.result_side === 'head' ? 'H' : 'T') : null,
        created_at: c.created_at,
      }));
      // Robust desc sort: parse with UTC-aware helper so mixed naive/ISO strings
      // still compare correctly. Missing timestamps sink to bottom.
      const ts = (v) => (v ? utcDate(v).getTime() : 0);
      const merged = [...mainBets, ...coinBets].sort((a, b) => ts(b.created_at) - ts(a.created_at));
      setBets(merged);
    } catch (error) {
      toast.error('History load nahi hui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  // Apply single-filter (category or "won" special) client-side
  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'won') return b.status === 'won';
      const meta = getCatMeta(b);
      if (activeFilter === 'aviator') return meta === CAT_META.aviator;
      if (activeFilter === 'kalyan') return meta === CAT_META.kalyan;
      if (activeFilter === 'gali') return meta === CAT_META.gali;
      if (activeFilter === 'ludo') return meta === CAT_META.ludo;
      if (activeFilter === 'coin') return meta === CAT_META.coin;
      return true;
    });
  }, [bets, activeFilter]);

  // Category counts for pill badges
  const counts = useMemo(() => {
    const c = { all: bets.length, aviator: 0, kalyan: 0, gali: 0, ludo: 0, coin: 0 };
    bets.forEach((b) => {
      const m = getCatMeta(b);
      if (m === CAT_META.aviator) c.aviator++;
      else if (m === CAT_META.kalyan) c.kalyan++;
      else if (m === CAT_META.ludo) c.ludo++;
      else if (m === CAT_META.coin) c.coin++;
      else c.gali++;
    });
    return c;
  }, [bets]);

  // Summary stats for the header banner
  const stats = useMemo(() => {
    let totalStaked = 0, totalWon = 0, wins = 0, losses = 0, pending = 0;
    bets.forEach((b) => {
      totalStaked += Number(b.amount || 0);
      if (b.status === 'won') { wins++; totalWon += Number(b.winnings || b.won_amount || 0); }
      else if (b.status === 'lost') losses++;
      else if (b.status === 'pending') pending++;
    });
    return { totalStaked, totalWon, wins, losses, pending, pnl: totalWon - totalStaked };
  }, [bets]);

  // Group bets by date for nicer visual grouping
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      const key = fmtDate(b.created_at || b.date);
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white pb-24 app-shell">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-lg bg-[#0A0A0C]/85 border-b border-white/10">
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <Link to="/dashboard">
            <button className="p-1.5 rounded-lg bg-[#141418] border border-white/10 text-gray-400" data-testid="bets-back-btn">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-black" style={{ background: 'linear-gradient(90deg,#FFD700,#D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              History
            </h1>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5">
              Gali · Kalyan · Aviator · Coin
            </p>
          </div>
          <button
            onClick={fetchBets}
            disabled={loading}
            data-testid="bets-refresh-btn"
            className="p-1.5 rounded-lg bg-[#141418] border border-white/10 text-gray-300 hover:text-[#D4AF37] disabled:opacity-50"
            aria-label="Refresh bets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="px-3 py-3 space-y-2">
        {/* Unified attractive filter row */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
          <FilterChip
            id="all" label="All Bet" Icon={Coins}
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
            count={counts.all}
            activeColor="#FBBF24"
            activeGrad="linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)"
          />
          <FilterChip
            id="gali" label="Gali Disawar Bet" Icon={Dice5}
            active={activeFilter === 'gali'}
            onClick={() => setActiveFilter('gali')}
            count={counts.gali}
            activeColor="#D4AF37"
            activeGrad="linear-gradient(135deg, #FDE68A 0%, #D4AF37 100%)"
          />
          <FilterChip
            id="kalyan" label="Kalyan Bet" Icon={Sparkles}
            active={activeFilter === 'kalyan'}
            onClick={() => setActiveFilter('kalyan')}
            count={counts.kalyan}
            activeColor="#F87171"
            activeGrad="linear-gradient(135deg, #FCA5A5 0%, #EF4444 100%)"
          />
          <FilterChip
            id="aviator" label="Aviator Bet" Icon={Plane}
            active={activeFilter === 'aviator'}
            onClick={() => setActiveFilter('aviator')}
            count={counts.aviator}
            activeColor="#38BDF8"
            activeGrad="linear-gradient(135deg, #7DD3FC 0%, #0EA5E9 100%)"
          />
          <FilterChip
            id="ludo" label="Ludo Bet" Icon={Dice5}
            active={activeFilter === 'ludo'}
            onClick={() => setActiveFilter('ludo')}
            count={counts.ludo}
            activeColor="#A78BFA"
            activeGrad="linear-gradient(135deg, #C4B5FD 0%, #7C3AED 100%)"
          />
          <FilterChip
            id="coin" label="Coin Toss" Icon={Circle}
            active={activeFilter === 'coin'}
            onClick={() => setActiveFilter('coin')}
            count={counts.coin}
            activeColor="#FBBF24"
            activeGrad="linear-gradient(135deg, #FCD34D 0%, #B45309 100%)"
          />
          <FilterChip
            id="won" label="Won Amount" Icon={Trophy}
            active={activeFilter === 'won'}
            onClick={() => setActiveFilter('won')}
            count={stats.wins}
            activeColor="#34D399"
            activeGrad="linear-gradient(135deg, #6EE7B7 0%, #10B981 100%)"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="py-14 flex justify-center">
            <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-10 bg-[#141418] border border-white/5 text-center">
            <Coins className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 font-bold">Koi bet nahi mili</p>
            <p className="text-xs text-gray-500 mt-1">Filter change karein ya nayi bet lagayen</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, group]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  {date}
                </span>
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-gray-500 font-bold">{group.length} bet{group.length > 1 ? 's' : ''}</span>
              </div>
              {group.map((bet) => {
                const meta = getCatMeta(bet);
                const isAviator = meta === CAT_META.aviator;
                const isCoin = meta === CAT_META.coin;
                const winAmount = bet.winnings || bet.won_amount || 0;
                const serial = String(bet.id || bet._id || '').slice(-6).toUpperCase();
                const isWon = bet.status === 'won';
                const isLost = bet.status === 'lost';
                const isCancel = bet.status === 'cancelled' || bet.status === 'reversed';

                const primaryColor = isWon ? '#10B981' : isLost ? '#EF4444' : isCancel ? '#6B7280' : '#22D3EE';
                const primaryTint = isWon ? 'rgba(16,185,129,0.10)' : isLost ? 'rgba(239,68,68,0.08)' : isCancel ? 'rgba(107,114,128,0.06)' : 'rgba(34,211,238,0.06)';
                const statusText = isWon ? 'WIN' : isLost ? 'LOSS' : isCancel ? 'CANCELLED' : 'PLACED';

                // Bet chip value: what did the user actually bet on?
                let betChipVal = '—';
                if (isCoin) {
                  betChipVal = bet.number || (bet.session ? bet.session.charAt(0) : '—');
                } else if (isAviator) {
                  betChipVal = bet.digit || (isLost ? 'CRASH' : '—');
                } else {
                  betChipVal = bet.digit || bet.number || '—';
                }
                // Row-2 sub-line: category + optional session
                let subLine = 'bet';
                if (isCoin) subLine = 'Coin Toss';
                else if (isAviator) subLine = 'Aviator';
                else subLine = bet.bet_type?.replace(/_/g, ' ') || 'bet';

                return (
                  <div
                    key={bet.id || bet._id || `${bet.created_at}-${bet.digit}`}
                    data-testid={`bet-row-${bet.id}`}
                    className="ticket-slip-compact relative"
                    style={{ '--tk-color': primaryColor, '--tk-tint': primaryTint }}
                  >
                    {/* Row 1: serial + game + status */}
                    <div className="flex items-center justify-between gap-2 px-3 pt-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="ticket-serial-sm">#{serial}</span>
                        <p className="text-[11px] font-black text-white truncate leading-tight">
                          {bet.game_name || bet.game_id}
                        </p>
                      </div>
                      <span
                        className="ticket-status-badge-sm"
                        style={{ background: primaryColor, color: '#FFF' }}
                        data-testid={`bet-status-${bet.id}`}
                      >
                        {statusText}
                      </span>
                    </div>

                    {/* Row 2: bet meta — justify between */}
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                      <span className="truncate">
                        {subLine}
                        {bet.session && ` · ${bet.session}`}
                      </span>
                      <span className="tabular-nums">
                        {fmtDate(bet.created_at || bet.date)} · {fmtTime(bet.created_at)}
                      </span>
                    </div>

                    {/* Row 3: bet number + stake + win/loss + cancel */}
                    <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="ticket-bet-chip">
                          <span className="ticket-bet-chip-label">Bet</span>
                          <span className="ticket-bet-chip-val tabular-nums">
                            {betChipVal}
                          </span>
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[8px] text-gray-500 font-black uppercase tracking-wider">Stake</span>
                          <span className="text-[11px] text-white font-black tabular-nums">{fmtAmt(bet.amount)}</span>
                        </div>
                        {isCoin && bet.result && (
                          <div className="flex flex-col leading-tight">
                            <span className="text-[8px] text-gray-500 font-black uppercase tracking-wider">Result</span>
                            <span
                              className="text-[11px] font-black tabular-nums"
                              style={{ color: bet.result === 'H' ? '#F97316' : '#8B5CF6' }}
                            >
                              {bet.result === 'H' ? 'HEAD' : 'TAIL'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isWon && (
                          <div className="ticket-win-chip-sm">
                            <Trophy className="w-3 h-3" />
                            <span className="tabular-nums">+{fmtAmt(winAmount)}</span>
                          </div>
                        )}
                        {isLost && (
                          <span className="text-[10px] font-black text-red-400 tabular-nums">−{fmtAmt(bet.amount)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </main>

      <FooterNav />
    </div>
  );
};

export default BetsPage;
