import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Coins, Loader2, Trash2,
  Trophy, TrendingUp, TrendingDown, Timer, Plane, Dice5, Sparkles,
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
};

const getCatMeta = (bet) => {
  if (bet.bet_type === 'aviator' || bet.game_category === 'aviator') return CAT_META.aviator;
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

// Category filter pill
const CatPill = ({ id, label, active, onClick, count }) => (
  <button
    onClick={onClick}
    data-testid={`filter-cat-${id}`}
    className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap"
    style={{
      background: active ? 'linear-gradient(135deg, #D4AF37, #B8860B)' : 'rgba(255,255,255,0.05)',
      color: active ? '#1A0F00' : '#E5E7EB',
      border: `1px solid ${active ? '#FFD700' : 'rgba(255,255,255,0.1)'}`,
    }}
  >
    {label}{count !== undefined && <span className="ml-1 opacity-70">·{count}</span>}
  </button>
);

const StatusChip = ({ id, label, active, onClick, color }) => (
  <button
    onClick={onClick}
    data-testid={`filter-status-${id}`}
    className="shrink-0 px-2.5 py-1 rounded-md text-[10px] font-black whitespace-nowrap"
    style={{
      background: active ? color : 'rgba(255,255,255,0.05)',
      color: active ? '#FFF' : '#E5E7EB',
      border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
    }}
  >
    {label}
  </button>
);

const BetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const fetchBets = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/api/bets?limit=200`, { withCredentials: true });
      setBets(data.bets || []);
    } catch (error) {
      toast.error('History load nahi hui');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  // Apply category + status filters client-side
  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (catFilter !== 'all') {
        const meta = getCatMeta(b);
        if (catFilter === 'aviator' && meta !== CAT_META.aviator) return false;
        if (catFilter === 'kalyan' && meta !== CAT_META.kalyan) return false;
        if (catFilter === 'gali' && meta !== CAT_META.gali) return false;
      }
      return true;
    });
  }, [bets, statusFilter, catFilter]);

  // Category counts for pill badges
  const counts = useMemo(() => {
    const c = { all: bets.length, aviator: 0, kalyan: 0, gali: 0 };
    bets.forEach((b) => {
      const m = getCatMeta(b);
      if (m === CAT_META.aviator) c.aviator++;
      else if (m === CAT_META.kalyan) c.kalyan++;
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

  const cancelBet = async (betId) => {
    if (!window.confirm('Kya aap sure hain? Bet cancel karne pe amount wapas mil jayegi.')) return;
    setCancelling(betId);
    try {
      const { data } = await axios.delete(`${API_URL}/api/bets/${betId}`, { withCredentials: true });
      toast.success(data.message || 'Bet cancelled');
      await fetchBets();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Cancel nahi ho payi');
    } finally {
      setCancelling(null);
    }
  };

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

  // Only the SINGLE most-recently-placed pending bet gets the cancel button.
  // Prevents users from clearing old bets that were placed hours ago.
  const cancellableBetId = useMemo(() => {
    let latest = null;
    for (const b of bets) {
      if (b.status !== 'pending') continue;
      if (b.bet_type === 'aviator' || b.game_category === 'aviator') continue;
      const t = new Date(b.created_at || 0).getTime();
      if (!latest || t > latest.t) latest = { id: b.id, t };
    }
    return latest?.id || null;
  }, [bets]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white pb-24 app-shell">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-lg bg-[#0A0A0C]/85 border-b border-white/10">
        <div className="px-3 py-3 flex items-center gap-3">
          <Link to="/dashboard">
            <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400" data-testid="bets-back-btn">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-black" style={{ background: 'linear-gradient(90deg,#FFD700,#D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              History
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">All bets • Gali • Kalyan • Aviator</p>
          </div>
        </div>
      </header>

      <main className="px-3 py-3 space-y-3">
        {/* Summary Stats Card */}
        <div
          className="rounded-2xl p-3 border grid grid-cols-3 gap-2"
          style={{
            background: 'linear-gradient(135deg, #1A1505 0%, #16162A 100%)',
            borderColor: 'rgba(212, 175, 55, 0.35)',
          }}
          data-testid="bets-summary"
        >
          <div className="text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total Staked</p>
            <p className="text-sm font-black text-white tabular-nums">{fmtAmt(stats.totalStaked)}</p>
          </div>
          <div className="text-center border-x border-white/10">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Total Won</p>
            <p className="text-sm font-black text-emerald-400 tabular-nums">{fmtAmt(stats.totalWon)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">P/L</p>
            <p className={`text-sm font-black tabular-nums flex items-center justify-center gap-0.5 ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stats.pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {fmtAmt(Math.abs(stats.pnl))}
            </p>
          </div>
        </div>

        {/* Filter row: categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
          <CatPill id="all" label="All" active={catFilter === 'all'} onClick={() => setCatFilter('all')} count={counts.all} />
          <CatPill id="gali" label="Gali/Disawar" active={catFilter === 'gali'} onClick={() => setCatFilter('gali')} count={counts.gali} />
          <CatPill id="kalyan" label="Kalyan" active={catFilter === 'kalyan'} onClick={() => setCatFilter('kalyan')} count={counts.kalyan} />
          <CatPill id="aviator" label="Aviator" active={catFilter === 'aviator'} onClick={() => setCatFilter('aviator')} count={counts.aviator} />
        </div>

        {/* Filter row: status */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
          <StatusChip id="all" label="All Status" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} color="#6B7280" />
          <StatusChip id="pending" label={`Pending · ${stats.pending}`} active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} color="#EAB308" />
          <StatusChip id="won" label={`Won · ${stats.wins}`} active={statusFilter === 'won'} onClick={() => setStatusFilter('won')} color="#10B981" />
          <StatusChip id="lost" label={`Lost · ${stats.losses}`} active={statusFilter === 'lost'} onClick={() => setStatusFilter('lost')} color="#EF4444" />
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
                const Icon = meta.icon;
                const isAviator = meta === CAT_META.aviator;
                const canCancel = bet.id === cancellableBetId;
                const winAmount = bet.winnings || bet.won_amount || 0;
                return (
                  <div
                    key={bet.id || bet._id || `${bet.created_at}-${bet.digit}`}
                    data-testid={`bet-row-${bet.id}`}
                    className="rounded-2xl p-3 flex items-start gap-3 relative overflow-hidden"
                    style={{
                      background: bet.status === 'won'
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, #141418 60%)'
                        : bet.status === 'lost'
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, #141418 60%)'
                        : '#141418',
                      border: `1px solid ${bet.status === 'won' ? 'rgba(16,185,129,0.35)' : bet.status === 'lost' ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.10)'}`,
                      boxShadow: bet.status === 'won' ? '0 4px 16px rgba(16,185,129,0.12)' : 'none',
                    }}
                  >
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{
                        background: bet.status === 'won' ? '#10B981'
                          : bet.status === 'lost' ? '#EF4444'
                          : bet.status === 'cancelled' || bet.status === 'reversed' ? '#6B7280'
                          : meta.color,
                      }}
                    />

                    {/* Icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-1"
                      style={{ background: meta.bg, border: `1px solid ${meta.color}55` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>

                    {/* Middle: game / bet detail */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-black text-white truncate">{bet.game_name || bet.game_id}</p>
                        <StatusPill status={bet.status} />
                      </div>
                      {isAviator ? (
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <span className="text-gray-500">Cashout:</span>
                            <span
                              className={`font-black tabular-nums px-2 py-0.5 rounded-lg text-sm ${bet.status === 'won' ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/40' : 'text-red-300 bg-red-500/15 border border-red-500/30'}`}
                            >
                              {bet.digit || (bet.status === 'lost' ? 'crashed' : '—')}
                            </span>
                          </span>
                          {bet.crash_point && (
                            <span className="text-[10px] text-gray-400">
                              @ crash <span className="text-red-400 font-bold">{Number(bet.crash_point).toFixed(2)}x</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-gray-300 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                            {bet.bet_type?.replace(/_/g, ' ') || 'bet'}
                          </span>
                          {bet.session && (
                            <span className="uppercase text-[9px] font-black px-1.5 py-0.5 rounded"
                              style={{
                                background: bet.session === 'open' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: bet.session === 'open' ? '#6ee7b7' : '#fca5a5'
                              }}
                            >
                              {bet.session}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <span className="text-gray-500">Bet</span>
                            <span className="font-black text-[#1A0F00] tabular-nums px-2 py-0.5 rounded-lg text-sm shadow-sm"
                              style={{ background: 'linear-gradient(135deg,#FFD700,#D4AF37)' }}
                            >
                              {bet.digit || bet.number || '—'}
                            </span>
                          </span>
                          {bet.result_number != null && bet.result_number !== '' && (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <span className="text-gray-500">Result</span>
                              <span
                                className={`font-black tabular-nums px-2 py-0.5 rounded-lg text-sm border ${bet.status === 'won' ? 'text-emerald-100 bg-emerald-500/25 border-emerald-400/60' : 'text-gray-200 bg-white/8 border-white/20'}`}
                              >
                                {bet.result_number}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500">
                        <Timer className="w-3 h-3" />
                        <span>{fmtTime(bet.created_at)}</span>
                        {bet.round_id && <span>· Round #{String(bet.round_id).slice(-6)}</span>}
                      </div>
                    </div>

                    {/* Right: amount + cancel */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-white tabular-nums">−{fmtAmt(bet.amount)}</p>
                      {bet.status === 'won' && (
                        <p className="text-[11px] font-black text-emerald-400 tabular-nums flex items-center justify-end gap-0.5 mt-0.5">
                          <Trophy className="w-3 h-3" /> +{fmtAmt(winAmount)}
                        </p>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => cancelBet(bet.id)}
                          disabled={cancelling === bet.id}
                          data-testid={`cancel-bet-${bet.id}`}
                          className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-red-500/15 text-red-300 border border-red-500/30 active:bg-red-500/25 disabled:opacity-50"
                        >
                          {cancelling === bet.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Cancel
                        </button>
                      )}
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
