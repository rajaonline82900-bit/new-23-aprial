import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { RotateCcw, CheckCircle2, Trash2, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Generate all valid 3-digit pannas indexed by their ank (sum of digits mod 10).
// Includes Single Pannas (3 unique ascending digits), Double Pannas (2 same)
// and Triple Pannas (all same). This is the full matka panna universe.
const PANNAS_BY_ANK = (() => {
  const map = {};
  for (let i = 0; i < 10; i++) map[i] = [];
  // Single Pannas: a < b < c
  for (let a = 0; a <= 9; a++) for (let b = a + 1; b <= 9; b++) for (let c = b + 1; c <= 9; c++) {
    const p = `${a}${b}${c}`; map[(a + b + c) % 10].push(p);
  }
  // Double Pannas: a == b != c (ascending two patterns aab, abb)
  for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) {
    if (a === b) continue;
    const p1 = a < b ? `${a}${a}${b}` : `${b}${a}${a}`;
    map[(a + a + b) % 10].push(p1);
  }
  // Triple Pannas
  for (let a = 0; a <= 9; a++) {
    const p = `${a}${a}${a}`; map[(3 * a) % 10].push(p);
  }
  // De-dupe & sort
  for (let i = 0; i < 10; i++) {
    map[i] = Array.from(new Set(map[i])).sort();
  }
  return map;
})();

const AdminKalyanResultsTab = ({ games = [] }) => {
  const kalyanGames = games.filter(g => g.category === 'kalyan');
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [date, setDate] = useState(today);
  const [results, setResults] = useState([]);
  const [forms, setForms] = useState({});  // {gameId: {open:'', close:'', openAnk:'', closeAnk:''}}
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(null); // {gameId, session} when opened

  useEffect(() => { fetchResults(); }, [date]);

  const fetchResults = async () => {
    try {
      const { data } = await axios.get(`${API}/api/admin/kalyan/results?date=${date}`, { withCredentials: true });
      const map = {};
      (data.results || []).forEach(r => { map[r.game_id] = r; });
      setResults(map);
    } catch (e) { console.error(e); }
  };

  const getForm = (id) => forms[id] || { open: '', close: '' };
  const setForm = (id, k, v) => setForms(prev => ({ ...prev, [id]: { ...getForm(id), [k]: v.replace(/\D/g, '').slice(0, 3) } }));

  const declare = async (gameId, session) => {
    const panna = getForm(gameId)[session];
    if (!/^\d{3}$/.test(panna)) { toast.error('3 digit panna chahiye'); return; }
    if (!window.confirm(`${session.toUpperCase()} declare karo? Panna: ${panna}`)) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/kalyan/declare`,
        { game_id: gameId, session, panna, date },
        { withCredentials: true });
      toast.success(`${session.toUpperCase()} declared! Ank: ${data.ank}`);
      setForms(prev => ({ ...prev, [gameId]: { ...getForm(gameId), [session]: '' } }));
      fetchResults();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fail');
    } finally {
      setLoading(false);
    }
  };

  const reverse = async (gameId, session) => {
    if (!window.confirm(`Reverse ${session.toUpperCase()} result? Sabhi bets refund ho jayengi.`)) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/kalyan/reverse`,
        { game_id: gameId, session, date },
        { withCredentials: true });
      toast.success(`Reversed ${data.reversed_count} bets`);
      fetchResults();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fail');
    } finally {
      setLoading(false);
    }
  };

  const deleteResult = async (gameId) => {
    if (!window.confirm('Pura result delete karo? (Open + Close dono) Sabhi bets refund ho jayengi.')) return;
    setLoading(true);
    try {
      const { data } = await axios.delete(`${API}/api/admin/kalyan/result?game_id=${gameId}&date=${date}`,
        { withCredentials: true });
      toast.success(`Deleted result & refunded ${data.reversed_count} bets`);
      fetchResults();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fail');
    } finally {
      setLoading(false);
    }
  };

  const [autoFetching, setAutoFetching] = useState(false);
  const triggerAutoFetch = async () => {
    setAutoFetching(true);
    try {
      const { data } = await axios.post(`${API}/api/admin/kalyan/auto-fetch`, {}, { withCredentials: true });
      if (data.success) {
        const n = data.declared_count || 0;
        if (n > 0) {
          toast.success(`✅ ${n} result(s) auto-declared from DP Boss`);
        } else {
          toast.info(`DP Boss checked ${data.markets_checked} markets — koi naya result nahi mila`);
        }
        fetchResults();
      } else {
        toast.error(`DP Boss error: ${data.error || 'Unknown'}`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Auto-fetch failed');
    } finally {
      setAutoFetching(false);
    }
  };

  if (kalyanGames.length === 0) {
    return <div className="text-gray-400 text-center py-8">Koi Kalyan game nahi mila</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-gray-300 text-sm">Date:</label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-[#0A0A0C] border-white/10 text-white w-44 h-9" data-testid="admin-kalyan-date" />
        </div>
        <Button
          onClick={triggerAutoFetch}
          disabled={autoFetching}
          data-testid="admin-kalyan-auto-fetch-btn"
          className="h-9"
          style={{
            background: 'linear-gradient(135deg, #B91C5C 0%, #8B1538 100%)',
            border: '1px solid #EC4899',
            color: '#fff',
          }}
        >
          <Zap className={`w-4 h-4 mr-1.5 ${autoFetching ? 'animate-pulse' : ''}`} />
          {autoFetching ? 'Fetching…' : 'Auto-Fetch (DP Boss)'}
        </Button>
      </div>

      <div className="bg-pink-500/5 border border-pink-500/20 rounded-lg px-3 py-2 text-xs text-gray-300">
        <span className="text-pink-400 font-bold">Auto-Fetch:</span> Background me har 3 min pe DP Boss API se result auto-declare hote hain.
        Instant fetch ke liye upar wala button dabao.
      </div>

      <div className="grid gap-3">
        {kalyanGames.map(g => {
          // Use game_id (the backend key). Earlier code used g.id which is
          // undefined on API response — that made ALL game cards share a
          // single form state and a single results entry.
          const gid = g.game_id;
          const r = results[gid] || {};
          const f = getForm(gid);
          const autoJodi = r.jodi ||
            (r.open_ank && r.close_ank ? `${r.open_ank}${r.close_ank}` :
             r.open_ank ? `${r.open_ank}_` :
             r.close_ank ? `_${r.close_ank}` :
             null);
          return (
            <Card key={gid} className="bg-[#141418] border-white/10" data-testid={`admin-kalyan-card-${gid}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="text-white font-bold text-base">{g.name}</h3>
                    <p className="text-gray-400 text-xs">
                      Open: {g.start_time || '--:--'} • Close: {g.end_time || '--:--'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[#D4AF37] font-mono text-lg tabular-nums" data-testid={`admin-kalyan-summary-${gid}`}>
                      {r.open_panna || 'XXX'}-{autoJodi || 'XX'}-{r.close_panna || 'XXX'}
                    </p>
                    {(r.open_panna || r.close_panna) && (
                      <Button size="sm" variant="ghost" onClick={() => deleteResult(gid)} disabled={loading}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 h-auto" title="Delete full result" data-testid={`admin-kalyan-delete-${gid}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* OPEN side */}
                  <div className="bg-[#0A0A0C] rounded-lg p-3 border border-green-500/20">
                    <p className="text-green-400 text-xs font-bold mb-1">OPEN</p>
                    {r.open_panna ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-white font-mono font-black text-lg" data-testid={`admin-kalyan-open-${gid}`}>{r.open_panna}</p>
                          <p className="text-gray-400 text-[10px]">Ank: {r.open_ank}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => reverse(gid, 'open')} disabled={loading}
                          className="text-orange-400 hover:text-orange-300 p-1.5 h-auto" data-testid={`admin-kalyan-reverse-open-${gid}`}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1">
                          <Input
                            value={f.open}
                            onChange={e => setForm(gid, 'open', e.target.value)}
                            placeholder="XXX"
                            maxLength={3}
                            data-testid={`admin-kalyan-open-input-${gid}`}
                            className="bg-[#141418] border-white/10 text-white font-mono h-8 text-center"
                          />
                          <Button size="sm" variant="ghost" onClick={() => setPicker({ gameId: gid, session: 'open' })}
                            className="text-[#D4AF37] hover:bg-[#D4AF37]/10 h-8 px-1.5"
                            title="Panna chuno" data-testid={`admin-kalyan-pick-open-${gid}`}>
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => declare(gid, 'open')} disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white h-8 px-2"
                            data-testid={`admin-kalyan-declare-open-${gid}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {f.open && /^\d{3}$/.test(f.open) && (
                          <p className="text-gray-400 text-[10px] mt-1">Ank preview: <span className="text-green-400 font-bold">{(f.open.split('').reduce((s, d) => s + +d, 0)) % 10}</span></p>
                        )}
                      </>
                    )}
                  </div>

                  {/* JODI (auto-computed) */}
                  <div
                    className="rounded-lg p-3 border flex flex-col items-center justify-center"
                    style={{
                      background: autoJodi
                        ? 'linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(184,134,11,0.08) 100%)'
                        : '#0A0A0C',
                      borderColor: autoJodi ? 'rgba(212,175,55,0.45)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <p className="text-[#D4AF37] text-xs font-bold mb-1">JODI <span className="text-gray-400 font-normal">(auto)</span></p>
                    {autoJodi ? (
                      <p className="text-[#FDE047] font-mono font-black text-2xl tabular-nums" data-testid={`admin-kalyan-jodi-${gid}`}>{autoJodi}</p>
                    ) : (
                      <p className="text-gray-500 font-mono text-lg">--</p>
                    )}
                    <p className="text-gray-500 text-[10px] mt-1 text-center">
                      {r.open_ank && r.close_ank
                        ? 'Open & Close se auto'
                        : !r.open_ank
                          ? 'Open declare karo'
                          : 'Close declare karo'}
                    </p>
                  </div>

                  {/* CLOSE side */}
                  <div className="bg-[#0A0A0C] rounded-lg p-3 border border-red-500/20">
                    <p className="text-red-400 text-xs font-bold mb-1">CLOSE</p>
                    {r.close_panna ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-white font-mono font-black text-lg" data-testid={`admin-kalyan-close-${gid}`}>{r.close_panna}</p>
                          <p className="text-gray-400 text-[10px]">Ank: {r.close_ank}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => reverse(gid, 'close')} disabled={loading}
                          className="text-orange-400 hover:text-orange-300 p-1.5 h-auto" data-testid={`admin-kalyan-reverse-close-${gid}`}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1">
                          <Input
                            value={f.close}
                            onChange={e => setForm(gid, 'close', e.target.value)}
                            placeholder="XXX"
                            maxLength={3}
                            data-testid={`admin-kalyan-close-input-${gid}`}
                            className="bg-[#141418] border-white/10 text-white font-mono h-8 text-center"
                          />
                          <Button size="sm" variant="ghost" onClick={() => setPicker({ gameId: gid, session: 'close' })}
                            className="text-[#D4AF37] hover:bg-[#D4AF37]/10 h-8 px-1.5"
                            title="Panna chuno" data-testid={`admin-kalyan-pick-close-${gid}`}>
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => declare(gid, 'close')} disabled={loading}
                            className="bg-red-600 hover:bg-red-700 text-white h-8 px-2"
                            data-testid={`admin-kalyan-declare-close-${gid}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {f.close && /^\d{3}$/.test(f.close) && (
                          <p className="text-gray-400 text-[10px] mt-1">Ank preview: <span className="text-red-400 font-bold">{(f.close.split('').reduce((s, d) => s + +d, 0)) % 10}</span></p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Panna Quick Picker Modal */}
      {picker && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
          onClick={() => setPicker(null)}
          data-testid="panna-picker-overlay"
        >
          <div
            className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden flex flex-col"
            style={{ background: '#0F0F1A', border: '1px solid rgba(212, 175, 55, 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 sticky top-0"
              style={{ background: '#0F0F1A', borderBottom: '1px solid rgba(212, 175, 55, 0.3)' }}>
              <div>
                <h3 className="text-[#FFD700] font-bold text-base">
                  Panna chuno — {picker.session.toUpperCase()}
                </h3>
                <p className="text-gray-400 text-xs">
                  Ank ke hisaab se panna select karo. Click karte hi input bhar jayega.
                </p>
              </div>
              <button onClick={() => setPicker(null)} className="text-gray-400 font-bold text-2xl px-2" data-testid="panna-picker-close">×</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((ank) => (
                <div key={ank}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black"
                      style={{
                        background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                        color: '#1A0F00',
                      }}
                    >{ank}</span>
                    <span className="text-gray-300 text-xs font-bold">Ank {ank}</span>
                    <span className="text-gray-500 text-[10px]">({PANNAS_BY_ANK[ank].length} pannas)</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {PANNAS_BY_ANK[ank].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setForm(picker.gameId, picker.session, p);
                          setPicker(null);
                        }}
                        data-testid={`panna-pick-${p}`}
                        className="text-white font-mono text-xs py-1.5 rounded-md active:scale-95"
                        style={{
                          background: '#1A1A2E',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >{p}</button>
                    ))}
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

export default AdminKalyanResultsTab;
