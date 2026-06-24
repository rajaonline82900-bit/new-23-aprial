import React from 'react';

/**
 * Icon-only premium "M11" badge. No text wordmark.
 * Shape: rounded squircle with layered gold gradient, inner highlight,
 * outer glow, and a bold "M11" mark. Sized via size="sm|md|lg".
 */
const MatkaLogo = ({ size = 'md' }) => {
  const sizes = {
    sm: { wrap: 'w-9 h-9', text: 'text-[11px]', m: 'text-[13px]', n: 'text-[10px]' },
    md: { wrap: 'w-11 h-11', text: 'text-sm', m: 'text-base', n: 'text-xs' },
    lg: { wrap: 'w-14 h-14', text: 'text-base', m: 'text-xl', n: 'text-sm' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div
      className={`${s.wrap} relative shrink-0 select-none`}
      data-testid="matka-logo"
      aria-label="M11"
    >
      {/* Outer ambient glow */}
      <div
        className="absolute inset-0 rounded-[14px] blur-md opacity-70"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,215,0,0.55) 0%, rgba(212,175,55,0.25) 50%, transparent 75%)',
        }}
      />
      {/* Gold base */}
      <div
        className="absolute inset-0 rounded-[14px]"
        style={{
          background:
            'linear-gradient(135deg, #FFD700 0%, #FDE047 25%, #D4AF37 60%, #B8860B 100%)',
          boxShadow:
            '0 6px 16px rgba(212, 175, 55, 0.55), inset 0 1.5px 0 rgba(255, 255, 255, 0.55), inset 0 -2px 4px rgba(120, 80, 0, 0.4)',
          border: '1px solid rgba(255, 215, 0, 0.9)',
        }}
      />
      {/* Inner top glossy highlight */}
      <div
        className="absolute inset-x-1 top-1 h-1/2 rounded-t-[12px] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 60%, transparent 100%)',
        }}
      />
      {/* M11 wordmark — packed tight inside the badge */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`flex items-baseline gap-[1px] font-black tracking-tighter ${s.text}`}
          style={{
            fontFamily: "'Unbounded', 'Outfit', sans-serif",
            color: '#1A0F00',
            textShadow:
              '0 1px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(0,0,0,0.25)',
            letterSpacing: '-0.04em',
          }}
        >
          <span className={s.m} style={{ lineHeight: 1 }}>
            M
          </span>
          <span className={s.n} style={{ lineHeight: 1 }}>
            11
          </span>
        </div>
      </div>
    </div>
  );
};

export default MatkaLogo;
