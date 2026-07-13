import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Trophy, TrendingUp, TrendingDown, Plus, Trash2,
  Eye, EyeOff, Loader2, Sparkles, Zap, Wand2,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TYPES = [
  { id: 'winner',     label: 'Winner',     icon: Trophy,        color: '#EAB308', accent: 'rgba(234,179,8,0.15)' },
  { id: 'deposit',    label: 'Deposit',    icon: TrendingUp,    color: '#10B981', accent: 'rgba(16,185,129,0.15)' },
  { id: 'withdrawal', label: 'Withdrawal', icon: TrendingDown,  color: '#F97316', accent: 'rgba(249,115,22,0.15)' },
];

const AdminFakeTickerTab = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('winner');
  const [form, setForm] = useState({ name: '', amount: '', game_name: '' });
  const [saving, setSaving] = useState(false);
  const [bulkCount, setBulkCount] = useState(20);
  const [bulkType, setBulkType] = useState('mixed');
  const [bulking, setBulking] = useState(false);
  const [wiping, setWiping] = useState(false);

  const fetch_ = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/fake-ticker`, { withCredentials: true });
      setEntries(data.entries || []);
    } catch (e) {
      toast.error('Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const submit = async () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) return toast.error('Name daalo');
    if (isNaN(amount) || amount <= 0) return toast.error('Sahi amount daalo');
    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/fake-ticker`,
        { type: activeType, name: form.name.trim(), amount, game_name: form.game_name.trim() || undefined },
        { withCredentials: true }
      );
      toast.success(`Fake ${activeType} add ho gaya`);
      setForm({ name: '', amount: '', game_name: '' });
      fetch_();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save nahi hua');
    } finally { setSaving(false); }
  };

  const toggle = async (id, active) => {
    try {
      await axios.patch(`${API_URL}/api/admin/fake-ticker/${id}`,
        { active: !active }, { withCredentials: true });
      fetch_();
    } catch { toast.error('Toggle failed'); }
  };

  const del = async (id) => {
    if (!window.confirm('Ye fake entry delete karni hai?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/fake-ticker/${id}`, { withCredentials: true });
      toast.success('Deleted');
      fetch_();
    } catch { toast.error('Delete failed'); }
  };

  const bulkGenerate = async () => {
    if (bulkCount < 1 || bulkCount > 200) return toast.error('Count 1-200 ke beech rakho');
    setBulking(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/admin/fake-ticker/bulk`,
        { count: Number(bulkCount), type: bulkType },
        { withCredentials: true }
      );
      const bt = data.by_type || {};
      toast.success(
        `${data.inserted} entries added — W:${bt.winner || 0} D:${bt.deposit || 0} Wd:${bt.withdrawal || 0}`
      );
      fetch_();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bulk generate failed');
    } finally { setBulking(false); }
  };

  const wipeAll = async () => {
    if (!window.confirm(`Sabhi "${activeMeta.label}" fake entries delete kar do?`)) return;
    setWiping(true);
    try {
      const { data } = await axios.delete(
        `${API_URL}/api/admin/fake-ticker/bulk/all?type=${activeType}`,
        { withCredentials: true }
      );
      toast.success(`${data.deleted} entries deleted`);
      fetch_();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Delete failed');
    } finally { setWiping(false); }
  };

  const filtered = entries.filter(e => e.type === activeType);
  const activeMeta = TYPES.find(t => t.id === activeType);
  const Icon = activeMeta.icon;

  return (
    <div className="space-y-4" data-testid="admin-fake-ticker">
      {/* Info banner */}
      <div className="rounded-xl p-3 bg-gradient-to-br from-purple-500/10 to-pink-600/5 border border-purple-500/30">
        <h3 className="text-purple-300 font-black text-sm uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" /> Fake Ticker Injector
        </h3>
        <p className="text-xs text-purple-200/80 leading-snug">
          Yahaan aap fake winner/deposit/withdrawal add kar sakte ho jo dashboard
          ticker me real users ke saath mix ho ke dikhayenge — koi difference nahi
          dikhega. Jitne chahe entries add karo. Har entry ko toggle/delete bhi
          kar sakte ho.
        </p>
      </div>

      {/* Bulk generator */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-500/10 via-[#141418] to-pink-500/10 border border-indigo-500/30 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-indigo-300" />
          <p className="text-sm font-black text-white uppercase tracking-wider">Bulk Generate</p>
          <span className="ml-auto text-[9px] text-indigo-300/80 bg-indigo-500/15 px-2 py-0.5 rounded-full font-bold">
            Auto Indian names
          </span>
        </div>
        <p className="text-[11px] text-gray-400 leading-snug">
          Ek click me realistic Indian names ke saath fake entries generate karo — amounts smart ranges me randomize honge.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Count</label>
            <select
              value={bulkCount}
              onChange={(e) => setBulkCount(Number(e.target.value))}
              data-testid="bulk-count-select"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-400"
            >
              {[10, 20, 30, 50, 75, 100, 150, 200].map(n => (
                <option key={n} value={n}>{n} entries</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Type</label>
            <select
              value={bulkType}
              onChange={(e) => setBulkType(e.target.value)}
              data-testid="bulk-type-select"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-400"
            >
              <option value="mixed">Mixed (all 3)</option>
              <option value="winner">Winners only</option>
              <option value="deposit">Deposits only</option>
              <option value="withdrawal">Withdrawals only</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={bulkGenerate}
            disabled={bulking}
            data-testid="bulk-generate-btn"
            className="flex-1 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-pink-500 shadow-lg shadow-indigo-500/30"
          >
            {bulking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Generate {bulkCount}</>}
          </button>
          <button
            onClick={wipeAll}
            disabled={wiping}
            data-testid="bulk-wipe-btn"
            className="px-3 py-2.5 rounded-xl font-black text-xs text-red-300 bg-red-500/15 border border-red-500/30 disabled:opacity-50 flex items-center gap-1.5"
            title={`Delete all ${activeMeta.label} entries`}
          >
            {wiping ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Wipe {activeMeta.label}</>}
          </button>
        </div>
      </div>

      {/* Type tabs */}
      <div className="grid grid-cols-3 gap-1.5">
        {TYPES.map(t => {
          const TIcon = t.icon;
          const active = activeType === t.id;
          const count = entries.filter(e => e.type === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              data-testid={`fake-tab-${t.id}`}
              className="rounded-xl px-2 py-2.5 flex flex-col items-center gap-0.5 border transition-all"
              style={{
                background: active ? t.accent : '#141418',
                borderColor: active ? t.color : 'rgba(255,255,255,0.08)',
                boxShadow: active ? `0 4px 14px ${t.color}33` : 'none',
              }}
            >
              <TIcon className="w-4 h-4" style={{ color: t.color }} />
              <span className="text-[11px] font-black" style={{ color: active ? t.color : '#D1D5DB' }}>{t.label}</span>
              <span className="text-[9px] text-gray-400 tabular-nums">{count} entries</span>
            </button>
          );
        })}
      </div>

      {/* Add form */}
      <div className="rounded-2xl p-4 bg-[#141418] border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: activeMeta.color }} />
          <p className="text-sm font-black text-white">Add new fake {activeMeta.label.toLowerCase()}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Rohit Sharma"
              data-testid="fake-name-input"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Amount (₹)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="5000"
              data-testid="fake-amount-input"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>
        {activeType === 'winner' && (
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Game name (optional)</label>
            <input
              type="text"
              value={form.game_name}
              onChange={(e) => setForm({ ...form, game_name: e.target.value })}
              placeholder="Kalyan Day"
              data-testid="fake-game-input"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30"
            />
          </div>
        )}
        <button
          onClick={submit}
          disabled={saving}
          data-testid="fake-add-btn"
          className="w-full py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${activeMeta.color}, ${activeMeta.color}CC)` }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add {activeMeta.label}</>}
        </button>
      </div>

      {/* Entries list */}
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
          {activeMeta.label} entries ({filtered.length})
        </p>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl p-6 bg-[#141418] border border-white/5 text-center text-gray-500 text-sm">
            Koi entry nahi hai
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(e => (
              <div
                key={e.id}
                data-testid={`fake-entry-${e.id}`}
                className="rounded-lg p-2.5 bg-[#141418] border border-white/10 flex items-center gap-2"
                style={{ opacity: e.active ? 1 : 0.5 }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: activeMeta.accent, border: `1px solid ${activeMeta.color}44` }}>
                  <Icon className="w-4 h-4" style={{ color: activeMeta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{e.name}</p>
                  <p className="text-[10px] text-gray-400">
                    ₹{Number(e.amount).toLocaleString('en-IN')}
                    {e.game_name && ` • ${e.game_name}`}
                  </p>
                </div>
                <button
                  onClick={() => toggle(e.id, e.active)}
                  data-testid={`fake-toggle-${e.id}`}
                  className="p-1.5 rounded-lg bg-white/5 text-gray-400"
                  title={e.active ? 'Hide' : 'Show'}
                >
                  {e.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => del(e.id)}
                  data-testid={`fake-delete-${e.id}`}
                  className="p-1.5 rounded-lg bg-red-500/15 text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFakeTickerTab;
