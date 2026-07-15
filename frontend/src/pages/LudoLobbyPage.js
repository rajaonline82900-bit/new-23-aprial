import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Users, Trophy, Clock, Plus, Wallet as WalletIcon, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/* ═══════════ Premium Blue Gaming Theme Tokens ═══════════ */
const THEME = {
  bg: '#050B1F',                                   // deepest navy
  bgSoft: '#0A1330',
  glassBg: 'linear-gradient(135deg, rgba(37, 99, 235, 0.10) 0%, rgba(15, 23, 42, 0.55) 100%)',
  glassBorder: 'rgba(96, 165, 250, 0.28)',
  cardBg: 'linear-gradient(160deg, #0F1A38 0%, #0A1224 100%)',
  neon: '#3B82F6',
  neonBright: '#60A5FA',
  neonSoft: '#93C5FD',
  cyan: '#22D3EE',
  gold: '#FBBF24',
  accent: '#A78BFA',
};

const LudoLobbyPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [entryFee, setEntryFee] = useState(100);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [onlineCount, setOnlineCount] = useState(0);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/ludo/config`);
      setConfig(data);
      // Default to the first fee slab (100)
      setEntryFee((data.entry_fees && data.entry_fees[0]) || 100);
    } catch (e) {
      toast.error('Config load nahi hua');
    }
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/ludo/tables`);
      setTables(data.tables || []);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOnlineCount = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/ludo/online-count`);
      setOnlineCount(data.count || 0);
    } catch (e) { /* silent */ }
  }, []);

  const checkActive = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/ludo/my-active`, { withCredentials: true });
      if (data.state && data.state.table_id) {
        navigate(`/ludo/table/${data.state.table_id}`, { replace: true });
      }
    } catch (e) { /* not logged in or none */ }
  }, [navigate]);

  useEffect(() => {
    fetchConfig();
    fetchTables();
    fetchOnlineCount();
    checkActive();
    const iv = setInterval(fetchTables, 4000);
    const iv2 = setInterval(fetchOnlineCount, 45000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [fetchConfig, fetchTables, fetchOnlineCount, checkActive]);

  const createTable = async () => {
    if (creating) return;
    if ((user?.balance || 0) < entryFee) {
      toast.error(`Balance kam hai — chahiye ₹${entryFee}`);
      return;
    }
    setCreating(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/ludo/tables/create`,
        { entry_fee: entryFee, max_players: maxPlayers },
        { withCredentials: true }
      );
      toast.success('Table ban gaya! Players wait...');
      await refreshUser();
      navigate(`/ludo/table/${data.table_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Table create nahi hua');
    } finally {
      setCreating(false);
    }
  };

  const joinTable = async (tableId, fee) => {
    if ((user?.balance || 0) < fee) {
      toast.error(`Balance kam hai — chahiye ₹${fee}`);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/ludo/tables/${tableId}/join`, {}, { withCredentials: true });
      toast.success('Table join kar li!');
      await refreshUser();
      navigate(`/ludo/table/${tableId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Join nahi hua');
    }
  };

  return (
    <div
      className="min-h-screen pb-24 text-white app-shell relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59, 130, 246, 0.28) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34, 211, 238, 0.14) 0%, transparent 60%),
          ${THEME.bg}
        `,
      }}
    >
      {/* Static grid overlay — GPU-free, adds gaming depth */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 90%)',
        }}
      />

      {/* Header — glassmorphism */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: 'rgba(5, 11, 31, 0.75)',
          borderBottom: `1px solid ${THEME.glassBorder}`,
        }}
      >
        <div className="px-3 py-3 flex items-center gap-3" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/dashboard">
            <button
              data-testid="ludo-back-btn"
              className="p-2 rounded-xl active:scale-90 transition"
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                border: `1px solid ${THEME.glassBorder}`,
                color: THEME.neonBright,
              }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1
              className="text-xl font-black tracking-tight leading-none flex items-center gap-1.5"
              style={{
                background: `linear-gradient(90deg, ${THEME.neonBright} 0%, ${THEME.cyan} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 12px ${THEME.neon}66)`,
              }}
            >
              LUDO ARENA
              <Zap className="w-4 h-4" style={{ color: THEME.cyan, filter: `drop-shadow(0 0 4px ${THEME.cyan})` }} />
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: THEME.neonSoft, opacity: 0.75 }}>
              10-Min • Real Cash • 2-4 Players
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
            <span className="text-[13px] font-black tabular-nums" style={{ color: '#34D399' }} data-testid="ludo-balance">
              ₹{Math.floor(user?.balance || 0)}
            </span>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4 relative" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* How it works — premium glass card with 3 stats + LIVE online counter */}
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: THEME.glassBg,
            border: `1px solid ${THEME.glassBorder}`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 32px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(147,197,253,0.12)`,
          }}
        >
          {/* Live online counter — top right */}
          {onlineCount > 0 && (
            <div
              className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.5)',
                boxShadow: '0 0 10px rgba(16, 185, 129, 0.25)',
              }}
              data-testid="ludo-online-count"
            >
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ background: '#34D399' }} />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: '#34D399' }} />
              </span>
              <span className="text-[10px] font-black tabular-nums" style={{ color: '#34D399' }}>
                {onlineCount.toLocaleString('en-IN')} online
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center pt-6">
            {[
              { Icon: Users, label: '2-4 Players', color: THEME.neonBright },
              { Icon: Clock, label: '10 Min', color: THEME.cyan },
              { Icon: Trophy, label: 'Winner Takes', color: THEME.gold },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${s.color}30 0%, transparent 70%)`,
                    border: `1px solid ${s.color}50`,
                  }}
                >
                  <s.Icon className="w-4 h-4" style={{ color: s.color }} strokeWidth={2.5} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: s.color }}>{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3 text-center leading-snug font-medium" style={{ color: THEME.neonSoft, opacity: 0.85 }}>
            Paisa sirf match start hone par katega. 15s me real player na aaya to bot join karega. Commission: {config?.commission_pct || 10}%
          </p>
        </div>

        {/* Neon-glow Create Table CTA */}
        <button
          data-testid="ludo-create-btn"
          onClick={() => setShowCreate(!showCreate)}
          className="w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-black text-base relative overflow-hidden active:scale-[0.98] transition"
          style={{
            background: showCreate
              ? `linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)`
              : `linear-gradient(135deg, ${THEME.neon} 0%, #1D4ED8 100%)`,
            border: `1px solid ${showCreate ? '#FCA5A5' : THEME.neonBright}`,
            boxShadow: showCreate
              ? '0 8px 28px rgba(220, 38, 38, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)'
              : `0 8px 28px ${THEME.neon}75, 0 0 20px ${THEME.neonBright}55, inset 0 1px 0 rgba(255,255,255,0.28)`,
            color: '#fff',
          }}
        >
          {/* Sheen sweep */}
          <span
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            }}
          />
          <Plus className="w-5 h-5 relative" strokeWidth={3} />
          <span className="relative tracking-wide">{showCreate ? 'Cancel' : 'Create New Table'}</span>
        </button>

        {showCreate && (
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{
              background: THEME.cardBg,
              border: `1px solid ${THEME.glassBorder}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 ${THEME.neonBright}20`,
            }}
            data-testid="ludo-create-panel"
          >
            <div>
              <p className="text-[10px] mb-2 font-black uppercase tracking-widest" style={{ color: THEME.neonSoft }}>
                Entry Fee
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(config?.entry_fees || [100, 200, 500, 1000, 2000, 5000, 10000]).map((f) => {
                  const isActive = entryFee === f;
                  // Format large numbers with K suffix for display
                  const label = f >= 1000 ? `₹${(f / 1000).toString().replace(/\.0$/, '')}K` : `₹${f}`;
                  return (
                    <button
                      key={f}
                      onClick={() => setEntryFee(f)}
                      data-testid={`ludo-fee-${f}`}
                      className="py-2.5 rounded-xl text-sm font-black active:scale-95 transition"
                      style={
                        isActive
                          ? {
                              background: `linear-gradient(135deg, ${THEME.neon}, #1D4ED8)`,
                              color: '#fff',
                              border: `1px solid ${THEME.neonBright}`,
                              boxShadow: `0 4px 14px ${THEME.neon}70, 0 0 10px ${THEME.neonBright}50`,
                            }
                          : {
                              background: 'rgba(15, 23, 42, 0.6)',
                              color: THEME.neonSoft,
                              border: '1px solid rgba(96, 165, 250, 0.15)',
                            }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] mb-2 font-black uppercase tracking-widest" style={{ color: THEME.neonSoft }}>
                Players
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(config?.player_counts || [2, 3, 4]).map((n) => {
                  const isActive = maxPlayers === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setMaxPlayers(n)}
                      data-testid={`ludo-players-${n}`}
                      className="py-2.5 rounded-xl text-sm font-black active:scale-95 transition"
                      style={
                        isActive
                          ? {
                              background: `linear-gradient(135deg, ${THEME.cyan}, #0891B2)`,
                              color: '#fff',
                              border: `1px solid ${THEME.cyan}`,
                              boxShadow: `0 4px 14px ${THEME.cyan}70, 0 0 10px ${THEME.cyan}50`,
                            }
                          : {
                              background: 'rgba(15, 23, 42, 0.6)',
                              color: THEME.neonSoft,
                              border: '1px solid rgba(34, 211, 238, 0.15)',
                            }
                      }
                    >
                      {n} Players
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Prize Pool showcase — glass card with neon glow */}
            <div
              className="rounded-xl p-3 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(180, 83, 9, 0.08) 100%)`,
                border: '1px solid rgba(251, 191, 36, 0.4)',
                boxShadow: '0 0 16px rgba(251, 191, 36, 0.20), inset 0 1px 0 rgba(255,255,255,0.10)',
              }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: THEME.gold }}>
                Prize Pool
              </p>
              <p className="text-3xl font-black tabular-nums mt-0.5" style={{ color: THEME.gold, textShadow: `0 0 20px ${THEME.gold}80` }}>
                ₹{Math.floor(entryFee * maxPlayers * (1 - (config?.commission_pct || 10) / 100)).toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: THEME.neonSoft, opacity: 0.7 }}>
                {maxPlayers} × ₹{entryFee.toLocaleString('en-IN')} − {config?.commission_pct || 10}% commission
              </p>
            </div>
            <button
              onClick={createTable}
              disabled={creating}
              data-testid="ludo-confirm-create"
              className="w-full py-3 rounded-xl font-black text-white disabled:opacity-50 active:scale-[0.98] transition relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                border: '1px solid #34D399',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              {creating ? 'Creating...' : `Confirm & Pay ₹${entryFee.toLocaleString('en-IN')}`}
            </button>
          </div>
        )}

        {/* Open Tables — premium list */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <span
                className="w-1 h-5 rounded-full"
                style={{ background: `linear-gradient(180deg, ${THEME.neonBright}, ${THEME.cyan})`, boxShadow: `0 0 8px ${THEME.neon}` }}
              />
              <h3 className="text-white font-black text-sm uppercase tracking-widest">Open Tables</h3>
            </div>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: THEME.neonBright,
                border: `1px solid ${THEME.neon}40`,
              }}
            >
              {tables.length} waiting
            </span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(15, 23, 42, 0.5)' }} />)}
            </div>
          ) : tables.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{
                background: THEME.cardBg,
                border: `1px dashed ${THEME.glassBorder}`,
              }}
            >
              <div
                className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle, ${THEME.neon}22, transparent 70%)`,
                  border: `1px solid ${THEME.neon}40`,
                }}
              >
                <Users className="w-6 h-6" style={{ color: THEME.neonBright }} />
              </div>
              <p className="text-sm font-bold" style={{ color: THEME.neonSoft }}>No open tables right now</p>
              <p className="text-xs mt-1" style={{ color: THEME.neonSoft, opacity: 0.6 }}>Create one above ya thoda wait karo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tables.map((t) => (
                <div
                  key={t.table_id}
                  data-testid={`ludo-table-${t.table_id}`}
                  className="rounded-2xl p-3 flex items-center justify-between relative overflow-hidden"
                  style={{
                    background: THEME.cardBg,
                    border: `1px solid ${THEME.glassBorder}`,
                    boxShadow: `0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 ${THEME.neonBright}18`,
                  }}
                >
                  {/* Left accent stripe */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: `linear-gradient(180deg, ${THEME.neonBright}, ${THEME.cyan})`, boxShadow: `0 0 8px ${THEME.neon}` }}
                  />
                  <div className="flex items-center gap-3 min-w-0 pl-2">
                    <div
                      className="w-14 h-14 rounded-xl flex flex-col items-center justify-center font-black shrink-0 relative"
                      style={{
                        background: `linear-gradient(135deg, ${THEME.neon} 0%, #1D4ED8 100%)`,
                        boxShadow: `0 4px 12px ${THEME.neon}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
                        border: `1px solid ${THEME.neonBright}`,
                      }}
                    >
                      <span className="text-[9px] leading-none opacity-80 uppercase tracking-wider text-white">Fee</span>
                      <span className="text-[13px] leading-none text-white mt-0.5">
                        {t.entry_fee >= 1000 ? `₹${(t.entry_fee / 1000).toString().replace(/\.0$/, '')}K` : `₹${t.entry_fee}`}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate text-white flex items-center gap-1.5">
                        {t.players.length}/{t.max_players}
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: THEME.neonSoft }}>Players</span>
                      </p>
                      <p className="text-[11px] truncate" style={{ color: THEME.neonSoft, opacity: 0.7 }}>
                        {t.players.map((p) => p.name).join(', ')}
                      </p>
                      <p className="text-[10px] font-black flex items-center gap-1 mt-0.5" style={{ color: THEME.gold }}>
                        <Trophy className="w-2.5 h-2.5" fill={THEME.gold} />
                        ₹{Math.floor(t.entry_fee * t.max_players * (1 - (config?.commission_pct || 10) / 100)).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => joinTable(t.table_id, t.entry_fee)}
                    data-testid={`ludo-join-${t.table_id}`}
                    className="px-4 py-2.5 rounded-xl text-xs font-black shrink-0 active:scale-95 transition"
                    style={{
                      background: 'linear-gradient(135deg, #10B981, #047857)',
                      color: '#fff',
                      border: '1px solid #34D399',
                      boxShadow: '0 4px 14px rgba(16,185,129,0.5), 0 0 8px rgba(52,211,153,0.35)',
                    }}
                  >
                    JOIN
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <FooterNav />
    </div>
  );
};

export default LudoLobbyPage;
