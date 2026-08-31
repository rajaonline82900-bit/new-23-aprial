import React, { useEffect, useState } from 'react';

/**
 * Shiv Shakti Club entrance splash screen — simple logo reveal, no progress bar / rotating dots.
 * Auto-dismisses after ~1.4s.
 */
const SplashScreen = ({ onDone }) => {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 1200);
    const t2 = setTimeout(() => {
      setPhase('gone');
      onDone && onDone();
    }, 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ${phase === 'exit' ? 'splash-exit' : ''}`}
      style={{ background: '#000000' }}
      data-testid="splash-screen"
    >
      <style>{`
        @keyframes ssPop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes ssGlow { 0%,100% { filter: drop-shadow(0 0 24px rgba(255,215,0,0.5)) drop-shadow(0 0 60px rgba(255,215,0,0.3)) } 50% { filter: drop-shadow(0 0 48px rgba(255,215,0,0.85)) drop-shadow(0 0 100px rgba(255,215,0,0.5)) } }
        .ss-logo { animation: ssPop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both, ssGlow 2.4s ease-in-out 0.6s infinite }
        .splash-exit { transition: opacity 0.5s ease-out; opacity: 0 }
      `}</style>
      <img
        src="/shivshakti-logo.jpg"
        alt="Shiv Shakti Club"
        className="ss-logo"
        style={{ width: 260, height: 260, borderRadius: '50%', objectFit: 'cover' }}
      />
    </div>
  );
};

export default SplashScreen;
