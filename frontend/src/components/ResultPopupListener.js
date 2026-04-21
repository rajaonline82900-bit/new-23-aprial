import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { X, Trophy, Sparkles } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const LS_KEY = 'last_seen_result_ids';
const POLL_MS = 10000;
const AUTO_CLOSE_MS = 10000;

const GAME_NAMES = {
  delhi_bazaar: 'Delhi Bazaar',
  shri_ganesh: 'Shri Ganesh',
  faridabad: 'Faridabad',
  ghaziabad: 'Ghaziabad',
  gali: 'Gali',
  disawar: 'Disawar',
  delhi_bazar: 'Delhi Bazar',
};

const playTing = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Single coin clink: high metallic frequencies with fast decay
    const coin = (startTime, pitch = 1) => {
      // Bright metallic transient - two high oscillators
      [2800, 1900, 1400].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * pitch, ctx.currentTime + startTime);
        // fast pitch drop for "ching" effect
        osc.frequency.exponentialRampToValueAtTime(freq * pitch * 0.85, ctx.currentTime + startTime + 0.08);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.25 / (i + 1), ctx.currentTime + startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + 0.2);
      });

      // Low "thud" for coin hitting surface
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(180 * pitch, ctx.currentTime + startTime);
      bass.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + startTime + 0.1);
      bassGain.gain.setValueAtTime(0.0001, ctx.currentTime + startTime);
      bassGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + startTime + 0.005);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + 0.12);
      bass.connect(bassGain);
      bassGain.connect(ctx.destination);
      bass.start(ctx.currentTime + startTime);
      bass.stop(ctx.currentTime + startTime + 0.15);
    };

    // Play 3 coins dropping in quick succession - cash register feel
    coin(0, 1.0);
    coin(0.09, 1.08);
    coin(0.2, 0.95);
  } catch (e) {}
};

const ResultPopupListener = () => {
  const [popup, setPopup] = useState(null);
  const timerRef = useRef(null);
  const initializedRef = useRef(false);

  const markSeen = (ids) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(ids));
    } catch (e) {}
  };

  const getSeen = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'));
    } catch {
      return new Set();
    }
  };

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API}/api/results?date=${todayStr()}`);
        const items = Array.isArray(data) ? data : data.results || [];
        const ordered = [...items].sort((a, b) => new Date(b.declared_at || 0) - new Date(a.declared_at || 0));
        const seen = getSeen();

        if (!initializedRef.current) {
          // First run - treat everything as already seen (no old popups on app open)
          initializedRef.current = true;
          markSeen(ordered.map(r => resultId(r)));
          return;
        }

        const fresh = ordered.find(r => !seen.has(resultId(r)));
        if (fresh && !cancelled) {
          seen.add(resultId(fresh));
          markSeen([...seen]);
          showPopup(fresh);
        }
      } catch (e) {
        // silently ignore
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const showPopup = (result) => {
    setPopup({
      game: GAME_NAMES[result.game_id] || result.game_id,
      jodi: result.jodi_result,
      single: result.single_result,
    });
    playTing();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPopup(null), AUTO_CLOSE_MS);
  };

  const close = () => {
    setPopup(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  if (!popup) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={close}
      data-testid="result-popup-overlay"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #1a1410 0%, #241a12 50%, #1a1410 100%)',
          border: '2px solid #D4AF37',
          animation: 'popupEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        data-testid="result-popup-modal"
      >
        {/* Glow gradient top */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#D4AF37]/30 to-transparent pointer-events-none" />

        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center z-10 transition-all"
          data-testid="result-popup-close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative p-6 text-center">
          {/* Sparkle icons */}
          <div className="flex justify-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse" />
            <Trophy className="w-8 h-8 text-[#D4AF37] drop-shadow-[0_0_12px_rgba(212,175,55,0.6)]" />
            <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse" />
          </div>

          <p className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest mb-1">
            गजब रिजल्ट खुल गया!
          </p>
          <h2 className="text-white text-2xl font-black mb-4 tracking-tight">
            {popup.game}
          </h2>

          {/* Jodi display */}
          <div className="inline-block mb-2">
            <div className="relative">
              <div
                className="px-10 py-4 rounded-2xl font-black text-5xl text-black tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, #FDE047 0%, #D4AF37 50%, #B8941E 100%)',
                  boxShadow: '0 0 40px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                  fontFamily: 'Unbounded, sans-serif',
                }}
                data-testid="result-popup-jodi"
              >
                {popup.jodi}
              </div>
            </div>
          </div>

          {popup.single !== undefined && popup.single !== null && (
            <p className="text-gray-400 text-xs mt-3">
              सिंगल: <span className="text-[#D4AF37] font-bold">{popup.single}</span>
            </p>
          )}

          <p className="text-gray-500 text-[10px] mt-4">
            {AUTO_CLOSE_MS / 1000}s में ऑटो-बंद होगा
          </p>
        </div>
      </div>

      <style>{`
        @keyframes popupEnter {
          0% { transform: scale(0.7) translateY(40px); opacity: 0; }
          60% { transform: scale(1.05) translateY(-5px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const resultId = (r) => `${r.game_id}-${r.date}-${r.jodi_result}`;

export default ResultPopupListener;
