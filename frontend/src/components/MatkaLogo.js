import React from 'react';

const MatkaLogo = ({ size = 'md' }) => {
  const sizes = {
    sm: { container: 'gap-1.5', icon: 'w-7 h-7 text-xs', text: 'text-base', eleven: 'text-lg' },
    md: { container: 'gap-2', icon: 'w-9 h-9 text-sm', text: 'text-lg', eleven: 'text-xl' },
    lg: { container: 'gap-2.5', icon: 'w-12 h-12 text-base', text: 'text-2xl', eleven: 'text-3xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${s.container}`} data-testid="matka-logo">
      <div className={`${s.icon} rounded-lg bg-gradient-to-br from-[#D4AF37] via-[#FDE047] to-[#D4AF37] flex items-center justify-center font-black font-['Unbounded'] text-black shadow-lg shadow-[#D4AF37]/30`}>
        M
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className={`${s.text} font-black font-['Unbounded'] tracking-tight bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] bg-clip-text text-transparent drop-shadow-lg`}>
          MATKA
        </span>
        <span className={`${s.eleven} font-black font-['Unbounded'] tracking-tighter text-white drop-shadow-lg`}>
          11
        </span>
      </div>
    </div>
  );
};

export default MatkaLogo;
