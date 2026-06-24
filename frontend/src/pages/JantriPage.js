import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  ChevronDown,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];

const JantriPage = () => {
  const now = new Date();
  const [games, setGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [results, setResults] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  // Default: current month + current year
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Fetch games list (only gali_disawar category for now)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/games`, { withCredentials: true });
        const list = Array.isArray(data?.games) ? data.games : [];
        // Show only standard (non-kalyan) games on the result chart page
        const filtered = list.filter((g) => (g.category || 'gali_disawar') === 'gali_disawar');
        setGames(filtered);
        if (filtered.length > 0) setSelectedGameId(filtered[0].id);
      } catch (e) {
        toast.error('Games load नहीं हो पाई');
      } finally {
        setLoadingGames(false);
      }
    })();
  }, []);

  // Fetch result history for the selected game
  useEffect(() => {
    if (!selectedGameId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingResults(true);
        const { data } = await axios.get(
          `${API_URL}/api/results/${selectedGameId}?limit=365`,
          { withCredentials: true },
        );
        if (!cancelled) setResults(data?.results || []);
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          toast.error('Result history load नहीं हो पाई');
        }
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGameId]);

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

  const visible = useMemo(() => {
    let arr = results.slice();
    if (year !== 'all') {
      arr = arr.filter((r) => String(r.date || '').startsWith(String(year)));
    }
    if (month !== 'all') {
      const mm = String(month).padStart(2, '0');
      arr = arr.filter((r) => String(r.date || '').slice(5, 7) === mm);
    }
    // Ascending: 1 Jun, 2 Jun, 3 Jun, ...
    arr.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    if (month === 'all' && year === 'all') {
      arr = arr.slice(-30);
    }
    return arr;
  }, [results, month, year]);

  const fmtDate = (d) => {
    if (!d) return { full: '--', weekday: '' };
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

  const selectedGame = games.find((g) => g.id === selectedGameId);

  return (
    <div
      className="min-h-screen app-shell relative overflow-hidden"
      style={{ background: 'linear-gradient(140deg, #0B0420 0%, #1A0B3D 25%, #2A1058 50%, #1A0B3D 75%, #0B0420 100%)' }}
    >
      {/* ambient lights */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-gradient-to-br from-[#D4AF37]/20 to-[#FFD700]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[350px] h-[350px] bg-gradient-to-br from-[#8B5CF6]/15 to-[#A855F7]/8 rounded-full blur-[110px]" />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-40 shadow-xl"
        style={{
          background: 'linear-gradient(180deg, #0A0A14 0%, #14142B 100%)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
        }}
      >
        <div className="px-3 py-3 max-w-[480px] mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <button
                className="p-2 rounded-lg text-[#FFD700] hover:bg-[#D4AF37]/10 active:scale-95 transition-all"
                data-testid="jantri-back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)' }}
              >
                <BarChart3 className="w-5 h-5 text-[#1A1A2E]" strokeWidth={2.5} />
              </div>
              <h1
                className="text-lg font-black tracking-tight"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Result History
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 max-w-[480px] mx-auto pb-24">
        {/* Game pill selector */}
        {loadingGames ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-sm">No games available</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#D4AF37] mb-2">
                Select Game
              </label>
              <div
                className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
                style={{ scrollbarWidth: 'thin' }}
                data-testid="game-pill-list"
              >
                {games.map((g) => {
                  const isActive = g.id === selectedGameId;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGameId(g.id)}
                      data-testid={`game-pill-${g.id}`}
                      className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
                      style={
                        isActive
                          ? {
                              background:
                                'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)',
                              color: '#1A1A2E',
                              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.55)',
                              fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif',
                            }
                          : {
                              background:
                                'linear-gradient(135deg, #1F1F35 0%, #14142B 100%)',
                              color: '#FFD700',
                              border: '1px solid rgba(212, 175, 55, 0.35)',
                              fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif',
                            }
                      }
                    >
                      {g.name_hi || g.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Month / Year filters */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="block text-[9px] text-[#D4AF37] uppercase tracking-wider font-bold mb-1">
                  Month
                </label>
                <div className="relative">
                  <select
                    value={month}
                    onChange={(e) =>
                      setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                    data-testid="jantri-month-select"
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
              <div>
                <label className="block text-[9px] text-[#D4AF37] uppercase tracking-wider font-bold mb-1">
                  Year
                </label>
                <div className="relative">
                  <select
                    value={year}
                    onChange={(e) =>
                      setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                    data-testid="jantri-year-select"
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

            {/* Selected game card header */}
            <div
              className="rounded-2xl px-4 py-3 mb-3 flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, #1A1A2E 0%, #2A2240 100%)',
                border: '1.5px solid rgba(212, 175, 55, 0.4)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                  Showing
                </p>
                <h2
                  className="text-lg font-black truncate"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif',
                  }}
                  data-testid="jantri-current-game"
                >
                  {selectedGame?.name_hi || selectedGame?.name || '--'}
                </h2>
              </div>
              <span
                className="text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
                  color: '#1A1A2E',
                }}
                data-testid="jantri-result-count"
              >
                {visible.length} results
              </span>
            </div>

            {/* Result list */}
            {loadingResults ? (
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
              <div className="space-y-1.5" data-testid="jantri-results-list">
                {visible.map((r, idx) => {
                  const { full, weekday } = fmtDate(r.date);
                  return (
                    <div
                      key={r.id || `${r.date}-${idx}`}
                      data-testid={`jantri-row-${idx}`}
                      className="rounded-xl px-3 py-2.5 flex items-center justify-between transition-all hover:scale-[1.01]"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.03) 60%, rgba(212, 175, 55, 0.08) 100%)',
                        border: '1px solid rgba(212, 175, 55, 0.22)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 215, 0, 0.06)',
                      }}
                    >
                      <div className="flex flex-col leading-tight">
                        <span
                          className="text-sm text-white font-bold tabular-nums"
                          style={{ fontFamily: 'Outfit, sans-serif' }}
                        >
                          {full}
                        </span>
                        {weekday && (
                          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
                            {weekday}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">
                          Jodi
                        </span>
                        <span
                          className="text-2xl font-black tabular-nums"
                          style={{
                            backgroundImage:
                              'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                            fontFamily: 'Outfit, monospace',
                            textShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
                            minWidth: '40px',
                            textAlign: 'right',
                          }}
                          data-testid={`jantri-jodi-${idx}`}
                        >
                          {r.jodi_result || r.jodi || '--'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
      <FooterNav />
    </div>
  );
};

export default JantriPage;
