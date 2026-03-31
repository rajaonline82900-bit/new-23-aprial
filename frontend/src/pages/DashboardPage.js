import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Coins, 
  Wallet, 
  History, 
  Trophy, 
  Clock, 
  LogOut,
  ChevronRight,
  Sparkles,
  User,
  Shield,
  Bell,
  Calendar,
  Home,
  IndianRupee,
  BarChart3,
  Gift,
  Send,
  Menu,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';
import SidebarMenu from '../components/SidebarMenu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramLink, setTelegramLink] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchGames();
    fetchSettings();
    refreshUser();
  }, [refreshUser]);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setTelegramLink(data.telegram_link || '');
    } catch (error) {}
  };

  const fetchGames = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/games`, { withCredentials: true });
      setGames(data.games);
    } catch (error) {
      toast.error('गेम्स लोड नहीं हो पाए');
    } finally {
      setLoading(false);
    }
  };

  // Request notification permission on dashboard load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            if (window.subscribePush) window.subscribePush(reg);
          });
        }
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          if (window.subscribePush) window.subscribePush(reg);
        });
      }
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

    // Between start_time and end_time → Play (open)
    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return { status: 'open', label: 'Play', labelHi: 'खेलें' };
    }
    
    return { status: 'closed', label: 'Time Out', labelHi: 'टाइम आउट' };
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                data-testid="sidebar-toggle"
                className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <h1 className="text-xl font-bold text-white font-['Unbounded']">सट्टा मटका</h1>
            </div>
            
            <div className="flex items-center gap-4">
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-sm hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#D4AF37]/20"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">App Install करें</span>
                <span className="sm:hidden">Install</span>
              </button>
              <div className="hidden sm:flex items-center gap-2 bg-[#141418] px-4 py-2 rounded-lg border border-white/10">
                <Wallet className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-white font-semibold">₹{user?.balance?.toFixed(2) || '0.00'}</span>
              </div>
              
              {user?.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="outline" size="sm" className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                </Link>
              )}
              
              <button
                onClick={handleLogout}
                data-testid="logout-button"
                className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-['Unbounded']">
            नमस्ते, {user?.name} <Sparkles className="inline w-6 h-6 text-[#D4AF37]" />
          </h2>
          <p className="text-gray-400">आज का भाग्य आजमाएं</p>
        </div>

        {/* Mobile Balance Card */}
        <Card className="sm:hidden bg-gradient-to-br from-[#D4AF37]/10 to-[#141418] border-[#D4AF37]/20 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">आपका बैलेंस</p>
                <p className="text-2xl font-bold text-white">₹{user?.balance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (window.deferredPrompt) {
                      window.deferredPrompt.prompt();
                      window.deferredPrompt.userChoice.then(() => { window.deferredPrompt = null; });
                    } else {
                      alert('ब्राउज़र मेनू में जाकर "Add to Home Screen" या "Install App" पर क्लिक करें।');
                    }
                  }}
                  data-testid="download-apk-mobile"
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-sm"
                >
                  <Download className="w-4 h-4" />
                </button>
                <Link to="/wallet">
                  <Button className="bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
                    जमा करें
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Link to="/wallet" data-testid="wallet-link">
            <Card className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-all">
                  <Wallet className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <span className="text-white font-medium text-xs sm:text-sm">वॉलेट</span>
              </CardContent>
            </Card>
          </Link>

          <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
            <Card className="bg-[#141418] border-white/10 hover:border-[#0088cc]/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#0088cc]/10 flex items-center justify-center group-hover:bg-[#0088cc]/20 transition-all">
                  <Send className="w-6 h-6 text-[#0088cc]" />
                </div>
                <span className="text-white font-medium text-xs sm:text-sm">टेलीग्राम</span>
              </CardContent>
            </Card>
          </a>
          
          <Link to="/bets" data-testid="bets-link">
            <Card className="bg-[#141418] border-white/10 hover:border-[#10B981]/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#10B981]/10 flex items-center justify-center group-hover:bg-[#10B981]/20 transition-all">
                  <History className="w-6 h-6 text-[#10B981]" />
                </div>
                <span className="text-white font-medium text-xs sm:text-sm">मेरी बेट</span>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/results" data-testid="results-link">
            <Card className="bg-[#141418] border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                  <Trophy className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-white font-medium text-xs sm:text-sm">रिजल्ट</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Games Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white font-['Unbounded']">गेम्स</h3>
            <Badge variant="outline" className="border-[#D4AF37]/50 text-[#D4AF37]">
              {games.length} उपलब्ध
            </Badge>
          </div>
          
          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-[#141418] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {games.map((game, index) => {
                const gameStatus = getGameStatus(game);
                const CardWrapper = game.is_holiday ? 'div' : Link;
                const cardProps = game.is_holiday 
                  ? { key: game.id, 'data-testid': `game-card-${game.id}` }
                  : { key: game.id, to: `/game/${game.id}`, 'data-testid': `game-card-${game.id}` };
                return (
                  <CardWrapper {...cardProps}>
                    <Card 
                      className={`border-white/10 transition-all stagger-item ${
                        game.is_holiday 
                          ? 'bg-[#141418]/60 opacity-70 cursor-not-allowed' 
                          : 'bg-[#141418] hover:border-[#D4AF37]/50 cursor-pointer'
                      }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <h4 className="text-lg font-semibold text-white">{game.name_hi}</h4>
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Clock className="w-4 h-4" />
                                <span>{game.start_time} - {game.end_time}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Yesterday Result Box */}
                            <div className="text-center px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 min-w-[60px]">
                              <p className="text-red-400 text-[9px] uppercase tracking-wide font-medium">Yesterday</p>
                              <p className="text-red-500 font-bold text-lg leading-tight">
                                {game.yesterday_result?.jodi || '--'}
                              </p>
                            </div>

                            {/* Today Result Box */}
                            <div className="text-center px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 min-w-[60px]">
                              <p className="text-green-400 text-[9px] uppercase tracking-wide font-medium">Today</p>
                              <p className="text-green-500 font-bold text-lg leading-tight">
                                {game.today_result?.jodi || '--'}
                              </p>
                            </div>

                            {/* Play / Time Out / Holiday Button */}
                            {game.is_holiday ? (
                              <div className="px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-sm min-w-[80px] text-center" data-testid={`holiday-btn-${game.id}`}>
                                Holiday
                              </div>
                            ) : gameStatus.status === 'open' ? (
                              <div className="px-4 py-2 rounded-lg bg-green-500 text-white font-bold text-sm min-w-[80px] text-center" data-testid={`play-btn-${game.id}`}>
                                Play
                              </div>
                            ) : (
                              <div className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm min-w-[80px] text-center" data-testid={`timeout-btn-${game.id}`}>
                                Time Out
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardWrapper>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <SidebarMenu open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <FooterNav />
    </div>
  );
};

export default DashboardPage;
