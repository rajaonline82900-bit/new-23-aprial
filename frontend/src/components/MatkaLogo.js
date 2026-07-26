import React from 'react';

// LUCKY BET brand logo — uses the uploaded logo image with a golden glow ring.
// Component name preserved as "MatkaLogo" for backwards compat (imported everywhere).
const MatkaLogo = ({ size = 'md', showText = true }) => {
  const sizes = {
    sm: { icon: 'w-8 h-8', gap: 'gap-1.5', text: 'text-sm', accent: 'text-sm' },
    md: { icon: 'w-11 h-11', gap: 'gap-2', text: 'text-lg', accent: 'text-lg' },
    lg: { icon: 'w-16 h-16', gap: 'gap-2.5', text: 'text-2xl', accent: 'text-2xl' },
    xl: { icon: 'w-24 h-24', gap: 'gap-3', text: 'text-3xl', accent: 'text-3xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${s.gap}`} data-testid="matka-logo">
      <div className="relative">
        {/* Soft dual glow — gold + emerald (matches Lucky Bet palette) */}
        <div className="absolute -inset-2 rounded-full blur-xl opacity-70"
             style={{ background: 'conic-gradient(from 0deg, #FFD700, #14A94C, #FFD700, #FDE047, #14A94C, #FFD700)' }} />
        <img
          src="/lucky-bet-logo.jpg"
          alt="Lucky Bet"
          className={`relative ${s.icon} rounded-full object-cover ring-2 ring-[#FFD700]/70 shadow-2xl shadow-black/60`}
          draggable="false"
        />
      </div>
      {showText && (
        <div className="flex items-baseline gap-1 leading-none">
          <span className={`${s.text} font-black font-['Unbounded'] tracking-tight drop-shadow-lg`}
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFC700 0%, #FFD700 40%, #FDE047 70%, #FFC700 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
            LUCKY
          </span>
          <span className={`${s.accent} font-black font-['Unbounded'] tracking-tight drop-shadow-lg`}
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0F9938 0%, #14A94C 40%, #22C55E 70%, #14A94C 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
            BET
          </span>
        </div>
      )}
    </div>
  );
};

export default MatkaLogo;
