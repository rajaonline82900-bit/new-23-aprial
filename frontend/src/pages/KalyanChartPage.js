import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const MONTHS = [
  { v: 0, l: 'सभी महीने' }, { v: 1, l: 'Jan' }, { v: 2, l: 'Feb' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Apr' }, { v: 5, l: 'May' }, { v: 6, l: 'Jun' }, { v: 7, l: 'Jul' },
  { v: 8, l: 'Aug' }, { v: 9, l: 'Sep' }, { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dec' },
];

/**
 * KalyanChartPage — Date-wise result chart for a single Kalyan game.
 * Columns: Date | Open Panna | Jodi | Close Panna. Filters: Year + Month.
 */
const KalyanChartPage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [game, setGame] = useState(null);

  const fetchGame = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/games`, { withCredentials: true });
      setGame((data.games || []).find((g) => g.id === gameId || g.game_id === gameId) || null);
    } catch (_) { /* silent */ }
  }, [gameId]);

  const fetchYears = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/kalyan/chart/${gameId}/years`);
      const ys = data.years || [];
      setYears(ys);
      if (ys.length && !year) setYear(ys[0]); // default to newest year
    } catch (_) { /* silent */ }
  }, [gameId, year]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set('year', year);
      if (month) params.set('month', month);
      params.set('limit', 400);
      const { data } = await axios.get(`${API}/api/kalyan/chart/${gameId}?${params.toString()}`);
      setRows(data.rows || []);
    } catch (_) { setRows([]); }
    finally { setLoading(false); }
  }, [gameId, year, month]);

  useEffect(() => { fetchGame(); fetchYears(); }, [fetchGame, fetchYears]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const gameName = game?.name || gameId;

  // Group rows by month for section headers
  const grouped = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = r.date?.slice(0, 7) || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return Object.entries(map);
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#141418] border-b border-white/10 px-3 py-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-[#0A0A0C]" data-testid="chart-back-btn"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-[#D4AF37] truncate">{gameName} — Chart</h1>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest">Date-wise Panna + Jodi</p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 flex items-center gap-2 border-b border-white/5">
        <Calendar className="w-4 h-4 text-gray-400" />
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10) || 0)}
          data-testid="chart-year-select"
          className="bg-[#141418] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white"
        >
          <option value={0}>सभी साल</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10) || 0)}
          data-testid="chart-month-select"
          disabled={!year}
          className="bg-[#141418] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white disabled:opacity-40"
        >
          {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
        <span className="ml-auto text-[10px] text-gray-500 tabular-nums">{rows.length} rows</span>
      </div>

      {/* Chart body */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-500 py-12 text-sm">इस filter में कोई result नहीं</p>
      ) : (
        <div className="p-3 space-y-4" data-testid="chart-body">
          {grouped.map(([ym, rs]) => (
            <div key={ym} className="rounded-xl overflow-hidden border border-white/10 bg-[#141418]">
              <div className="bg-gradient-to-r from-[#D4AF37]/25 to-transparent px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                {ym}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0A0A0C] text-gray-400 text-[10px] uppercase">
                    <th className="text-left px-3 py-2 font-bold">Date</th>
                    <th className="text-center px-2 py-2 font-bold">Open Panna</th>
                    <th className="text-center px-2 py-2 font-bold">Jodi</th>
                    <th className="text-right px-3 py-2 font-bold">Close Panna</th>
                  </tr>
                </thead>
                <tbody>
                  {rs.map((r) => (
                    <tr key={r.date} className="border-t border-white/5 hover:bg-white/5" data-testid={`chart-row-${r.date}`}>
                      <td className="px-3 py-2 tabular-nums text-gray-300 text-xs">{r.date}</td>
                      <td className="text-center px-2 py-2">
                        <span className="tabular-nums font-black text-orange-300">
                          {r.open_panna || '—'}
                          {r.open_ank && <span className="text-gray-500 text-[10px] ml-1">({r.open_ank})</span>}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2">
                        <span className="tabular-nums font-black text-[#D4AF37] text-base">{r.jodi || '—'}</span>
                      </td>
                      <td className="text-right px-3 py-2">
                        <span className="tabular-nums font-black text-cyan-300">
                          {r.close_ank && <span className="text-gray-500 text-[10px] mr-1">({r.close_ank})</span>}
                          {r.close_panna || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KalyanChartPage;
