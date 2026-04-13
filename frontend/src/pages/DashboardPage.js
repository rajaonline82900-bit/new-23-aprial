import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';
import { speak } from '../utils/voice';
import SidebarMenu from '../components/SidebarMenu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
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

    // Auto-refresh games every 30 seconds for live results (especially PWA)
    const interval = setInterval(() => {
      fetchGames(false);
    }, 30000);

    // Also refresh when app comes back to foreground (PWA tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchGames(false);
        refreshUser();
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

  // Request notification permission on dashboard load
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    
    if (Notification.permission === 'granted') {
      // Already granted - subscribe silently
      navigator.serviceWorker.ready.then((reg) => {
        if (window.subscribePush) window.subscribePush(reg);
      });
    } else if (Notification.permission === 'default') {
      // Show banner to ask user to enable
      const dismissed = localStorage.getItem('notif_banner_dismissed');
      if (!dismissed) {
        setShowNotifBanner(true);
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
                Download App
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
          <div className="mb-2 rounded-xl overflow-hidden bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-[#D4AF37]/30 shadow-lg shadow-[#D4AF37]/10" data-testid="branding-banner">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-[#D4AF37] font-bold text-lg font-['Unbounded'] leading-tight">MATKA 11</p>
                <p className="text-gray-400 text-[10px]">India's Trusted Matka Platform</p>
              </div>
              <a
                href="https://www.google.com/search?q=matka11.online"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="banner-search-link"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A0A0C]/50 border border-white/10 hover:bg-[#0A0A0C] transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-white text-xs font-medium">www.matka11.online</span>
              </a>
            </div>
          </div>

          {/* Balance Card */}
          {showNotifBanner && (
            <div className="mb-2 rounded-xl overflow-hidden bg-gradient-to-r from-blue-900/40 to-[#141418] border border-blue-500/30 p-3" data-testid="notification-enable-banner">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  </div>
                  <p className="text-white text-xs">Results की notification पाने के लिए enable करें</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={handleEnableNotifications} data-testid="enable-notifications-btn" className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-all">
                    Enable
                  </button>
                  <button onClick={dismissNotifBanner} className="p-1 text-gray-500 hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-[#141418] border-[#D4AF37]/20 mb-2">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">आपका बैलेंस</p>
                  <p className="text-xl font-bold text-white">₹{user?.balance?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/wallet">
                    <Button onClick={() => speak('जमा करें')} className="bg-[#10B981] hover:bg-[#059669] text-white font-bold flex items-center gap-1.5">
                      <ArrowDownLeft className="w-4 h-4" />
                      जमा करें
                    </Button>
                  </Link>
                  <Link to="/wallet?tab=withdraw">
                    <Button onClick={() => speak('निकासी')} className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5">
                      <ArrowUpRight className="w-4 h-4" />
                      निकासी
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
                  <span className="text-white font-medium text-[10px]">वॉलेट</span>
                </CardContent>
              </Card>
            </Link>

            <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
              <Card className="bg-[#141418] border-white/10 hover:border-[#0088cc]/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-[#0088cc]/10 flex items-center justify-center group-hover:bg-[#0088cc]/20 transition-all">
                    <Send className="w-4 h-4 text-[#0088cc]" />
                  </div>
                  <span className="text-white font-medium text-[10px]">टेलीग्राम</span>
                </CardContent>
              </Card>
            </a>
            
            <Link to="/chat" data-testid="chat-quick-link">
              <Card className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-all">
                    <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <span className="text-white font-medium text-[10px]">Chat</span>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/results" data-testid="results-link">
              <Card className="bg-[#141418] border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group">
                <CardContent className="p-2.5 flex flex-col items-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                    <Trophy className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-white font-medium text-[10px]">रिजल्ट</span>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Games Header */}
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-lg font-bold text-white font-['Unbounded']">गेम्स</h3>
            <Badge variant="outline" className="border-[#D4AF37]/50 text-[#D4AF37]">
              {games.length} उपलब्ध
            </Badge>
          </div>
        </div>
      </div>

      {/* Scrollable Games Section */}
      <main className="px-3 pt-[370px] pb-24">
        {loading ? (
          <div className="grid gap-4">
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
                  : { key: game.id, to: `/game/${game.id}`, 'data-testid': `game-card-${game.id}` };
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
