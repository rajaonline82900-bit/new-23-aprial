import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';
import { 
  Wallet, 
  Trophy, 
  Shield,
  Send,
  Menu,
  Headphones,
  Coins,
  Play,
  Pause
} from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';
import { speak } from '../utils/voice';
import SidebarMenu from '../components/SidebarMenu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [gameCategory, setGameCategory] = useState(() => localStorage.getItem('game_category') || 'gali_disawar');
  const [kalyanResults, setKalyanResults] = useState({});
  const gamesRef = useRef(null);

  // Fetch today's Kalyan results for the dashboard cards
  useEffect(() => {
    if (gameCategory !== 'kalyan') return;
    const fetchKalyan = async () => {
      try {
        const kalyanGames = games.filter(g => g.category === 'kalyan');
        const results = {};
        await Promise.all(kalyanGames.map(async (g) => {
          try {
            const { data } = await axios.get(`${API_URL}/api/kalyan/today/${g.id}`, { withCredentials: true });
            if (data.result) results[g.id] = data.result;
          } catch (e) { /* ignore */ }
        }));
        setKalyanResults(results);
      } catch (e) { console.error(e); }
    };
    fetchKalyan();
    const int = setInterval(fetchKalyan, 30000);
    return () => clearInterval(int);
  }, [gameCategory, games]);


  // Scroll reveal animation for game cards
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('game-card-hidden');
            entry.target.classList.add('game-card-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    const cards = document.querySelectorAll('.game-card-animate');
    cards.forEach((card) => observer.observe(card));
    return () => cards.forEach((card) => observer.unobserve(card));
  }, [games]);

  useEffect(() => {
    fetchGames();
    fetchSettings();
    refreshUser();
    fetchUnreadChat();

    // Auto-refresh games every 30 seconds for live results (especially PWA)
    const interval = setInterval(() => {
      fetchGames(false);
      fetchUnreadChat();
    }, 30000);

    // Also refresh when app comes back to foreground (PWA tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchGames(false);
        refreshUser();
        fetchUnreadChat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUser]);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setTelegramLink(data.telegram_link || '');
      setWhatsappLink(data.whatsapp_link || '');
    } catch (error) {}
  };

  const fetchGames = async (showError = true) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/games`, { withCredentials: true });
      if (data && Array.isArray(data.games)) {
        setGames(data.games);
      }
    } catch (error) {
      // Silent failure - don't show annoying toast. Auto-retry in 30s.
      console.warn('Games fetch failed, will retry:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadChat = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/chat/unread-count`, { withCredentials: true });
      setUnreadChat(data.unread || 0);
    } catch (e) {}
  };


  // Request notification permission on dashboard load
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    
    if (Notification.permission === 'granted') {
      // Already granted - subscribe silently
      navigator.serviceWorker.ready.then((reg) => {
        if (window.subscribePush) window.subscribePush(reg);
      });
    } else if (Notification.permission === 'default') {
      // Show aggressive modal - re-show every 24 hours if not enabled
      const lastSkipped = parseInt(localStorage.getItem('notif_banner_skipped_at') || '0', 10);
      const hoursSinceSkip = (Date.now() - lastSkipped) / (1000 * 60 * 60);
      if (hoursSinceSkip >= 24) {
        // Delay 1.5s for better UX (let dashboard render first)
        setTimeout(() => setShowNotifBanner(true), 1500);
      }
    }
  }, []);

  const handleEnableNotifications = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        if (window.subscribePush) await window.subscribePush(reg);
        toast.success('Notifications चालू हो गई!');
      } else {
        toast.error('Notification permission deny हो गई');
      }
    } catch (e) {
      console.error('Notification enable error:', e);
      toast.error('Notification enable नहीं हो पाई');
    }
    setShowNotifBanner(false);
    localStorage.setItem('notif_banner_dismissed', 'true');
  };

  const dismissNotifBanner = () => {
    setShowNotifBanner(false);
    localStorage.setItem('notif_banner_dismissed', 'true');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getGameStatus = (game) => {
    // Get current IST time
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + (istOffset + now.getTimezoneOffset() * 60 * 1000));
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();

    const [startH, startM] = (game.start_time || '00:00').split(':').map(Number);
    const [endH, endM] = (game.end_time || game.time || '23:59').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Between start_time and end_time → Play (open)
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return { status: 'open', label: 'Play', labelHi: 'खेलें' };
    }
    
    return { status: 'closed', label: 'Time Out', labelHi: 'टाइम आउट' };
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] app-shell relative overflow-hidden">
      {/* Gradient Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0A0A0C]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#D4AF37]/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-900/[0.06] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-blue-900/[0.04] rounded-full blur-[80px]" />
      </div>
      {/* Header - Glass premium */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0A0A0C]/80 border-b border-white/5" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                data-testid="sidebar-toggle"
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <MatkaLogo size="sm" />
            </div>

            <div className="flex items-center gap-2">
              {/* Premium Points Pill */}
              <div
                data-testid="header-balance"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#FDE047] shadow-[0_0_15px_rgba(212,175,55,0.1)]"
              >
                <Coins className="w-3.5 h-3.5" />
                <div className="flex flex-col items-end leading-none">
                  <span className="text-[8px] uppercase tracking-wider text-[#D4AF37]/70 leading-none">Points</span>
                  <span className="text-xs font-bold tabular-nums" data-testid="header-balance-value">
                    ₹{user?.balance?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>

              {user?.role === 'admin' && (
                <Link to="/admin">
                  <button className="p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] hover:bg-[#D4AF37]/20 active:scale-95 transition-all" data-testid="admin-panel-btn">
                    <Shield className="w-4 h-4" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - everything scrolls together */}
      <div className="px-3 pt-[64px] pb-24" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="pt-2">
          {/* Notification popup */}
          {showNotifBanner && (
            <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="notification-enable-modal" style={{maxWidth: '480px', margin: '0 auto'}}>
              <div
                className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #1a1410 0%, #241a12 50%, #1a1410 100%)',
                  border: '2px solid #D4AF37',
                  animation: 'popupEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#D4AF37]/20 to-transparent pointer-events-none" />
                <div className="relative p-6 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FDE047] to-[#D4AF37] flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.5)]">
                    <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className="text-white text-xl font-black mb-2">Notification चालू करो!</h2>
                  <p className="text-gray-300 text-sm mb-1">हर रिजल्ट सबसे पहले पाओ</p>
                  <p className="text-[#D4AF37] text-xs font-bold mb-5">Band app me bhi banner aayega</p>
                  <ul className="text-left text-gray-400 text-xs space-y-2 mb-5 bg-black/30 rounded-xl p-3 border border-white/5">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> रिजल्ट खुलते ही तुरंत notification</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Deposit/Withdraw updates</li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" /> Jeetne par 2x notification</li>
                  </ul>
                  <button
                    onClick={handleEnableNotifications}
                    data-testid="enable-notifications-btn"
                    className="w-full py-3 rounded-xl font-black text-black text-sm tracking-wide transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #FDE047 0%, #D4AF37 100%)',
                      boxShadow: '0 4px 20px rgba(212,175,55,0.4)',
                    }}
                  >
                    हाँ, Notification चालू करो
                  </button>
                  <button
                    onClick={dismissNotifBanner}
                    className="w-full mt-2 py-2 text-gray-500 text-xs hover:text-gray-300 transition-all"
                    data-testid="dismiss-notifications-btn"
                  >
                    बाद में
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            <Link to="/wallet" data-testid="wallet-link">
              <div className="flex flex-col items-center justify-center gap-1.5 bg-[#141418] border border-white/5 rounded-xl p-3 hover:bg-[#1C1C22] hover:border-[#D4AF37]/20 active:scale-95 transition-all">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/15 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <span className="text-gray-300 font-medium text-[10px] tracking-wide">{t('wallet')}</span>
              </div>
            </Link>

            <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
              <div className="flex flex-col items-center justify-center gap-1.5 bg-[#141418] border border-white/5 rounded-xl p-3 hover:bg-[#1C1C22] hover:border-[#0088cc]/30 active:scale-95 transition-all">
                <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 border border-[#0088cc]/15 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#0088cc]" />
                </div>
                <span className="text-gray-300 font-medium text-[10px] tracking-wide">{t('telegram')}</span>
              </div>
            </a>

            <Link to="/chat" data-testid="chat-quick-link">
              <div className="flex flex-col items-center justify-center gap-1.5 bg-[#141418] border border-white/5 rounded-xl p-3 hover:bg-[#1C1C22] hover:border-[#D4AF37]/20 active:scale-95 transition-all relative">
                <div className="relative w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/15 flex items-center justify-center">
                  <Headphones className="w-4 h-4 text-[#D4AF37]" />
                  {unreadChat > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center shadow-md" data-testid="chat-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
                  )}
                </div>
                <span className="text-gray-300 font-medium text-[10px] tracking-wide">{t('chat')}</span>
              </div>
            </Link>

            <Link to="/results" data-testid="results-link">
              <div className="flex flex-col items-center justify-center gap-1.5 bg-[#141418] border border-white/5 rounded-xl p-3 hover:bg-[#1C1C22] hover:border-purple-500/30 active:scale-95 transition-all">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/15 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-gray-300 font-medium text-[10px] tracking-wide">{t('results')}</span>
              </div>
            </Link>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FDE047] to-[#D4AF37]"></span>
              <h3 className="text-lg font-bold text-white tracking-tight">Market</h3>
            </div>
            <span className="bg-white/5 border border-white/10 text-gray-300 text-[10px] px-2.5 py-1 rounded-md font-medium tracking-wide" data-testid="games-count">
              {games.length} Available
            </span>
          </div>

          {/* Games list (scrolls with page) */}
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-[#141418] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {games.map((game, index) => {
                const gameStatus = getGameStatus(game);
                const isDisabled = game.is_holiday || gameStatus.status !== 'open';
                const CardWrapper = isDisabled ? 'div' : Link;
                const cardProps = isDisabled 
                  ? { key: game.id, 'data-testid': `game-card-${game.id}` }
                  : { key: game.id, to: (game.category === 'kalyan' ? `/kalyan/${game.id}` : `/game/${game.id}`), 'data-testid': `game-card-${game.id}` };

                // Kalyan - Anna Matka style card
                if (game.category === 'kalyan') {
                  const kr = kalyanResults[game.id] || {};
                  const formatTime = (t) => {
                    const [h, m] = (t || '00:00').split(':').map(Number);
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${h12}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
                  };
                  return (
                    <CardWrapper {...cardProps}>
                      <div
                        className={`game-card-animate game-card-hidden rounded-2xl overflow-hidden shadow-lg border-2 transition-all ${isDisabled ? 'opacity-60' : ''}`}
                        style={{ borderColor: '#D4AF37', animationDelay: `${index * 0.08}s` }}
                      >
                        {/* Orange header with game name + play button */}
                        <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8941E] px-4 py-3 flex items-center justify-between">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2m0 4h2v-2H3v2m0-8h2V7H3v2m4 4h14v-2H7v2m0 4h14v-2H7v2M7 7v2h14V7H7Z"/></svg>
                          </div>
                          <h3 className="text-white font-black text-base uppercase tracking-wide flex-1 text-center">
                            {game.name}
                          </h3>
                          {game.is_holiday ? (
                            <div className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">H</div>
                          ) : gameStatus.status === 'open' ? (
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg" data-testid={`play-btn-${game.id}`}>
                              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-red-500/80 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            </div>
                          )}
                        </div>

                        {/* White body */}
                        <div className="bg-white px-4 py-3">
                          <div className="flex justify-between text-xs text-gray-600 mb-2">
                            <span>Open - {formatTime(game.start_time)}</span>
                            <span>Close - {formatTime(game.end_time)}</span>
                          </div>
                          <div className="grid grid-cols-3 text-center">
                            <div>
                              <p className="text-green-600 font-bold text-base mb-1">Open</p>
                              <p className="text-black font-black text-lg tracking-wider" style={{ fontFamily: 'monospace' }}>
                                {kr.open_panna || 'XXX'}
                              </p>
                            </div>
                            <div>
                              <p className="text-blue-500 font-bold text-base mb-1">Jodi</p>
                              <p className="text-black font-black text-lg tracking-wider" style={{ fontFamily: 'monospace' }}>
                                {kr.jodi || (kr.open_ank ? `${kr.open_ank}*` : '--')}
                              </p>
                            </div>
                            <div>
                              <p className="text-red-500 font-bold text-base mb-1">Close</p>
                              <p className="text-black font-black text-lg tracking-wider" style={{ fontFamily: 'monospace' }}>
                                {kr.close_panna || 'XXX'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status strip */}
                        <div className={`py-2 text-center font-black text-sm text-white ${
                          game.is_holiday ? 'bg-orange-500' : gameStatus.status === 'open' ? 'bg-green-600' : 'bg-red-600'
                        }`}>
                          {game.is_holiday ? 'HOLIDAY' : gameStatus.status === 'open' ? 'MARKET OPENED' : 'MARKET CLOSED'}
                        </div>
                      </div>
                    </CardWrapper>
                  );
                }

                // Gali/Disawar - premium horizontal card
                const statusLabel = game.is_holiday ? 'Holiday' : (gameStatus.status === 'open' ? 'Running' : 'Closed');
                const formattedTime = (() => {
                  const [h, m] = (game.end_time || '00:00').split(':').map(Number);
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const h12 = h % 12 || 12;
                  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                })();
                return (
                  <CardWrapper {...cardProps}>
                    <div
                      className={`game-card-animate game-card-hidden bg-[#141418] border rounded-2xl p-3.5 transition-all ${
                        isDisabled
                          ? 'border-white/5 opacity-85 cursor-not-allowed'
                          : 'border-white/5 hover:border-[#D4AF37]/30 hover:bg-[#1C1C22] active:scale-[0.99] cursor-pointer'
                      }`}
                      style={{ animationDelay: `${index * 0.06}s` }}
                    >
                      {/* Top row: Last Time pill (left) + Hindi Name (center) */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                          <span className="text-[10px] font-medium text-gray-300 tabular-nums leading-none">{formattedTime}</span>
                        </div>
                        <h4 className="text-base font-bold text-[#FDE047] tracking-tight truncate" style={{ fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif' }}>{game.name_hi}</h4>
                        <div className="w-[80px]" /> {/* spacer */}
                      </div>

                      {/* Bottom row: Yesterday | Today | Status icon */}
                      <div className="flex items-center gap-2">
                        {/* Yesterday */}
                        <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg py-1.5 px-2 flex flex-col items-center justify-center" data-testid={`yesterday-result-${game.id}`}>
                          <span className="text-[8px] uppercase tracking-widest text-red-400/70 leading-none font-semibold">Yesterday</span>
                          <span className="text-red-400 font-bold text-base leading-tight tabular-nums mt-0.5" style={{ fontFamily: 'Outfit, monospace' }}>
                            {game.yesterday_result?.jodi || '--'}
                          </span>
                        </div>

                        {/* Today */}
                        <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg py-1.5 px-2 flex flex-col items-center justify-center relative" data-testid={`today-result-${game.id}`}>
                          {gameStatus.status === 'open' && (
                            <span className="absolute -top-1.5 right-1.5 bg-red-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-sm uppercase tracking-wider live-blink shadow-md leading-none">Live</span>
                          )}
                          <span className="text-[8px] uppercase tracking-widest text-green-400/70 leading-none font-semibold">Today</span>
                          <span className="text-green-400 font-bold text-base leading-tight tabular-nums mt-0.5" style={{ fontFamily: 'Outfit, monospace' }}>
                            {game.today_result?.jodi || '--'}
                          </span>
                        </div>

                        {/* Status Icon */}
                        <div className="flex flex-col items-center gap-1 w-[60px] flex-shrink-0" data-testid={`play-status-${game.id}`}>
                          {game.is_holiday ? (
                            <div className="w-10 h-10 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center" data-testid={`holiday-btn-${game.id}`}>
                              <span className="text-orange-400 font-black text-sm">H</span>
                            </div>
                          ) : gameStatus.status === 'open' ? (
                            <div
                              className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-[0_0_18px_rgba(34,197,94,0.45)] cursor-pointer ring-2 ring-green-400/30"
                              onClick={() => speak('प्ले')}
                              data-testid={`play-btn-${game.id}`}
                            >
                              <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center" data-testid={`timeout-btn-${game.id}`} onClick={() => speak('टाइम आउट')}>
                              <Pause className="w-3.5 h-3.5 text-red-400" fill="currentColor" />
                            </div>
                          )}
                          <span className={`text-[9px] font-bold tracking-wide uppercase leading-none ${
                            game.is_holiday ? 'text-orange-400' : gameStatus.status === 'open' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardWrapper>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <SidebarMenu open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <FooterNav />
    </div>
  );
};

export default DashboardPage;
