import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, TrendingUp, Loader2, Flame, Coins, ChevronDown } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const BET_TYPE_LABEL = {
  jodi: 'जोड़ी (Jodi)',
  haruf_andar: 'हरूफ अंदर',
  haruf_bahar: 'हरूफ बाहर',
  single_ank: 'सिंगल अंक',
  single_panna: 'सिंगल पत्ती',
  double_panna: 'डबल पत्ती',
  triple_panna: 'ट्रिपल पत्ती',
  half_sangam: 'हाफ संगम',
  full_sangam: 'फुल संगम',
  kalyan_jodi: 'कल्याण जोड़ी',
};

const fmtAmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

const JantriModal = ({ game, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/games/${game.id}/jantri`);
        if (!alive) return;
        setData(data);
        // Auto-open the first section
        if (data.sections && !data.locked) {
          setOpenSection(Object.keys(data.sections)[0] || null);
        }
      } catch (e) {
        if (alive) setData({ error: true });
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [game.id]);

  const sectionLabel = (key) => {
    // key is either "bet_type" or "bet_type__session"
    const [bt, session] = key.split('__');
    const base = BET_TYPE_LABEL[bt] || bt.replace(/_/g, ' ');
    return session ? `${base} · ${session.toUpperCase()}` : base;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      data-testid="jantri-modal-backdrop"
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden border-t-2 sm:border-2 border-[#FFD700] max-h-[90vh] flex flex-col"
        style={{ background: 'linear-gradient(180deg, #1A1408 0%, #0A0A0C 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center gap-3 shrink-0"
          style={{ background: 'linear-gradient(90deg, #B8860B 0%, #FFD700 50%, #B8860B 100%)' }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-black/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-black font-black text-base leading-tight truncate" data-testid="jantri-title">
              {game.name_hi || game.name} — Jantri
            </p>
            <p className="text-black/70 text-[10px] font-bold uppercase tracking-widest">
              Live number-wise bet report · Aaj
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="jantri-close-btn"
            className="w-8 h-8 rounded-full bg-black/25 text-white flex items-center justify-center active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
            </div>
          ) : data?.error ? (
            <p className="text-center text-red-400 py-8 font-bold">Load fail — thodi der me try karo</p>
          ) : data?.locked ? (
            <div className="rounded-2xl p-8 text-center bg-white/5 border border-white/10">
              <p className="text-4xl mb-2">🔒</p>
              <p className="text-white font-black text-lg">Result declare ho gaya</p>
              <p className="text-gray-400 text-xs mt-1">Aaj ki jantri report ab available nahi hai</p>
            </div>
          ) : data?.total_unique_numbers === 0 ? (
            <div className="rounded-2xl p-8 text-center bg-white/5 border border-white/10">
              <Coins className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <p className="text-white font-black">Abhi tak koi bet nahi lagi</p>
              <p className="text-gray-500 text-xs mt-1">Aaj ke din pehle player bano!</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-2.5 bg-yellow-500/10 border border-yellow-500/30 text-center">
                  <p className="text-[9px] text-yellow-300/80 uppercase tracking-wider font-bold">Total Bets</p>
                  <p className="text-white font-black text-base tabular-nums mt-0.5" data-testid="jantri-total-count">
                    {data.total_unique_numbers}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <p className="text-[9px] text-emerald-300/80 uppercase tracking-wider font-bold">Total ₹</p>
                  <p className="text-emerald-300 font-black text-base tabular-nums mt-0.5" data-testid="jantri-total-amount">
                    {fmtAmt(data.total_amount)}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 bg-pink-500/10 border border-pink-500/30 text-center">
                  <p className="text-[9px] text-pink-300/80 uppercase tracking-wider font-bold">Types</p>
                  <p className="text-pink-300 font-black text-base tabular-nums mt-0.5">
                    {data.total_bet_types}
                  </p>
                </div>
              </div>

              {/* Sections (accordion) */}
              {Object.entries(data.sections).map(([key, rows]) => {
                const isOpen = openSection === key;
                const sectionTotal = rows.reduce((s, r) => s + r.total_amount, 0);
                return (
                  <div key={key} className="rounded-2xl overflow-hidden border border-white/10 bg-[#141418]" data-testid={`jantri-section-${key}`}>
                    <button
                      onClick={() => setOpenSection(isOpen ? null : key)}
                      className="w-full px-3 py-2.5 flex items-center gap-2 active:bg-white/5"
                    >
                      <TrendingUp className="w-4 h-4 text-[#FFD700] shrink-0" />
                      <p className="flex-1 text-left text-sm font-black text-white capitalize truncate">
                        {sectionLabel(key)}
                      </p>
                      <span className="text-[10px] font-black text-emerald-300 tabular-nums">
                        {fmtAmt(sectionTotal)}
                      </span>
                      <span className="text-[9px] text-gray-400 font-bold">{rows.length}#</span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="p-2 border-t border-white/5">
                        <div className="grid grid-cols-3 gap-1.5">
                          {rows.map((r, i) => {
                            const isHot = i < 3;
                            return (
                              <div
                                key={r.number + '-' + i}
                                data-testid={`jantri-row-${key}-${r.number}`}
                                className={`rounded-lg px-2 py-1.5 border tabular-nums ${
                                  isHot
                                    ? 'bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/40'
                                    : 'bg-white/5 border-white/10'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`font-black text-sm ${isHot ? 'text-orange-300' : 'text-[#FFD700]'}`}
                                  >
                                    {r.number}
                                  </span>
                                  {isHot && <Flame className="w-3 h-3 text-orange-400" />}
                                </div>
                                <p className="text-[9px] text-emerald-400 font-bold leading-tight">{fmtAmt(r.total_amount)}</p>
                                <p className="text-[8px] text-gray-500 leading-tight">{r.bet_count}× bets</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-center text-[10px] text-gray-500 font-bold pt-2">
                🔒 Result declare hote hi ye report auto-hide ho jayegi
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JantriModal;
