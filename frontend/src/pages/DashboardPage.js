import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';
import { 
  Wallet, 
  Shield,
  Menu,
  Play,
  X,
  HandCoins,
  BanknoteArrowUp,
  BarChart3,
  Crown
} from 'lucide-react';
import FooterNav from '../components/FooterNav';
import { speak } from '../utils/voice';
import SidebarMenu from '../components/SidebarMenu';
import GameHistoryModal from '../components/GameHistoryModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [gameCategory, setGameCategory] = useState(() => localStorage.getItem('game_category') || 'gali_disawar');
  const [kalyanResults, setKalyanResults] = useState({});
  const [historyGame, setHistoryGame] = useState(null);
  const [topWinner, setTopWinner] = useState(null);
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
    const int = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchKalyan();
    }, 60000);
    return () => clearInterval(int);
  }, [gameCategory, games]);


  useEffect(() => {
    fetchGames();
    fetchSettings();
    fetchTopWinner();
    refreshUser();
    fetchUnreadChat();

    // Auto-refresh games every 60 seconds — but ONLY when tab is visible.
    // This eliminates background work when APK is backgrounded or screen off,
    // a major battery + perf win on low-end Android devices.
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchGames(false);
      fetchUnreadChat();
    }, 60000);

    // Refresh top winner less frequently (every 5 min) to save bandwidth
    const winnerInt = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchTopWinner();
    }, 5 * 60 * 1000);

    // Also refresh when app comes back to foreground (PWA tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchGames(false);
        refreshUser();
        fetchUnreadChat();
        fetchTopWinner();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      clearInterval(winnerInt);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUser]);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setTelegramLink(data.telegram_link || '');
      setWhatsappLink(data.whatsapp_link || '');
      setWhatsappNumber(data.whatsapp_number || '');
    } catch (error) {}
  };

  const fetchTopWinner = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/winners/top?limit=1`, { withCredentials: true });
      if (data && Array.isArray(data.winners) && data.winners.length > 0) {
        setTopWinner({ ...data.winners[0], date: data.date });
      } else {
        setTopWinner(null);
      }
    } catch (e) {
      setTopWinner(null);
    }
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


  // Subscribe to push notifications silently if permission already granted (no popup)
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) => {
        if (window.subscribePush) window.subscribePush(reg);
      });
    }
  }, []);

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

    // Cross-midnight wrap-around (e.g., Disawar 07:00 -> 04:00 next day)
    const isOpen = endMinutes < startMinutes
      ? (currentMinutes >= startMinutes || currentMinutes <= endMinutes)
      : (currentMinutes >= startMinutes && currentMinutes <= endMinutes);

    if (isOpen) {
      return { status: 'open', label: 'Play', labelHi: 'खेलें' };
    }
    
    return { status: 'closed', label: 'Time Out', labelHi: 'टाइम आउट' };
  };

  return (
    <div
      className="min-h-screen app-shell relative overflow-hidden"
      style={{
        background: '#0F0420',
      }}
    >
      {/* Background animation handled by parent div backgroundImage — no separate layers needed.
          This eliminates compositor overhead from 5 absolute-positioned animated DIVs. */}

      {/* Header - Royal black with gold gradient bottom edge */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          background: '#0A0A14',
          borderBottom: '2px solid #D4AF37',
        }}
      >
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.25)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                data-testid="sidebar-toggle"
                className="p-2 rounded-lg text-[#FFD700] hover:bg-[#D4AF37]/10 active:scale-95 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <MatkaLogo size="sm" />
            </div>

            <div className="flex items-center gap-2">
              {/* Premium Gold Wallet Balance Pill - STATIC (no glow keyframe, no textShadow → 0 repaint) */}
              <Link
                to="/wallet"
                data-testid="header-balance"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.14) 0%, rgba(212, 175, 55, 0.22) 100%)',
                  border: '1px solid rgba(212, 175, 55, 0.6)',
                }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)' }}>
                  <Wallet className="w-3.5 h-3.5 text-[#1A1A2E]" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-black tabular-nums text-[#FFD700] leading-none" data-testid="header-balance-value">
                  ₹{user?.balance?.toFixed(2) || '0.00'}
                </span>
              </Link>

              {user?.role === 'admin' && (
                <a
                  href={`/admin?_t=${Date.now()}`}
                  data-testid="admin-panel-link"
                  onClick={(e) => {
                    // Use a full-page navigation so the WebView/browser always
                    // re-evaluates the SPA bundle (fixes "purana admin first
                    // load, refresh par naya" cache bug).
                    e.preventDefault();
                    window.location.href = `/admin?_t=${Date.now()}`;
                  }}
                >
                  <button className="p-2 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#FFD700] hover:bg-[#D4AF37]/25 active:scale-95 transition-all" data-testid="admin-panel-btn">
                    <Shield className="w-4 h-4" />
                  </button>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - everything scrolls together */}
      <div className="px-3 pt-[64px] pb-24" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="pt-2">
          {/* AAJ KA VIJETA - static premium winner card (no animations, scroll-safe) */}
          {topWinner && (
            <div
              className="rounded-2xl p-3 mb-4 flex items-center gap-3"
              style={{
                background: 'linear-gradient(135deg, #1A1505 0%, #16162A 70%)',
                border: '2px solid #D4AF37',
                contain: 'content',
              }}
              data-testid="top-winner-card"
            >
              {/* Crown badge */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 60%, #B8860B 100%)',
                  border: '2px solid #FFD700',
                }}
              >
                <Crown className="w-6 h-6 text-[#1A0F00]" strokeWidth={2.5} fill="#1A0F00" />
              </div>

              {/* Winner info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-[#1A0F00]"
                    style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)' }}
                  >
                    आज का विजेता
                  </span>
                  <span className="text-[10px] text-[#86EFAC] font-bold truncate" data-testid="top-winner-game">
                    {topWinner.game_name_hi}
                  </span>
                </div>
                <div className="text-white text-sm font-bold truncate" data-testid="top-winner-name">
                  <span className="text-[#FFD700]">{topWinner.name}</span>
                  <span className="text-gray-400 text-[11px] ml-1.5">({topWinner.phone})</span>
                </div>
              </div>

              {/* Payout amount */}
              <div className="text-right flex-shrink-0">
                <div className="text-[8px] uppercase tracking-widest text-gray-400 font-black leading-none">जीते</div>
                <div
                  className="text-xl font-black tabular-nums leading-tight mt-0.5"
                  style={{ color: '#FFD700', fontFamily: 'Outfit, monospace' }}
                  data-testid="top-winner-amount"
                >
                  ₹{topWinner.won_amount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions - Deposit / Withdrawal / Telegram / WhatsApp (lightweight, scroll-safe) */}
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            {/* DEPOSIT */}
            <Link to="/wallet?action=deposit" data-testid="deposit-quick-link">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #34D399 0%, #10B981 50%, #047857 100%)' }}>
                  <HandCoins className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Deposit</span>
              </div>
            </Link>

            {/* WITHDRAWAL */}
            <Link to="/wallet?action=withdraw" data-testid="withdraw-quick-link">
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FB923C 0%, #F97316 50%, #C2410C 100%)' }}>
                  <BanknoteArrowUp className="w-6 h-6 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Withdraw</span>
              </div>
            </Link>

            {/* TELEGRAM */}
            <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)' }}>
                  <svg viewBox="0 0 240 240" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M186.054 71.196 158.5 200.952c-2.08 9.184-7.512 11.464-15.232 7.144l-42.064-31-20.296 19.528c-2.248 2.248-4.128 4.128-8.456 4.128l3.024-42.864 78.04-70.504c3.392-3.024-.736-4.704-5.272-1.68L52.74 138.504l-41.512-12.984c-9.024-2.816-9.184-9.024 1.88-13.36L174.5 60.876c7.512-2.816 14.08 1.68 11.554 10.32Z" fill="#FFFFFF" />
                  </svg>
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">Telegram</span>
              </div>
            </a>

            {/* WHATSAPP */}
            {(() => {
              const cleanNum = (whatsappNumber || '').replace(/[^0-9]/g, '');
              const waHref = cleanNum ? `https://wa.me/${cleanNum}` : (whatsappLink || '#');
              const waDisabled = !cleanNum && !whatsappLink;
              return (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="whatsapp-quick-link"
              onClick={(e) => { if (waDisabled) e.preventDefault(); }}
            >
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 active:scale-95 relative"
                style={{ background: '#16162A', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#FFFFFF" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  {unreadChat > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center border border-[#1A1A2E]" data-testid="chat-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
                  )}
                </div>
                <span className="text-[#FFD700] font-bold text-[10px] tracking-wide">WhatsApp</span>
              </div>
            </a>
              );
            })()}
          </div>

          {/* Section Header - gold premium (no text-shadow, no expensive paint) */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)' }}></span>
              <h3 className="text-xl font-black tracking-tight" style={{ color: '#FFFFFF' }}>Market</h3>
            </div>
            <span className="text-[#1A1A2E] text-[11px] px-3 py-1 rounded-full font-black tracking-wide" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)' }} data-testid="games-count">
              {games.length} Available
            </span>
          </div>

          {/* Games list */}
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white/70 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {games.map((game, index) => {
                const gameStatus = getGameStatus(game);
                const isDisabled = game.is_holiday || gameStatus.status !== 'open';
                const CardWrapper = isDisabled ? 'div' : Link;
                const cardProps = isDisabled 
                  ? { 'data-testid': `game-card-${game.id}` }
                  : { to: (game.category === 'kalyan' ? `/kalyan/${game.id}` : `/game/${game.id}`), 'data-testid': `game-card-${game.id}` };

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
                    <CardWrapper key={game.id} {...cardProps}>
                      <div
                        className={`rounded-2xl overflow-hidden border-2 ${isDisabled ? 'opacity-60' : ''}`}
                        style={{ borderColor: '#D4AF37', contain: 'content' }}
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
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center" data-testid={`play-btn-${game.id}`}>
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

                // Premium gold-themed game card
                const statusLabel = game.is_holiday ? 'Holiday' : (gameStatus.status === 'open' ? 'Running' : 'Closed');
                const fmt = (timeStr) => {
                  const [h, m] = (timeStr || '00:00').split(':').map(Number);
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const h12 = h % 12 || 12;
                  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                };
                const openTimeStr = fmt(game.start_time);
                const closeTimeStr = fmt(game.end_time);
                return (
                  <CardWrapper key={game.id} {...cardProps}>
                    <div
                      className={`rounded-2xl p-3.5 relative overflow-hidden ${
                        isDisabled ? 'opacity-90 cursor-not-allowed' : 'active:scale-[0.99] cursor-pointer'
                      }`}
                      style={{
                        background: '#16162A',
                        border: '2px solid #D4AF37',
                        contain: 'content',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* LEFT: Game Name + Yesterday/Today */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHistoryGame(game);
                              }}
                              data-testid={`chart-btn-${game.id}`}
                              aria-label={`${game.name_hi} result chart`}
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90"
                              style={{
                                background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 50%, #B8860B 100%)',
                                border: '1.5px solid #FFD700',
                              }}
                            >
                              <BarChart3 className="w-4 h-4 text-[#1A1A2E]" strokeWidth={2.8} />
                            </button>
                            <h4
                              className="text-lg font-black tracking-tight truncate"
                              style={{
                                color: '#FFD700',
                                fontFamily: 'Outfit, Noto Sans Devanagari, sans-serif',
                              }}
                              data-testid={`game-name-${game.id}`}
                            >
                              {game.name_hi}
                            </h4>
                          </div>

                          <div className="flex gap-2">
                            {/* Yesterday - solid purple, no shadows */}
                            <div
                              className="flex-1 rounded-xl py-1.5 px-2 flex flex-col items-center justify-center"
                              style={{
                                background: '#6D28D9',
                                border: '1px solid rgba(196, 181, 253, 0.4)',
                              }}
                              data-testid={`yesterday-result-${game.id}`}
                            >
                              <span className="text-[8px] uppercase tracking-widest text-white/90 leading-none font-bold">Yesterday</span>
                              <span className="text-white font-black text-base leading-tight tabular-nums mt-0.5" style={{ fontFamily: 'Outfit, monospace' }}>
                                {game.yesterday_result?.jodi || '--'}
                              </span>
                            </div>

                            {/* Today - solid cyan, no shadows, no live-blink */}
                            <div
                              className="flex-1 rounded-xl py-1.5 px-2 flex flex-col items-center justify-center relative"
                              style={{
                                background: '#0E7490',
                                border: '1px solid rgba(125, 211, 252, 0.4)',
                              }}
                              data-testid={`today-result-${game.id}`}
                            >
                              {gameStatus.status === 'open' && (
                                <span className="absolute -top-1.5 right-1.5 bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider leading-none">Live</span>
                              )}
                              <span className="text-[8px] uppercase tracking-widest text-white/90 leading-none font-bold">Today</span>
                              <span className="text-white font-black text-base leading-tight tabular-nums mt-0.5" style={{ fontFamily: 'Outfit, monospace' }}>
                                {game.today_result?.jodi || '--'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Open/Close pills + Play button + Status */}
                        <div className="flex flex-col items-stretch gap-1 w-[82px] flex-shrink-0" data-testid={`play-status-${game.id}`}>
                          {/* Open Time pill */}
                          <div className="flex items-center justify-between px-2 py-0.5 rounded-md" style={{ background: 'rgba(34, 197, 94, 0.18)', border: '1px solid rgba(74, 222, 128, 0.35)' }}>
                            <span className="text-[7px] uppercase tracking-wider text-[#86EFAC] font-black leading-none">Open</span>
                            <span className="text-[9px] font-bold text-[#86EFAC] tabular-nums leading-none">{openTimeStr}</span>
                          </div>
                          {/* Close Time pill */}
                          <div className="flex items-center justify-between px-2 py-0.5 rounded-md" style={{ background: 'rgba(239, 68, 68, 0.18)', border: '1px solid rgba(248, 113, 113, 0.35)' }}>
                            <span className="text-[7px] uppercase tracking-wider text-[#FCA5A5] font-black leading-none">Close</span>
                            <span className="text-[9px] font-bold text-[#FCA5A5] tabular-nums leading-none">{closeTimeStr}</span>
                          </div>

                          {/* Play / Pause / Holiday - no glow keyframe, no multi-shadow */}
                          <div className="flex flex-col items-center mt-0.5">
                            {game.is_holiday ? (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)' }} data-testid={`holiday-btn-${game.id}`}>
                                <span className="text-white font-black text-sm">H</span>
                              </div>
                            ) : gameStatus.status === 'open' ? (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                                style={{
                                  background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 70%, #B8860B 100%)',
                                  border: '2px solid #FFD700',
                                }}
                                onClick={() => speak('प्ले')}
                                data-testid={`play-btn-${game.id}`}
                              >
                                <Play className="w-4 h-4 text-[#1A0F00] ml-0.5" fill="#1A0F00" />
                              </div>
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                                style={{
                                  background: '#FFFFFF',
                                  border: '2px solid #DC2626',
                                }}
                                data-testid={`timeout-btn-${game.id}`}
                                onClick={() => speak('टाइम आउट')}
                              >
                                <X className="w-5 h-5 text-[#DC2626]" strokeWidth={3.5} />
                              </div>
                            )}
                            <span
                              className={`text-[9px] font-black tracking-wide uppercase leading-none mt-1 ${
                                game.is_holiday ? 'text-[#FBBF24]' : gameStatus.status === 'open' ? 'text-[#FFD700]' : 'text-[#FCA5A5]'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
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
      {historyGame && (
        <GameHistoryModal game={historyGame} onClose={() => setHistoryGame(null)} />
      )}
    </div>
  );
};

export default DashboardPage;
