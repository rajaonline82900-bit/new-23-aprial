import React, { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';

/**
 * BigWinPopup — full-screen animated overlay that fires for wins ≥ ₹1000.
 * Renders a slot-machine style number reel that counts up to the payout,
 * plus a gold-coin cascade using pure CSS. Auto-dismisses after 5.5s.
 *
 * Props:
 *   payout   — number (₹). Popup only renders when this is set.
 *   game     — 'crazy_time' | 'dragon_tiger' | 'color_game' | 'coin_toss'
 *   onClose  — callback fired when popup dismissed (user tap or auto-timeout)
 */
const GAME_LABEL = {
  crazy_time:  'CRAZY TIME',
  dragon_tiger: 'DRAGON TIGER',
  color_game:  'COLOR GAME',
  coin_toss:   'COIN TOSS',
};

const BigWinPopup = ({ payout, game, onClose }) => {
  const [display, setDisplay] = useState(0);

  // Count-up reel animation
  useEffect(() => {
    if (!payout) return;
    setDisplay(0);
    const target = Math.floor(payout);
    const duration = 2200; // ms
    const started = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - started) / duration);
      // Ease-out cubic for a slot-machine feel
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const t = setTimeout(() => onClose?.(), 5500);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [payout, onClose]);

  if (!payout) return null;

  // 24 falling coins with staggered animation-delay
  const coins = Array.from({ length: 24 });

  return (
    <div
      data-testid="big-win-popup"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(120, 53, 15, 0.85) 0%, rgba(0, 0, 0, 0.95) 100%)',
        backdropFilter: 'blur(2px)',
        animation: 'bw-fade-in 0.35s ease-out',
      }}
    >
      <style>{`
        @keyframes bw-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bw-scale-pop { 0% { transform: scale(0.4); opacity: 0 } 55% { transform: scale(1.15); opacity: 1 } 80% { transform: scale(0.95) } 100% { transform: scale(1) } }
        @keyframes bw-glow { 0%,100% { text-shadow: 0 0 24px #FDE047, 0 0 60px #F59E0B } 50% { text-shadow: 0 0 40px #FEF3C7, 0 0 80px #FBBF24 } }
        @keyframes bw-coin-fall {
          0%   { transform: translate(-50%, -110vh) rotate(0deg); opacity: 0 }
          10%  { opacity: 1 }
          100% { transform: translate(-50%, 110vh) rotate(720deg); opacity: 0.9 }
        }
        @keyframes bw-ring-pulse { 0%,100% { transform: scale(1); opacity: 0.6 } 50% { transform: scale(1.35); opacity: 0.2 } }
      `}</style>

      {/* Coin cascade */}
      {coins.map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 4.2 + (i % 3) * 6) % 100}%`,
          top: '-40px',
          width: `${18 + (i % 4) * 4}px`,
          height: `${18 + (i % 4) * 4}px`,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #FEF3C7 0%, #FDE047 45%, #B45309 100%)',
          border: '2px solid #78350F',
          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          animation: `bw-coin-fall ${2.4 + (i % 5) * 0.3}s ${(i * 0.12) % 3.5}s linear infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Center card */}
      <div style={{ animation: 'bw-scale-pop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
           className="relative flex flex-col items-center gap-3 px-8 py-8 rounded-3xl mx-4"
           onClick={(e) => e.stopPropagation()}>

        {/* Radiant background rings */}
        <div className="absolute inset-0 rounded-3xl" style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, rgba(180,83,9,0.6) 60%, rgba(120,53,15,0.85) 100%)',
          border: '4px solid #FDE047',
          boxShadow: '0 0 80px rgba(251,191,36,0.7), inset 0 -8px 24px rgba(0,0,0,0.4), inset 0 4px 12px rgba(255,255,255,0.15)',
        }} />
        <div className="absolute inset-2 rounded-3xl border-2 border-yellow-200/40" style={{ animation: 'bw-ring-pulse 2.4s ease-in-out infinite' }} />

        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 z-10"
          data-testid="big-win-close"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-yellow-100" />
        </button>

        <div className="relative z-10 flex flex-col items-center gap-2">
          <Trophy className="w-14 h-14" style={{ color: '#FDE047', filter: 'drop-shadow(0 0 12px #F59E0B)' }} />
          <p className="text-xs font-black tracking-[0.3em] uppercase text-yellow-200/90">{GAME_LABEL[game] || 'JACKPOT'}</p>
          <p className="text-5xl font-black tracking-widest uppercase"
             style={{ color: '#FEF3C7', animation: 'bw-glow 1.5s ease-in-out infinite', fontFamily: 'Outfit, sans-serif' }}>
            BIG WIN!
          </p>
          <div className="mt-2 px-6 py-3 rounded-2xl"
               style={{ background: 'linear-gradient(180deg, #0A0A14 0%, #1F2937 100%)', border: '3px solid #FDE047', boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.5)' }}
               data-testid="big-win-amount">
            <span className="text-4xl font-black tabular-nums" style={{ color: '#22C55E', textShadow: '0 0 12px #22C55E, 0 2px 4px rgba(0,0,0,0.8)' }}>
              +₹{display.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[10px] font-bold tracking-widest text-yellow-200/70 mt-2">
            TAP ANYWHERE TO DISMISS
          </p>
        </div>
      </div>
    </div>
  );
};

export default BigWinPopup;
