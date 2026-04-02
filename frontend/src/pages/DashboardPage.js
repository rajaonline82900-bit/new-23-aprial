import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import MatkaLogo from '../components/MatkaLogo';
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
  Download,
  ArrowDownLeft,
  ArrowUpRight
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
    <div className="min-h-screen bg-[#0A0A0C] app-shell">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
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
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-[11px] hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#D4AF37]/20"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
              
              {user?.role === 'admin' && (
                <Link to="/admin">
                  <button className="p-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all" data-testid="admin-panel-btn">
                    <Shield className="w-4 h-4" />
                  </button>
                </Link>
              )}
              
              <Link to="/profile" data-testid="profile-icon-link">
                <button className="p-1.5 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all">
                  <User className="w-4 h-4" />
                </button>
              </Link>
              
              <button
                onClick={handleLogout}
                data-testid="logout-button"
                className="p-1.5 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-4 pb-24">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-1 font-['Unbounded']">
            नमस्ते, {user?.name} <Sparkles className="inline w-5 h-5 text-[#D4AF37]" />
          </h2>
          <p className="text-gray-400">आज का भाग्य आजमाएं</p>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-[#141418] border-[#D4AF37]/20 mb-4">
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
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Link to="/wallet" data-testid="wallet-link">
            <Card className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-all">
                  <Wallet className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <span className="text-white font-medium text-[10px]">वॉलेट</span>
              </CardContent>
            </Card>
          </Link>

          <a href={telegramLink || '#'} target="_blank" rel="noopener noreferrer" data-testid="telegram-quick-link" onClick={(e) => { if (!telegramLink) e.preventDefault(); }}>
            <Card className="bg-[#141418] border-white/10 hover:border-[#0088cc]/50 transition-all cursor-pointer group">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center group-hover:bg-[#0088cc]/20 transition-all">
                  <Send className="w-5 h-5 text-[#0088cc]" />
                </div>
                <span className="text-white font-medium text-[10px]">टेलीग्राम</span>
              </CardContent>
            </Card>
          </a>
          
          <Link to="/bets" data-testid="bets-link">
            <Card className="bg-[#141418] border-white/10 hover:border-[#10B981]/50 transition-all cursor-pointer group">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center group-hover:bg-[#10B981]/20 transition-all">
                  <History className="w-5 h-5 text-[#10B981]" />
                </div>
                <span className="text-white font-medium text-[10px]">मेरी बेट</span>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/results" data-testid="results-link">
            <Card className="bg-[#141418] border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                  <Trophy className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white font-medium text-[10px]">रिजल्ट</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Games Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white font-['Unbounded']">गेम्स</h3>
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
            <div className="grid gap-3">
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
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-shrink">
                            <h4 className="text-sm font-semibold text-white truncate">{game.name_hi}</h4>
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              <span>{game.start_time} - {game.end_time}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Yesterday Result Box */}
                            <div className="text-center px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 min-w-[48px]">
                              <p className="text-red-400 text-[8px] uppercase tracking-wide font-medium leading-tight">Yesterday</p>
                              <p className="text-red-500 font-bold text-base leading-tight">
                                {game.yesterday_result?.jodi || '--'}
                              </p>
                            </div>

                            {/* Today Result Box */}
                            <div className="text-center px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/30 min-w-[48px]">
                              <p className="text-green-400 text-[8px] uppercase tracking-wide font-medium leading-tight">Today</p>
                              <p className="text-green-500 font-bold text-base leading-tight">
                                {game.today_result?.jodi || '--'}
                              </p>
                            </div>

                            {/* Play / Time Out / Holiday Button */}
                            {game.is_holiday ? (
                              <div className="px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-xs min-w-[60px] text-center" data-testid={`holiday-btn-${game.id}`}>
                                Holiday
                              </div>
                            ) : gameStatus.status === 'open' ? (
                              <div className="px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold text-xs min-w-[60px] text-center cursor-pointer" data-testid={`play-btn-${game.id}`} onClick={() => speak('प्ले')}>
                                Play
                              </div>
                            ) : (
                              <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-xs min-w-[60px] text-center" data-testid={`timeout-btn-${game.id}`} onClick={() => speak('टाइम आउट')}>
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
