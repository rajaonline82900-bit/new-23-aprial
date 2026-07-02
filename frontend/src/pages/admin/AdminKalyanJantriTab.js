import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const SESSIONS = [
  { id: 'open',  label: 'OPEN Session',  color: '#22C55E' },
  { id: 'close', label: 'CLOSE Session', color: '#EF4444' },
];

const TYPE_ORDER = [
  { id: 'single_ank',    label: 'Single',        digits: 1, columns: 10 },
  { id: 'single_panna',  label: 'Single Patti',  digits: 3, columns: 6  },
  { id: 'double_panna',  label: 'Double Patti',  digits: 3, columns: 6  },
  { id: 'triple_panna',  label: 'Triple Patti',  digits: 3, columns: 5  },
  { id: 'kalyan_jodi',   label: 'Jodi',          digits: 2, columns: 10 },
];

const AdminKalyanJantriTab = ({ games = [] }) => {
  const kalyanGames = games.filter(g => g.category === 'kalyan');
  const [gameId, setGameId] = useState(kalyanGames[0]?.game_id || '');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchJantri = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    try {
      const { data: d } = await axios.get(`${API}/api/admin/kalyan/jantri`, {
        params: { game_id: gameId, date }, withCredentials: true,
      });
      setData(d);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Jantri load fail');
    } finally { setLoading(false); }
  }, [gameId, date]);

  useEffect(() => { fetchJantri(); }, [fetchJantri]);

  useEffect(() => {
    if (!gameId && kalyanGames[0]) setGameId(kalyanGames[0].game_id);
  }, [kalyanGames, gameId]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={gameId} onValueChange={setGameId}>
          <SelectTrigger className="w-56 bg-[#0A0A0C] border-white/10 text-white" data-testid="kalyan-jantri-game">
            <SelectValue placeholder="Kalyan game" />
          </SelectTrigger>
          <SelectContent className="bg-[#141418] border-white/10 max-h-72">
            {kalyanGames.map(g => (
              <SelectItem key={g.game_id} value={g.game_id} className="text-white hover:bg-white/10">
                {g.name_hi || g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-[#0A0A0C] border-white/10 text-white w-44 h-10" data-testid="kalyan-jantri-date" />
      </div>

      {/* Totals */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.35)' }}>
            <p className="text-green-300 text-xs font-bold">OPEN कुल राशि</p>
            <p className="text-white text-2xl font-black" data-testid="kalyan-jantri-open-total">₹{data.totals.open}</p>
            <p className="text-gray-400 text-[10px]">{data.totals.count_open} बेट्स</p>
          </div>
          <div className="p-3 rounded-lg text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)' }}>
            <p className="text-red-300 text-xs font-bold">CLOSE कुल राशि</p>
            <p className="text-white text-2xl font-black" data-testid="kalyan-jantri-close-total">₹{data.totals.close}</p>
            <p className="text-gray-400 text-[10px]">{data.totals.count_close} बेट्स</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      ) : !data ? (
        <div className="text-gray-400 text-center py-8">Data load karo…</div>
      ) : (
        SESSIONS.map(session => (
          <Card key={session.id} className="bg-[#141418] border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: session.color }} />
                <span style={{ color: session.color }}>{session.label}</span>
                <span className="text-gray-400 text-xs ml-auto">
                  {data.game_name} • {data.date}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {TYPE_ORDER
                .filter(t => data.jantri[session.id]?.[t.id])   // skip absent (e.g. Jodi in close)
                .map(t => {
                  const bucket = data.jantri[session.id][t.id];
                  const entries = Object.entries(bucket).sort((a, b) => b[1].amount - a[1].amount);
                  const sessionTotal = entries.reduce((s, [, v]) => s + v.amount, 0);
                  return (
                    <div key={t.id} data-testid={`jantri-${session.id}-${t.id}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-white font-bold text-sm">{t.label}</h4>
                        <span className="text-[#D4AF37] text-xs font-semibold">
                          ₹{sessionTotal.toFixed(0)} • {entries.length} numbers
                        </span>
                      </div>
                      {entries.length === 0 ? (
                        <p className="text-gray-500 text-[11px] italic py-1">Koi bet nahi</p>
                      ) : (
                        <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${t.columns}, minmax(0, 1fr))` }}>
                          {entries.map(([digit, v]) => (
                            <div key={digit} className="p-2 bg-[#0A0A0C] rounded-md border border-white/5 text-center">
                              <div className="text-[#D4AF37] font-mono font-black text-sm">{digit}</div>
                              <div className="text-white text-xs font-bold">₹{v.amount.toFixed(0)}</div>
                              <div className="text-gray-500 text-[9px]">{v.count} bet</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default AdminKalyanJantriTab;
