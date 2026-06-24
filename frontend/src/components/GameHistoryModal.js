import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X, BarChart3, Loader2, ChevronDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];

/**
 * Modal that displays the result history for a specific game.
 * - Single-column vertical list (date on left, jodi on right).
 * - Default: latest 30 days (descending).
 * - Month + Year filter to view past results.
 */
const GameHistoryModal = ({ game, onClose }) => {
  const now = new Date();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('all'); // 'all' or 1-12
  const [year, setYear] = useState('all'); // 'all' or YYYY

  // Pull full history (up to ~365 days) so we can client-side filter by month/year
  useEffect(() => {
    if (!game?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/results/${game.id}?limit=365`, {
          withCredentials: true,
        });
        if (!cancelled) setResults(data.results || []);
      } catch (e) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game?.id]);

  // Year options derived from results (fallback to current/last 2 years)
  const yearOptions = useMemo(() => {
    const years = new Set();
    results.forEach((r) => {
      if (r?.date) {
        const y = parseInt(String(r.date).slice(0, 4), 10);
        if (!Number.isNaN(y)) years.add(y);
      }
    });
    [now.getFullYear(), now.getFullYear() - 1].forEach((y) => years.add(y));
    return Array.from(years).sort((a, b) => b - a);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  // Filter + slice (default = latest 30 entries)
  const visible = useMemo(() => {
    let arr = results.slice();
    if (year !== 'all') {
      arr = arr.filter((r) => String(r.date || '').startsWith(String(year)));
    }
    if (month !== 'all') {
      const mm = String(month).padStart(2, '0');
      arr = arr.filter((r) => String(r.date || '').slice(5, 7) === mm);
    }
    if (month === 'all' && year === 'all') {
      arr = arr.slice(0, 30);
    }
    return arr;
  }, [results, month, year]);

  if (!game) return null;

  const fmtDate = (d) => {
    if (!d) return '--';
    try {
      const dt = new Date(d);
      const day = String(dt.getDate()).padStart(2, '0');
      const mon = dt.toLocaleString('en-US', { month: 'short' });
      const yr = dt.getFullYear();
      const weekday = dt.toLocaleString('en-US', { weekday: 'short' });
      return { full: `${day} ${mon} ${yr}`, weekday };
    } catch {
      return { full: String(d).slice(0, 10), weekday: '' };
    }
  };

  return (
    <div
      className="fixed inset-0 z-[180] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      data-testid="game-history-modal"
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1A1A2E 0%, #0F0F1E 100%)',
          border: '2px solid #D4AF37',
          maxHeight: '88vh',
          animation: 'popupEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/30 shrink-0"
          style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2A2240 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)' }}
            >
              <BarChart3 className="w-5 h-5 text-[#1A1A2E]" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3
                className="text-lg font-black truncate"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  fontFamily: 'Outfit, sans-serif',
                }}
                data-testid="history-game-name"
              >
                {game.name_hi || game.name}
              </h3>
              <p className="text-[10px] text-gray-400 leading-none uppercase tracking-wider">
                Result History
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="game-history-close"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-all shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-white/5 grid grid-cols-2 gap-2 shrink-0" data-testid="history-filters">
          {/* Month */}
          <div className="relative">
            <label className="block text-[9px] text-[#D4AF37] uppercase tracking-wider font-bold mb-1">Month</label>
            <div className="relative">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                data-testid="history-month-select"
                className="w-full appearance-none rounded-xl px-3 py-2 pr-8 text-sm font-bold text-white outline-none transition-all"
                style={{
                  background: 'linear-gradient(135deg, #1F1F35 0%, #14142B 100%)',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                }}
              >
                <option value="all">All Months</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#D4AF37] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          {/* Year */}
          <div className="relative">
            <label className="block text-[9px] text-[#D4AF37] uppercase tracking-wider font-bold mb-1">Year</label>
            <div className="relative">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                data-testid="history-year-select"
                className="w-full appearance-none rounded-xl px-3 py-2 pr-8 text-sm font-bold text-white outline-none transition-all"
                style={{
                  background: 'linear-gradient(135deg, #1F1F35 0%, #14142B 100%)',
                  border: '1px solid rgba(212, 175, 55, 0.4)',
                }}
              >
                <option value="all">All Years</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#D4AF37] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Body: vertical single-column list */}
        <div className="overflow-y-auto px-3 py-3 flex-1" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
              <span className="text-gray-400 text-xs">Loading history...</span>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <BarChart3 className="w-10 h-10 text-gray-600" />
              <p className="text-gray-400 text-sm">No results for selected period</p>
              <p className="text-gray-600 text-xs">Try a different month / year</p>
            </div>
          ) : (
            <>
              <div className="px-1 mb-2 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  {visible.length} {visible.length === 1 ? 'result' : 'results'}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-bold">
                  Latest → Oldest
                </span>
              </div>
              <div className="space-y-1.5">
                {visible.map((r, idx) => {
                  const f = fmtDate(r.date);
                  const dateStr = typeof f === 'string' ? f : f.full;
                  const weekday = typeof f === 'string' ? '' : f.weekday;
                  return (
                    <div
                      key={r.id || idx}
                      data-testid={`history-row-${idx}`}
                      className="rounded-xl px-3 py-2.5 flex items-center justify-between transition-all hover:scale-[1.01]"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.03) 60%, rgba(212, 175, 55, 0.08) 100%)',
                        border: '1px solid rgba(212, 175, 55, 0.22)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 215, 0, 0.06)',
                      }}
                    >
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm text-white font-bold tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {dateStr}
                        </span>
                        {weekday && (
                          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{weekday}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Jodi</span>
                        <span
                          className="text-2xl font-black tabular-nums"
                          style={{
                            backgroundImage: 'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            fontFamily: 'Outfit, monospace',
                            textShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
                            minWidth: '40px',
                            textAlign: 'right',
                          }}
                          data-testid={`history-jodi-${idx}`}
                        >
                          {r.jodi_result || r.jodi || '--'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHistoryModal;
