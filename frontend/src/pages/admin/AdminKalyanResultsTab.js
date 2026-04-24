import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { RotateCcw, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminKalyanResultsTab = ({ games = [] }) => {
  const kalyanGames = games.filter(g => g.category === 'kalyan');
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [date, setDate] = useState(today);
  const [results, setResults] = useState([]);
  const [forms, setForms] = useState({});  // {gameId: {open:'', close:''}}
  const [loading, setLoading] = useState(false);

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

  if (kalyanGames.length === 0) {
    return <div className="text-gray-400 text-center py-8">Koi Kalyan game nahi mila</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-gray-300 text-sm">Date:</label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-[#0A0A0C] border-white/10 text-white w-44 h-9" data-testid="admin-kalyan-date" />
      </div>

      <div className="grid gap-3">
        {kalyanGames.map(g => {
          const r = results[g.id] || {};
          const f = getForm(g.id);
          return (
            <Card key={g.id} className="bg-[#141418] border-white/10" data-testid={`admin-kalyan-card-${g.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold text-base">{g.name}</h3>
                    <p className="text-gray-400 text-xs">{g.display_time}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[#D4AF37] font-mono text-lg">
                      {r.open_panna || 'XXX'}-{r.jodi || (r.open_ank ? `${r.open_ank}*` : 'XX')}-{r.close_panna || 'XXX'}
                    </p>
                    {(r.open_panna || r.close_panna) && (
                      <Button size="sm" variant="ghost" onClick={() => deleteResult(g.id)} disabled={loading}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 h-auto" title="Delete full result" data-testid={`admin-kalyan-delete-${g.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* OPEN side */}
                  <div className="bg-[#0A0A0C] rounded-lg p-3 border border-white/5">
                    <p className="text-green-400 text-xs font-bold mb-1">OPEN</p>
                    {r.open_panna ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-white font-mono font-black text-lg" data-testid={`admin-kalyan-open-${g.id}`}>{r.open_panna}</p>
                          <p className="text-gray-400 text-[10px]">Ank: {r.open_ank}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => reverse(g.id, 'open')} disabled={loading}
                          className="text-orange-400 hover:text-orange-300 p-1.5 h-auto" data-testid={`admin-kalyan-reverse-open-${g.id}`}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Input
                          value={f.open}
                          onChange={e => setForm(g.id, 'open', e.target.value)}
                          placeholder="XXX"
                          maxLength={3}
                          data-testid={`admin-kalyan-open-input-${g.id}`}
                          className="bg-[#141418] border-white/10 text-white font-mono h-8 text-center"
                        />
                        <Button size="sm" onClick={() => declare(g.id, 'open')} disabled={loading}
                          className="bg-green-600 hover:bg-green-700 text-white h-8 px-2"
                          data-testid={`admin-kalyan-declare-open-${g.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* CLOSE side */}
                  <div className="bg-[#0A0A0C] rounded-lg p-3 border border-white/5">
                    <p className="text-red-400 text-xs font-bold mb-1">CLOSE</p>
                    {r.close_panna ? (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-white font-mono font-black text-lg" data-testid={`admin-kalyan-close-${g.id}`}>{r.close_panna}</p>
                          <p className="text-gray-400 text-[10px]">Ank: {r.close_ank}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => reverse(g.id, 'close')} disabled={loading}
                          className="text-orange-400 hover:text-orange-300 p-1.5 h-auto" data-testid={`admin-kalyan-reverse-close-${g.id}`}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Input
                          value={f.close}
                          onChange={e => setForm(g.id, 'close', e.target.value)}
                          placeholder="XXX"
                          maxLength={3}
                          data-testid={`admin-kalyan-close-input-${g.id}`}
                          className="bg-[#141418] border-white/10 text-white font-mono h-8 text-center"
                        />
                        <Button size="sm" onClick={() => declare(g.id, 'close')} disabled={loading}
                          className="bg-red-600 hover:bg-red-700 text-white h-8 px-2"
                          data-testid={`admin-kalyan-declare-close-${g.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminKalyanResultsTab;
