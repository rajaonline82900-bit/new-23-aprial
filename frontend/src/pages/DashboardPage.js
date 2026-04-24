import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import MatkaLogo from '../components/MatkaLogo';
import { 
  Wallet, 
  Trophy, 
  Shield,
  Send,
  Menu,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Headphones,
  Gift
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
  const gamesRef = useRef(null);

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
      setGames(data.games);
    } catch (error) {
      if (showError) toast.error('गेम्स लोड नहीं हो पाए');
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
      {/* Header - Fixed */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0C] border-b border-white/10" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                data-testid="sidebar-toggle"
                className="p-1.5 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <MatkaLogo size="sm" />
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (window.deferredPrompt) {
                    window.deferredPrompt.prompt();
                    window.deferredPrompt.userChoice.then(() => { window.deferredPrompt = null; });
                  } else {
                    alert('ब्राउज़र मेनू में जाकर "Add to Home Screen" या "Install App" पर क्लिक करें।');
                  }
                }}
                data-testid="download-apk-button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-xs hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#D4AF37]/20"
              >
                <Download className="w-3.5 h-3.5" />
                {t('download_app')}
              </button>
              
              {user?.role === 'admin' && (
                <Link to="/admin">
                  <button className="p-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all" data-testid="admin-panel-btn">
                    <Shield className="w-4 h-4" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Fixed Top Section */}
      <div className="fixed top-[52px] left-0 right-0 z-40 bg-[#0A0A0C]" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="px-3 pt-2">
          {/* Branding Banner */}
          {/* Refer & Earn Banner */}
          <div className="mb-2 rounded-xl overflow-hidden bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-[#D4AF37]/30 shadow-lg shadow-[#D4AF37]/10" data-testid="refer-banner">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[#D4AF37] font-black text-base font-['Unbounded'] leading-tight">Refer करके पैसे कमाएं</p>
                <p className="text-gray-300 text-xs mt-0.5">दोस्तों को भेजें, हर रेफर पर बोनस पाएं</p>
              </div>
              <div className="flex gap-2">
                <Link to="/refer" data-testid="refer-banner-btn"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold text-xs transition-all">
                  <Gift className="w-3.5 h-3.5" />
                  Refer
                </Link>
                <button onClick={() => {
                  const referCode = user?.referral_code || '';
                  const text = `MATKA 11 - India's Trusted Matka Platform! Mera referral code use karo: ${referCode}. Download karo: https://matka11.online/signup?ref=${referCode}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }} data-testid="whatsapp-share-btn"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-xs transition-all">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.475A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.168 0-4.177-.693-5.82-1.87l-.418-.249-2.738.874.728-2.66-.273-.432A9.78 9.78 0 012.182 12c0-5.423 4.395-9.818 9.818-9.818S21.818 6.577 21.818 12s-4.395 9.818-9.818 9.818z"/></svg>
                  Share
                </button>
              </div>
            </div>
          </div>

          {/* Balance Card */}
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
          <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-[#141418] border-[#D4AF37]/20 mb-2">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">{t('your_balance')}</p>
                  <p className="text-xl font-bold text-white">₹{user?.balance?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/wallet">
                    <Button onClick={() => speak('जमा करें')} className="bg-[#10B981] hover:bg-[#059669] text-white font-bold flex items-center gap-1.5">
                      <ArrowDownLeft className="w-4 h-4" />
                      {t('deposit')}
                    </Button>
                  </Link>
                  <Link to="/wallet?tab=withdraw">
                    <Button onClick={() => speak('निकासी')} className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5">
                      <ArrowUpRight className="w-4 h-4" />
                      {t('withdraw')}
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            <Link to="/wallet" data-testid="wallet-link">
              <Card className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-all">
                    <Wallet className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <span className="text-white font-medium text-[10px]">{t('wallet')}</span>
                </CardContent>
              </Card>
            </Link>

            <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
              <Card className="bg-[#141418] border-white/10 hover:border-[#0088cc]/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-[#0088cc]/10 flex items-center justify-center group-hover:bg-[#0088cc]/20 transition-all">
                    <Send className="w-4 h-4 text-[#0088cc]" />
                  </div>
                  <span className="text-white font-medium text-[10px]">{t('telegram')}</span>
                </CardContent>
              </Card>
            </a>
            
            <Link to="/chat" data-testid="chat-quick-link">
              <Card className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1 relative">
                  <div className="relative w-9 h-9 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-all">
                    <Headphones className="w-4 h-4 text-[#D4AF37]" />
                    {unreadChat > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center" data-testid="chat-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
                    )}
                  </div>
                  <span className="text-white font-medium text-[10px]">{t('chat')}</span>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/results" data-testid="results-link">
              <Card className="bg-[#141418] border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                    <Trophy className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-white font-medium text-[10px]">{t('results')}</span>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Games Header with Tabs */}
          <div className="pb-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white font-['Unbounded']">{t('games')}</h3>
              <Badge variant="outline" className="border-[#D4AF37]/50 text-[#D4AF37]">
                {games.filter(g => (g.category || 'gali_disawar') === gameCategory).length} {t('available')}
              </Badge>
            </div>
            {/* Category Tabs */}
            <div className="flex gap-2 p-1 bg-[#141418] rounded-xl border border-white/5" data-testid="dashboard-game-tabs">
              <button
                onClick={() => { setGameCategory('gali_disawar'); localStorage.setItem('game_category', 'gali_disawar'); }}
                className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                  gameCategory === 'gali_disawar'
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid="tab-gali-disawar"
              >
                GALI / DISAWAR
              </button>
              <button
                onClick={() => { setGameCategory('kalyan'); localStorage.setItem('game_category', 'kalyan'); }}
                className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${
                  gameCategory === 'kalyan'
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
                data-testid="tab-kalyan"
              >
                KALYAN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Games Section */}
      <main className="px-3 pt-[410px] pb-24">
        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#141418] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {games.filter(g => (g.category || 'gali_disawar') === gameCategory).map((game, index) => {
                const gameStatus = getGameStatus(game);
                const isDisabled = game.is_holiday || gameStatus.status !== 'open';
                const CardWrapper = isDisabled ? 'div' : Link;
                const cardProps = isDisabled 
                  ? { key: game.id, 'data-testid': `game-card-${game.id}` }
                  : { key: game.id, to: (game.category === 'kalyan' ? `/kalyan/${game.id}` : `/game/${game.id}`), 'data-testid': `game-card-${game.id}` };
                return (
                  <CardWrapper {...cardProps}>
                    <Card 
                      className={`game-card-animate game-card-hidden border-white/10 transition-all ${
                        isDisabled 
                          ? 'bg-[#141418]/60 opacity-70 cursor-not-allowed' 
                          : 'bg-[#141418] hover:border-[#D4AF37]/50 cursor-pointer'
                      }`}
                      style={{ animationDelay: `${index * 0.08}s` }}
                    >
                      <CardContent className="p-3">
                        {/* Row 1: Last Time | Game Name | Play/TimeOut */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-shrink-0">
                            <p className="text-gray-400 text-[8px] uppercase tracking-wide font-medium">Last Time</p>
                            <p className="text-white font-bold text-sm leading-tight">
                              {(() => {
                                const [h, m] = (game.end_time || '00:00').split(':').map(Number);
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                const h12 = h % 12 || 12;
                                return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                              })()}
                            </p>
                          </div>
                          <h4 className="text-lg font-bold text-[#D4AF37] truncate px-2">{game.name_hi}</h4>
                          {/* Play / Time Out / Holiday */}
                          {game.is_holiday ? (
                            <div className="px-4 py-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-sm text-center whitespace-nowrap" data-testid={`holiday-btn-${game.id}`}>
                              Holiday
                            </div>
                          ) : gameStatus.status === 'open' ? (
                            <div className="px-5 py-2 rounded-xl bg-green-500 text-white font-bold text-sm text-center cursor-pointer whitespace-nowrap shadow-lg shadow-green-500/30" data-testid={`play-btn-${game.id}`} onClick={() => speak('प्ले')}>
                              Play
                            </div>
                          ) : (
                            <div className="px-3.5 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm text-center whitespace-nowrap" data-testid={`timeout-btn-${game.id}`} onClick={() => speak('टाइम आउट')}>
                              Time Out
                            </div>
                          )}
                        </div>
                        
                        {/* Row 2: Yesterday (red bg, white text) | Today (green bg, white text + LIVE) */}
                        <div className="flex items-center gap-2">
                          {/* Yesterday - Red box */}
                          <div className="text-center flex-1 py-2 rounded-lg bg-red-600 border border-red-500">
                            <p className="text-white/70 text-[8px] uppercase tracking-wide font-medium leading-tight">Yesterday</p>
                            <p className="text-white font-bold text-lg leading-tight">
                              {game.yesterday_result?.jodi || '--'}
                            </p>
                          </div>
                          {/* Today - Green box with LIVE blink */}
                          <div className="text-center flex-1 py-2 rounded-lg bg-green-500/10 border border-green-500/30 relative">
                            <div className="flex items-center justify-center gap-1">
                              <p className="text-green-400 text-[8px] uppercase tracking-wide font-medium leading-tight">Today</p>
                              <span className="live-blink text-[7px] font-bold text-red-500 uppercase tracking-wider">LIVE</span>
                            </div>
                            <p className="text-green-400 font-bold text-lg leading-tight">
                              {game.today_result?.jodi || '--'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardWrapper>
                );
              })}
            </div>
          )}
      </main>
      <SidebarMenu open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <FooterNav />
    </div>
  );
};

export default DashboardPage;
