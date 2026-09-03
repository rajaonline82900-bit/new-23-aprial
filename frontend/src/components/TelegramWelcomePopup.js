import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Download, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const APK_URL = '/shivshakti.apk';
// Android package name used by the WebView APK (for intent:// deep link).
// This must match the APK's AndroidManifest package — kept conservative.
const APK_PACKAGE = 'com.matka11.app';

/**
 * Welcome popup shown on every fresh app open.
 * - Telegram CTA (Join channel)
 * - Download APK CTA
 * - When user is logged-in, also offers an "Auto-Login Link" so the APK
 *   launches already signed-in (via /auth/create-apk-handoff token + ?ah= URL param).
 */
const TelegramWelcomePopup = ({ telegramLink, isLoggedIn = false }) => {
  const [open, setOpen] = useState(false);
  const [creatingHandoff, setCreatingHandoff] = useState(false);
  const [handoffData, setHandoffData] = useState(null); // { handoff_token, intent_url, web_url }

  useEffect(() => {
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
  };

  const handleDownload = async () => {
    // Start the APK download in a new tab/window so the user stays on the popup
    window.open(APK_URL, '_blank', 'noopener');
    // If logged in, also generate an auto-login handoff so they can be
    // signed in automatically when they open the APK after install.
    if (!isLoggedIn || creatingHandoff || handoffData) return;
    try {
      setCreatingHandoff(true);
      const { data } = await axios.post(
        `${API_URL}/api/auth/create-apk-handoff`,
        {},
        { withCredentials: true },
      );
      const token = data?.handoff_token;
      if (token) {
        const webUrl = `${window.location.origin}/?ah=${encodeURIComponent(token)}`;
        // Android intent URL that opens the installed APK with the auto-login URL
        const host = window.location.host;
        const intentUrl = `intent://${host}/?ah=${encodeURIComponent(
          token,
        )}#Intent;scheme=https;package=${APK_PACKAGE};S.browser_fallback_url=${encodeURIComponent(
          webUrl,
        )};end`;
        setHandoffData({ handoff_token: token, intent_url: intentUrl, web_url: webUrl });
      }
    } catch (e) {
      console.warn('Could not create APK auto-login handoff:', e?.message);
    } finally {
      setCreatingHandoff(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid="telegram-welcome-modal"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
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
          {/* Telegram logo */}
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
          <p className="text-[#7DD3FC] text-sm font-bold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            हमारे टेलीग्राम चैनल से जुड़ें
          </p>

          <div
            className="rounded-2xl p-4 mb-4 text-left"
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

          {/* CTA: Join Telegram */}
          <button
            onClick={handleJoin}
            data-testid="telegram-welcome-join-btn"
            className="w-full py-3 rounded-2xl font-black text-white text-base tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 mb-3"
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

          {/* CTA: Download Shiv Shakti Club APK */}
          <button
            onClick={handleDownload}
            data-testid="telegram-welcome-download-apk-btn"
            disabled={creatingHandoff}
            className="w-full py-3 rounded-2xl font-black text-[#1A0F00] text-base tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FDE047 35%, #D4AF37 70%, #B8860B 100%)',
              boxShadow: '0 6px 22px rgba(212, 175, 55, 0.55), inset 0 1px 0 rgba(255,255,255,0.45)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {creatingHandoff ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" strokeWidth={2.6} />}
            Download Shiv Shakti Club App
          </button>

          {/* Auto-login intent link (only shown if logged-in user has a handoff token) */}
          {handoffData?.intent_url && (
            <div
              className="mt-3 rounded-xl p-3 text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.06) 100%)',
                border: '1px solid rgba(212, 175, 55, 0.35)',
              }}
              data-testid="apk-autologin-block"
            >
              <p className="text-[11px] text-[#FDE047] font-bold leading-tight mb-2">
                ✨ App install hone ke baad ye link dabaiye — auto-login ho jayega:
              </p>
              <a
                href={handoffData.intent_url}
                data-testid="apk-autologin-link"
                className="inline-block w-full text-center py-2 rounded-lg font-black text-[12px] text-[#1A0F00]"
                style={{
                  background: 'linear-gradient(135deg, #FDE047 0%, #FFD700 100%)',
                  boxShadow: '0 3px 12px rgba(212, 175, 55, 0.4)',
                }}
              >
                Open Shiv Shakti Club App with Auto-Login →
              </a>
              <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">
                Valid for 10 minutes. Works only on Android after installing the APK.
              </p>
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full mt-3 py-2 text-gray-400 text-xs hover:text-white transition-all"
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
