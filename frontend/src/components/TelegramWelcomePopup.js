import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Welcome popup that shows the Telegram channel join CTA every time the app
 * is freshly opened (i.e. once per page load / fresh app launch). It uses
 * sessionStorage so closing the popup remembers it for the current session
 * only — reopening the app shows it again.
 */
const TelegramWelcomePopup = ({ telegramLink }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Show after a short delay so the dashboard renders first
    const shown = sessionStorage.getItem('telegram_welcome_shown');
    if (!shown) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem('telegram_welcome_shown', '1');
    setOpen(false);
  };

  const handleJoin = () => {
    if (telegramLink) {
      window.open(telegramLink, '_blank', 'noopener,noreferrer');
    }
    handleClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="telegram-welcome-modal"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #0F1A2E 0%, #1A2845 50%, #0B1426 100%)',
          border: '2px solid #38BDF8',
          boxShadow: '0 20px 60px rgba(56, 189, 248, 0.35), 0 0 80px rgba(56, 189, 248, 0.25)',
          animation: 'popupEnter 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          data-testid="telegram-welcome-close"
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-all border border-white/20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Glow accent */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#38BDF8]/25 to-transparent pointer-events-none" />

        <div className="relative p-6 pt-7 text-center">
          {/* Authentic Telegram logo */}
          <div
            className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
              boxShadow: '0 8px 28px rgba(42, 171, 238, 0.55), 0 0 0 4px rgba(56, 189, 248, 0.15)',
              animation: 'goldGlowPulse 2.6s ease-in-out infinite',
            }}
          >
            <svg viewBox="0 0 240 240" className="w-11 h-11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M186.054 71.196 158.5 200.952c-2.08 9.184-7.512 11.464-15.232 7.144l-42.064-31-20.296 19.528c-2.248 2.248-4.128 4.128-8.456 4.128l3.024-42.864 78.04-70.504c3.392-3.024-.736-4.704-5.272-1.68L52.74 138.504l-41.512-12.984c-9.024-2.816-9.184-9.024 1.88-13.36L174.5 60.876c7.512-2.816 14.08 1.68 11.554 10.32Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>

          <h2 className="text-white text-2xl font-black mb-1 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Join our Telegram!
          </h2>
          <p className="text-[#7DD3FC] text-sm font-bold mb-5" style={{ fontFamily: 'Outfit, sans-serif' }}>
            हमारे टेलीग्राम चैनल से जुड़ें
          </p>

          <div
            className="rounded-2xl p-4 mb-5 text-left"
            style={{
              background: 'rgba(8, 16, 32, 0.55)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <p className="text-white text-[13px] leading-relaxed mb-2 font-medium" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
              सभी भाई हमारे टेलीग्राम चैनल से जरूर जुड़ें। आपको हमारे App का{' '}
              <span className="text-[#7DD3FC] font-bold">Withdrawal Proof</span> टेलीग्राम चैनल में मिलेगा।
            </p>
            <div className="h-px bg-gradient-to-r from-transparent via-[#38BDF8]/30 to-transparent my-2" />
            <p className="text-gray-300 text-[12px] leading-relaxed">
              All members must join our Telegram channel. You will get our App's{' '}
              <span className="text-[#7DD3FC] font-bold">Withdrawal Proof</span> in the Telegram channel.
            </p>
          </div>

          <button
            onClick={handleJoin}
            data-testid="telegram-welcome-join-btn"
            className="w-full py-3.5 rounded-2xl font-black text-white text-base tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
              boxShadow: '0 6px 22px rgba(42, 171, 238, 0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            <svg viewBox="0 0 240 240" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M186.054 71.196 158.5 200.952c-2.08 9.184-7.512 11.464-15.232 7.144l-42.064-31-20.296 19.528c-2.248 2.248-4.128 4.128-8.456 4.128l3.024-42.864 78.04-70.504c3.392-3.024-.736-4.704-5.272-1.68L52.74 138.504l-41.512-12.984c-9.024-2.816-9.184-9.024 1.88-13.36L174.5 60.876c7.512-2.816 14.08 1.68 11.554 10.32Z"
                fill="#FFFFFF"
              />
            </svg>
            Join Telegram Channel
          </button>

          <button
            onClick={handleClose}
            className="w-full mt-2 py-2 text-gray-400 text-xs hover:text-white transition-all"
            data-testid="telegram-welcome-skip"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramWelcomePopup;
