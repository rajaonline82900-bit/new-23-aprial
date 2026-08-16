import React, { useEffect, useState } from 'react';

/**
 * Lucky Bet entrance splash screen.
 * Shows once per page load with logo rise + gold ring spin + tagline reveal.
 * Auto-dismisses after ~1.6s, honors prefers-reduced-motion.
 */
const SplashScreen = ({ onDone }) => {
  const [phase, setPhase] = useState('enter'); // 'enter' | 'exit' | 'gone'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 1400);
    const t2 = setTimeout(() => {
      setPhase('gone');
      onDone && onDone();
    }, 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden ${phase === 'exit' ? 'splash-exit' : ''}`}
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(255, 215, 0, 0.18) 0%, transparent 55%), radial-gradient(ellipse 80% 60% at 50% 65%, rgba(20, 169, 76, 0.14) 0%, transparent 55%), #0A0A14',
      }}
      data-testid="splash-screen"
    >
      {/* Ambient particles */}
      <div className="lucky-sparkles absolute inset-0" />

      {/* Rotating conic ring */}
      <div
        className="absolute rounded-full splash-ring"
        style={{
          width: 260,
          height: 260,
          background:
            'conic-gradient(from 0deg, transparent 0deg, #FFD700 60deg, transparent 120deg, transparent 180deg, #14A94C 240deg, transparent 300deg, transparent 360deg)',
          filter: 'blur(8px)',
          opacity: 0.7,
        }}
      />

      {/* Logo with rise animation */}
      <div className="relative z-10 flex flex-col items-center splash-logo">
        <div className="relative">
          <div
            className="absolute -inset-3 rounded-full blur-2xl"
            style={{ background: 'conic-gradient(from 0deg, #FFD700, #14A94C, #FFD700, #FDE047, #14A94C, #FFD700)', opacity: 0.55 }}
          />
          <img
            src="/lucky-bet-logo.jpg"
            alt="Lucky Bet"
            className="relative w-28 h-28 rounded-full ring-4 ring-[#FFD700]/70 shadow-2xl shadow-black/70"
            draggable="false"
          />
        </div>

        {/* Wordmark */}
        <div className="mt-5 flex items-baseline gap-1.5 splash-wordmark">
          <span
            className="text-4xl font-black tracking-tight"
            style={{
              fontFamily: 'Unbounded, sans-serif',
              backgroundImage: 'linear-gradient(135deg, #FFC700 0%, #FFD700 40%, #FDE047 70%, #FFC700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 12px rgba(255, 215, 0, 0.5))',
            }}
          >
            LUCKY
          </span>
          <span
            className="text-4xl font-black tracking-tight"
            style={{
              fontFamily: 'Unbounded, sans-serif',
              backgroundImage: 'linear-gradient(135deg, #0F9938 0%, #14A94C 40%, #22C55E 70%, #14A94C 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 12px rgba(20, 169, 76, 0.5))',
            }}
          >
            BET
          </span>
        </div>

        {/* Tagline reveal */}
        <p
          className="mt-2 text-[11px] tracking-[0.32em] font-black uppercase splash-tagline"
          style={{ color: '#FFD700', opacity: 0.85 }}
        >
          More Bets · More Wins · More Luck
        </p>

        {/* Progress bar */}
        <div className="mt-6 w-40 h-1 rounded-full overflow-hidden splash-bar"
             style={{ background: 'rgba(255, 215, 0, 0.15)' }}>
          <div
            className="h-full rounded-full splash-bar-fill"
            style={{ background: 'linear-gradient(90deg, #FFD700 0%, #14A94C 100%)' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-fade-out { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }
        @keyframes splash-rise { 0% { opacity: 0; transform: translateY(30px) scale(0.85); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes splash-word-reveal { 0% { opacity: 0; transform: translateY(20px); letter-spacing: 0.2em; } 100% { opacity: 1; transform: translateY(0); letter-spacing: 0; } }
        @keyframes splash-tag-fade { 0%, 30% { opacity: 0; } 100% { opacity: 0.85; } }
        @keyframes splash-ring-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes splash-bar-grow { 0% { width: 0%; } 100% { width: 100%; } }

        .splash-exit { animation: splash-fade-out 0.5s ease forwards; pointer-events: none; }
        .splash-logo { animation: splash-rise 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .splash-wordmark { animation: splash-word-reveal 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both; }
        .splash-tagline { animation: splash-tag-fade 1s ease 0.4s both; }
        .splash-ring { animation: splash-ring-spin 3s linear infinite; }
        .splash-bar-fill { animation: splash-bar-grow 1.4s cubic-bezier(0.4, 0, 0.2, 1) both; }

        @media (prefers-reduced-motion: reduce) {
          .splash-logo, .splash-wordmark, .splash-tagline, .splash-ring, .splash-bar-fill { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
