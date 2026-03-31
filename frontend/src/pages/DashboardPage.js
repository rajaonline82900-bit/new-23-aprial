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
  Gift
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
    refreshUser();
  }, [refreshUser]);

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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getGameStatus = (game) => {
    const now = new Date();
    const [hours, minutes] = game.time.split(':');
    const gameTime = new Date();
    gameTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    // If game time is in past for today
    if (now > gameTime) {
      return { status: 'closed', label: 'बंद', color: 'bg-red-500/20 text-red-400' };
    }
    
    // If within 30 minutes
    const diff = (gameTime - now) / (1000 * 60);
    if (diff <= 30) {
      return { status: 'live', label: 'लाइव', color: 'bg-emerald-500/20 text-emerald-400' };
    }
    
    return { status: 'open', label: 'खुला', color: 'bg-[#D4AF37]/20 text-[#D4AF37]' };
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <h1 className="text-xl font-bold text-white font-['Unbounded']">सट्टा मटका</h1>
            </div>
            
            <div className="flex items-center gap-4">
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
              <Link to="/wallet">
                <Button className="bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
                  जमा करें
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Link to="/wallet" data-testid="wallet-link">
            <Card className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-all">
                  <Wallet className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <span className="text-white font-medium">वॉलेट</span>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/jantri" data-testid="jantri-link">
            <Card className="bg-[#141418] border-white/10 hover:border-orange-500/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-all">
                  <Calendar className="w-6 h-6 text-orange-400" />
                </div>
                <span className="text-white font-medium">जंत्री</span>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/bets" data-testid="bets-link">
            <Card className="bg-[#141418] border-white/10 hover:border-[#10B981]/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[#10B981]/10 flex items-center justify-center group-hover:bg-[#10B981]/20 transition-all">
                  <History className="w-6 h-6 text-[#10B981]" />
                </div>
                <span className="text-white font-medium">मेरी बेट</span>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/results" data-testid="results-link">
            <Card className="bg-[#141418] border-white/10 hover:border-purple-500/50 transition-all cursor-pointer group">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-all">
                  <Trophy className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-white font-medium">रिजल्ट</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Notification Banner */}
        <Link to="/notifications" data-testid="notifications-link">
          <Card className="bg-gradient-to-r from-blue-500/10 to-[#141418] border-blue-500/30 mb-6 hover:border-blue-500/50 transition-all cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Notifications Setup</p>
                    <p className="text-gray-400 text-sm">Telegram/WhatsApp पर रिजल्ट पाएं</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </Link>

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
                return (
                  <Link 
                    key={game.id} 
                    to={`/game/${game.id}`}
                    data-testid={`game-card-${game.id}`}
                  >
                    <Card 
                      className="bg-[#141418] border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer stagger-item"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] flex items-center justify-center border border-[#D4AF37]/30">
                              <span className="text-2xl font-bold text-[#D4AF37] font-['Unbounded']">
                                {game.latest_result?.jodi || '--'}
                              </span>
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-white">{game.name_hi}</h4>
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Clock className="w-4 h-4" />
                                <span>{game.display_time}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Badge className={gameStatus.color}>
                              {gameStatus.label}
                            </Badge>
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141418] border-t border-white/10" data-testid="footer-nav">
        <div className="container mx-auto max-w-screen-xl">
          <div className="grid grid-cols-5">
            <Link to="/dashboard" className="flex flex-col items-center py-3 text-[#D4AF37] transition-all" data-testid="footer-home">
              <Home className="w-5 h-5 mb-1" />
              <span className="text-[10px]">Home</span>
            </Link>
            <Link to="/wallet" className="flex flex-col items-center py-3 text-gray-400 hover:text-[#D4AF37] transition-all" data-testid="footer-fund">
              <IndianRupee className="w-5 h-5 mb-1" />
              <span className="text-[10px]">Fund</span>
            </Link>
            <Link to="/bets" className="flex flex-col items-center py-3 text-gray-400 hover:text-[#D4AF37] transition-all" data-testid="footer-bid-history">
              <History className="w-5 h-5 mb-1" />
              <span className="text-[10px]">Bid History</span>
            </Link>
            <Link to="/jantri" className="flex flex-col items-center py-3 text-gray-400 hover:text-[#D4AF37] transition-all" data-testid="footer-result-chart">
              <BarChart3 className="w-5 h-5 mb-1" />
              <span className="text-[10px]">Result Chart</span>
            </Link>
            <button className="flex flex-col items-center py-3 text-gray-400 hover:text-[#D4AF37] transition-all" data-testid="footer-refer" onClick={() => toast.info('Refer & Earn जल्द आ रहा है!')}>
              <Gift className="w-5 h-5 mb-1" />
              <span className="text-[10px]">Refer & Earn</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default DashboardPage;
