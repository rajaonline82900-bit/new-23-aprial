import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Users, Trophy, Clock, Bot, Plus, Wallet as WalletIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LudoLobbyPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [entryFee, setEntryFee] = useState(50);
  const [maxPlayers, setMaxPlayers] = useState(2);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/ludo/config`);
      setConfig(data);
      setEntryFee(data.entry_fees[1] || 50);
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
    checkActive();
    const iv = setInterval(fetchTables, 4000);
    return () => clearInterval(iv);
  }, [fetchConfig, fetchTables, checkActive]);

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
    <div className="min-h-screen bg-[#0A0A0C] pb-24 text-white app-shell">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-[#0A0A0C]/85 border-b border-purple-500/20">
        <div className="px-3 py-3 flex items-center gap-3">
          <Link to="/dashboard">
            <button data-testid="ludo-back-btn" className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight" style={{ background: 'linear-gradient(90deg,#C4B5FD,#7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LUDO RACE
            </h1>
            <p className="text-[10px] text-purple-300/70 font-bold uppercase tracking-widest">8-min match • Win real cash</p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#141418] border border-white/10">
            <WalletIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 text-xs font-bold" data-testid="ludo-balance">₹{Math.floor(user?.balance || 0)}</span>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4">
        {/* How it works strip */}
        <div className="rounded-2xl p-3 border border-purple-500/25" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(59,7,100,0.20))' }}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <Users className="w-5 h-5 text-purple-300 mx-auto mb-1" />
              <p className="text-[10px] text-purple-200/90 font-bold">2-4 Players</p>
            </div>
            <div>
              <Clock className="w-5 h-5 text-purple-300 mx-auto mb-1" />
              <p className="text-[10px] text-purple-200/90 font-bold">8 Min</p>
            </div>
            <div>
              <Trophy className="w-5 h-5 text-yellow-300 mx-auto mb-1" />
              <p className="text-[10px] text-purple-200/90 font-bold">Winner Takes All</p>
            </div>
          </div>
          <p className="text-[11px] text-purple-100/70 mt-2 text-center leading-snug">
            180s tak koi na aaye to <Bot className="inline w-3 h-3 -mt-0.5" /> bots auto-join hote hain. Commission: {config?.commission_pct || 10}%
          </p>
        </div>

        {/* Create Table CTA */}
        <button
          data-testid="ludo-create-btn"
          onClick={() => setShowCreate(!showCreate)}
          className="w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-black text-base"
          style={{
            background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            boxShadow: '0 6px 24px rgba(124, 58, 237, 0.45), inset 0 1px 0 rgba(255,255,255,0.22)',
          }}
        >
          <Plus className="w-5 h-5" /> {showCreate ? 'Cancel' : 'Naya Table Banao'}
        </button>

        {showCreate && (
          <div className="rounded-2xl p-4 bg-[#141418] border border-purple-500/30 space-y-4" data-testid="ludo-create-panel">
            <div>
              <p className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wide">Entry Fee</p>
              <div className="grid grid-cols-4 gap-2">
                {(config?.entry_fees || [10, 50, 100, 500]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setEntryFee(f)}
                    data-testid={`ludo-fee-${f}`}
                    className={`py-2.5 rounded-xl text-sm font-black border transition ${
                      entryFee === f
                        ? 'bg-purple-500 text-white border-purple-300 shadow-lg shadow-purple-500/30'
                        : 'bg-[#0A0A0C] text-gray-300 border-white/10'
                    }`}
                  >
                    ₹{f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wide">Players</p>
              <div className="grid grid-cols-3 gap-2">
                {(config?.player_counts || [2, 3, 4]).map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    data-testid={`ludo-players-${n}`}
                    className={`py-2.5 rounded-xl text-sm font-black border transition ${
                      maxPlayers === n
                        ? 'bg-purple-500 text-white border-purple-300 shadow-lg shadow-purple-500/30'
                        : 'bg-[#0A0A0C] text-gray-300 border-white/10'
                    }`}
                  >
                    {n} Players
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3 bg-purple-500/10 border border-purple-500/20 text-center">
              <p className="text-[10px] text-purple-300/80 font-bold uppercase tracking-wider">Prize Pool</p>
              <p className="text-2xl font-black text-yellow-300 tabular-nums">
                ₹{Math.floor(entryFee * maxPlayers * (1 - (config?.commission_pct || 10) / 100))}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {maxPlayers} × ₹{entryFee} − {config?.commission_pct || 10}% commission
              </p>
            </div>
            <button
              onClick={createTable}
              disabled={creating}
              data-testid="ludo-confirm-create"
              className="w-full py-3 rounded-xl font-black text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              {creating ? 'Creating...' : `Confirm & Pay ₹${entryFee}`}
            </button>
          </div>
        )}

        {/* Open Tables */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-black text-sm uppercase tracking-wider">Open Tables</h3>
            <span className="text-[10px] text-gray-400">{tables.length} waiting</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-[#141418] animate-pulse" />)}
            </div>
          ) : tables.length === 0 ? (
            <div className="rounded-2xl p-6 bg-[#141418] border border-white/5 text-center">
              <p className="text-gray-500 text-sm">Abhi koi open table nahi hai</p>
              <p className="text-gray-600 text-xs mt-1">Naya table banao ya wait karo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tables.map((t) => (
                <div
                  key={t.table_id}
                  data-testid={`ludo-table-${t.table_id}`}
                  className="rounded-2xl p-3 bg-[#141418] border border-white/10 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg" style={{ background: 'linear-gradient(135deg, #7C3AED, #3B0764)' }}>
                      ₹{t.entry_fee}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">
                        {t.players.length}/{t.max_players} Players
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {t.players.map((p) => p.name).join(', ')}
                      </p>
                      <p className="text-[10px] text-yellow-400 font-bold">
                        Prize: ₹{Math.floor(t.entry_fee * t.max_players * (1 - (config?.commission_pct || 10) / 100))}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => joinTable(t.table_id, t.entry_fee)}
                    data-testid={`ludo-join-${t.table_id}`}
                    className="px-4 py-2 rounded-xl text-xs font-black shrink-0"
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' }}
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
