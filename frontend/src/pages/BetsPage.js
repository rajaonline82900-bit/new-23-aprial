import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Coins, Loader2, Trash2,
  Trophy, Plane, Dice5, Sparkles,
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
              Gali · Kalyan · Aviator
            </p>
          </div>
        </div>
      </header>

      <main className="px-3 py-3 space-y-2">
        {/* Filter row: categories */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
          <CatPill id="all" label="All" active={catFilter === 'all'} onClick={() => setCatFilter('all')} count={counts.all} />
          <CatPill id="gali" label="Gali/Disawar" active={catFilter === 'gali'} onClick={() => setCatFilter('gali')} count={counts.gali} />
          <CatPill id="kalyan" label="Kalyan" active={catFilter === 'kalyan'} onClick={() => setCatFilter('kalyan')} count={counts.kalyan} />
          <CatPill id="aviator" label="Aviator" active={catFilter === 'aviator'} onClick={() => setCatFilter('aviator')} count={counts.aviator} />
        </div>

        {/* Filter row: status */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-3 px-3 pb-1">
          <StatusChip id="all" label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} color="#6B7280" />
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
                const isAviator = meta === CAT_META.aviator;
                const canCancel = bet.id === cancellableBetId;
                const winAmount = bet.winnings || bet.won_amount || 0;
                const serial = String(bet.id || '').slice(-6).toUpperCase();
                const isWon = bet.status === 'won';
                const isLost = bet.status === 'lost';
                const isCancel = bet.status === 'cancelled' || bet.status === 'reversed';
                const isPending = !isWon && !isLost && !isCancel;

                const primaryColor = isWon ? '#10B981' : isLost ? '#EF4444' : isCancel ? '#6B7280' : '#22D3EE';
                const primaryTint = isWon ? 'rgba(16,185,129,0.10)' : isLost ? 'rgba(239,68,68,0.08)' : isCancel ? 'rgba(107,114,128,0.06)' : 'rgba(34,211,238,0.06)';
                const statusText = isWon ? 'WIN' : isLost ? 'LOSS' : isCancel ? 'CANCELLED' : 'PLACED';

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
                        {isAviator ? 'Aviator' : (bet.bet_type?.replace(/_/g, ' ') || 'bet')}
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
                            {isAviator ? (bet.digit || (isLost ? 'CRASH' : '—')) : (bet.digit || bet.number || '—')}
                          </span>
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[8px] text-gray-500 font-black uppercase tracking-wider">Stake</span>
                          <span className="text-[11px] text-white font-black tabular-nums">{fmtAmt(bet.amount)}</span>
                        </div>
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
                        {canCancel && (
                          <button
                            onClick={() => cancelBet(bet.id)}
                            disabled={cancelling === bet.id}
                            data-testid={`cancel-bet-${bet.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-red-500/15 text-red-300 border border-red-500/30 active:bg-red-500/25 disabled:opacity-50"
                          >
                            {cancelling === bet.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                            Cancel
                          </button>
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
