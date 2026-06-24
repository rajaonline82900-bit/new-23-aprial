import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, BarChart3, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Modal that displays the last 30 results history for a given game.
 * Triggered by clicking the chart icon next to a game name.
 */
const GameHistoryModal = ({ game, onClose }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!game?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/api/results/${game.id}?limit=30`, {
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

  if (!game) return null;

  const fmtDate = (d) => {
    if (!d) return '--';
    try {
      const dt = new Date(d);
      const day = String(dt.getDate()).padStart(2, '0');
      const mon = dt.toLocaleString('en-US', { month: 'short' });
      const yr = dt.getFullYear();
      return `${day} ${mon} ${yr}`;
    } catch {
      return d.toString().slice(0, 10);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[180] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      data-testid="game-history-modal"
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1A1A2E 0%, #0F0F1E 100%)',
          border: '2px solid #D4AF37',
          maxHeight: '85vh',
          animation: 'popupEnter 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[#D4AF37]/30 sticky top-0 z-10"
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
                Result History · Last 30 days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="game-history-close"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(85vh - 72px)' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
              <span className="text-gray-400 text-xs">Loading history...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <BarChart3 className="w-10 h-10 text-gray-600" />
              <p className="text-gray-400 text-sm">No results available yet</p>
              <p className="text-gray-600 text-xs">Results will appear here as they're declared</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {results.map((r, idx) => (
                <div
                  key={r.id || idx}
                  data-testid={`history-row-${idx}`}
                  className="rounded-xl p-2.5 flex items-center justify-between"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.04) 100%)',
                    border: '1px solid rgba(212, 175, 55, 0.25)',
                  }}
                >
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">
                      {fmtDate(r.date)}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-0.5">Jodi</span>
                  </div>
                  <span
                    className="text-2xl font-black tabular-nums"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      fontFamily: 'Outfit, monospace',
                      textShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
                    }}
                  >
                    {r.jodi_result || r.jodi || '--'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameHistoryModal;
