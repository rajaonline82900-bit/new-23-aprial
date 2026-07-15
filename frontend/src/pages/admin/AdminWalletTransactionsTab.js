import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowUpRight, ArrowDownLeft, Filter, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GAMES = [
  { id: '', label: 'सभी गेम' },
  { id: 'coin', label: 'Coin Toss' },
  { id: 'ludo', label: 'Ludo' },
  { id: 'aviator', label: 'Aviator' },
  { id: 'kalyan', label: 'Kalyan/Gali' },
];

const TYPES = [
  { id: '', label: 'सभी' },
  { id: 'win', label: 'सिर्फ Win' },
  { id: 'loss', label: 'सिर्फ Loss' },
  { id: 'bet', label: 'सिर्फ Bet' },
];

const AdminWalletTransactionsTab = () => {
  const [rows, setRows] = useState([]);
  const [game, setGame] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTx = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', 200);
      if (game) params.set('game', game);
      if (typeFilter) params.set('type_filter', typeFilter);
      const { data } = await axios.get(
        `${API_URL}/api/admin/wallet/game-transactions?${params.toString()}`,
        { withCredentials: true }
      );
      setRows(data.transactions || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [game, typeFilter]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  const fmtDate = (iso) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    } catch (_) { return iso; }
  };

  const isCredit = (r) => (r.amount || 0) > 0;
  const isLoss = (r) => (r.type || '').endsWith('_loss');
  const isBet = (r) => (r.type || '').endsWith('_bet');

  // Summary totals
  const totalCredit = rows.filter((r) => (r.amount || 0) > 0).reduce((s, r) => s + r.amount, 0);
  const totalDebit = rows.filter((r) => (r.amount || 0) < 0).reduce((s, r) => s + r.amount, 0);
  const totalLossCount = rows.filter(isLoss).length;
  const totalWinCount = rows.filter((r) => (r.type || '').endsWith('_win')).length;

  return (
    <div className="space-y-4" data-testid="admin-wallet-tx-tab">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-[#141418] rounded-xl border border-white/10 p-3">
        <div className="flex items-center gap-1.5 text-gray-300 text-sm font-bold">
          <Filter className="w-4 h-4" /> Filter:
        </div>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value)}
          data-testid="admin-tx-game-filter"
          className="bg-[#0F0F14] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          {GAMES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          data-testid="admin-tx-type-filter"
          className="bg-[#0F0F14] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button
          onClick={fetchTx}
          disabled={loading}
          data-testid="admin-tx-refresh"
          className="ml-auto flex items-center gap-1.5 bg-[#D4AF37] text-black font-bold text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Credit</p>
          <p className="text-lg font-black text-emerald-400 tabular-nums">+₹{Math.floor(totalCredit).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Total Debit</p>
          <p className="text-lg font-black text-red-400 tabular-nums">₹{Math.floor(Math.abs(totalDebit)).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-xl p-3 bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Wins</p>
          <p className="text-lg font-black text-yellow-400 tabular-nums">{totalWinCount}</p>
        </div>
        <div className="rounded-xl p-3 bg-purple-500/10 border border-purple-500/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Losses</p>
          <p className="text-lg font-black text-purple-400 tabular-nums">{totalLossCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141418] rounded-xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_0.8fr_1fr_1fr_0.6fr] gap-2 px-3 py-2 bg-[#0F0F14] text-[10px] font-black uppercase tracking-widest text-gray-400">
          <div>Date/Time</div>
          <div>User</div>
          <div>Game</div>
          <div>Type</div>
          <div>Amount</div>
          <div className="text-right">Side</div>
        </div>
        {loading && rows.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">Loading transactions...</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">Koi transaction nahi mila</div>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_1fr_0.8fr_1fr_1fr_0.6fr] gap-2 px-3 py-2 border-t border-white/5 text-[12px] items-center hover:bg-white/[0.02]"
            data-testid={`admin-tx-row-${r.id}`}
          >
            <div className="text-gray-300 tabular-nums">{fmtDate(r.created_at)}</div>
            <div className="text-white font-bold truncate" title={r.name}>{r.name}</div>
            <div className="text-cyan-300 font-bold text-[11px]">{r.game_name}</div>
            <div>
              <span
                className={`text-[10px] font-black tracking-wide uppercase px-1.5 py-0.5 rounded ${
                  (r.type || '').endsWith('_win') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  isLoss(r) ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                  'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                }`}
              >
                {r.type?.split('_').slice(-1)[0]?.toUpperCase()}
              </span>
            </div>
            <div className={`font-black tabular-nums flex items-center gap-1 ${
              isCredit(r) ? 'text-emerald-400' : isBet(r) ? 'text-yellow-400' : 'text-gray-400'
            }`}>
              {isCredit(r) ? <ArrowDownLeft className="w-3 h-3" /> :
               isBet(r) ? <ArrowUpRight className="w-3 h-3" /> : null}
              {isCredit(r) ? '+' : ''}₹{Math.floor(Math.abs(r.amount || 0)).toLocaleString('en-IN')}
              {r.bet_amount && !isCredit(r) && !isBet(r) && (
                <span className="text-[9px] text-gray-500">(bet ₹{Math.floor(r.bet_amount)})</span>
              )}
            </div>
            <div className="text-right text-[10px] uppercase font-bold text-gray-400">
              {r.side || (r.result_side ? `→ ${r.result_side}` : '-')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminWalletTransactionsTab;
