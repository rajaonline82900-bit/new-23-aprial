import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, 
  Clock, 
  Coins,
  Trophy,
  Wallet,
  Lock,
  Unlock
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Check if betting is currently open based on start_time and end_time (HH:MM format)
const isBettingOpen = (startTime, endTime) => {
  if (!startTime || !endTime) return true; // If no times set, allow betting
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Handle overnight games (e.g., start 23:00, end 05:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

const GamePage = () => {
  const { gameId } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [betType, setBetType] = useState('single');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);
  const [bettingOpen, setBettingOpen] = useState(true);

  useEffect(() => {
    fetchGame();
  }, [gameId]);

  // Check betting status every 30 seconds
  useEffect(() => {
    if (game) {
      const checkBetting = () => {
        setBettingOpen(isBettingOpen(game.start_time, game.end_time));
      };
      checkBetting();
      const interval = setInterval(checkBetting, 30000);
      return () => clearInterval(interval);
    }
  }, [game]);

  const fetchGame = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/games/${gameId}`, { withCredentials: true });
      setGame(data);
    } catch (error) {
      toast.error('गेम लोड नहीं हो पाया');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBet = async (number, betAmount, type) => {
    if (!bettingOpen) {
      toast.error('बेटिंग बंद है! समय: ' + (game?.start_time || '') + ' - ' + (game?.end_time || ''));
      return;
    }

    if (!number) {
      toast.error('कृपया नंबर दर्ज करें');
      return;
    }
    
    // Validate number based on type
    if (type === 'single') {
      if (!/^[0-9]$/.test(number)) {
        toast.error('एकल नंबर 0-9 होना चाहिए');
        return;
      }
    } else {
      if (!/^[0-9]{2}$/.test(number)) {
        toast.error('जोड़ी नंबर 00-99 होना चाहिए');
        return;
      }
    }
    
    if (!betAmount || parseFloat(betAmount) < 10) {
      toast.error('न्यूनतम बेट ₹10 है');
      return;
    }
    
    if (parseFloat(betAmount) > (user?.balance || 0)) {
      toast.error('अपर्याप्त बैलेंस');
      return;
    }
    
    setPlacing(true);
    
    try {
      const { data } = await axios.post(`${API_URL}/api/bets`, {
        game_id: gameId,
        bet_type: type,
        number: type === 'jodi' ? number.padStart(2, '0') : number,
        amount: parseFloat(betAmount)
      }, { withCredentials: true });
      
      toast.success(`बेट लगाई गई! संभावित जीत: ₹${data.potential_win}`);
      setSelectedNumber('');
      setAmount('');
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'बेट नहीं लग पाई');
    } finally {
      setPlacing(false);
    }
  };

  const getMultiplier = (type) => type === 'single' ? 9 : 90;

  const getPotentialWin = (amt, type) => {
    if (!amt) return 0;
    return parseFloat(amt) * getMultiplier(type);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white font-['Unbounded']">{game?.name_hi}</h1>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{game?.start_time || '--:--'} - {game?.end_time || '--:--'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-[#141418] px-4 py-2 rounded-lg border border-white/10">
              <Wallet className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-white font-semibold">₹{user?.balance?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Betting Status Banner */}
        <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between ${
          bettingOpen 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`} data-testid="betting-status-banner">
          <div className="flex items-center gap-3">
            {bettingOpen ? (
              <Unlock className="w-5 h-5 text-emerald-400" />
            ) : (
              <Lock className="w-5 h-5 text-red-400" />
            )}
            <div>
              <p className={`font-semibold ${bettingOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {bettingOpen ? 'बेटिंग खुली है' : 'बेटिंग बंद है'}
              </p>
              <p className="text-gray-400 text-xs">
                समय: {game?.start_time || '--:--'} से {game?.end_time || '--:--'} तक
              </p>
            </div>
          </div>
          <Badge className={bettingOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
            {bettingOpen ? 'OPEN' : 'CLOSED'}
          </Badge>
        </div>

        {/* Latest Result */}
        {game?.results?.length > 0 && (
          <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-[#141418] border-[#D4AF37]/30 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">आखिरी रिजल्ट ({game.results[0].date})</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">एकल:</span>
                      <span className="text-2xl font-bold text-[#D4AF37]">{game.results[0].single_result}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">जोड़ी:</span>
                      <span className="text-2xl font-bold text-[#10B981]">{game.results[0].jodi_result}</span>
                    </div>
                  </div>
                </div>
                <Trophy className="w-10 h-10 text-[#D4AF37]" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Number Grid Selection + Bet */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded']">नंबर चुनें</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bet Type Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => { setBetType('single'); setSelectedNumber(''); }}
                data-testid="single-bet-tab"
                className={`p-4 rounded-xl font-bold text-center transition-all ${
                  betType === 'single'
                    ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black'
                    : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-[#D4AF37]/50'
                }`}
              >
                <p className="text-lg">एकल</p>
                <p className="text-xs opacity-70">0-9 | 9x</p>
              </button>
              <button
                onClick={() => { setBetType('jodi'); setSelectedNumber(''); }}
                data-testid="jodi-bet-tab"
                className={`p-4 rounded-xl font-bold text-center transition-all ${
                  betType === 'jodi'
                    ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black'
                    : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-[#D4AF37]/50'
                }`}
              >
                <p className="text-lg">जोड़ी</p>
                <p className="text-xs opacity-70">00-99 | 90x</p>
              </button>
            </div>

            {/* Number + Amount Inputs */}
            <div className="p-4 bg-[#0A0A0C] rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <p className="text-gray-400 text-sm mb-1">नंबर डालें</p>
                  <Input
                    type="text"
                    maxLength={betType === 'single' ? 1 : 2}
                    placeholder={betType === 'single' ? '0-9' : '00-99'}
                    value={selectedNumber}
                    onChange={(e) => setSelectedNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    data-testid="bet-number-input"
                    className="bg-[#141418] border-white/10 text-white text-center text-3xl h-14 font-bold"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm mb-1">राशि (₹)</p>
                  <Input
                    type="number"
                    placeholder="राशि डालें"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="bet-amount-input"
                    className="bg-[#141418] border-white/10 text-white h-14 text-lg"
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {[10, 50, 100, 200, 500, 1000].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(String(amt))}
                    data-testid={`amount-btn-${amt}`}
                    className={`border-white/10 text-gray-300 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 ${
                      amount === String(amt) ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]' : ''
                    }`}
                  >
                    ₹{amt}
                  </Button>
                ))}
              </div>

              {amount && selectedNumber && (
                <p className="text-emerald-400 text-sm text-center mb-3" data-testid="potential-win-display">
                  संभावित जीत: ₹{getPotentialWin(amount, betType)} ({getMultiplier(betType)}x)
                </p>
              )}

              <Button
                onClick={() => handlePlaceBet(selectedNumber, amount, betType)}
                disabled={placing || !selectedNumber || !amount || !bettingOpen}
                data-testid="place-bet-button"
                className="w-full h-12 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold text-lg disabled:opacity-50"
              >
                {!bettingOpen ? (
                  <span className="flex items-center gap-2"><Lock className="w-5 h-5" /> बेटिंग बंद है</span>
                ) : placing ? (
                  <span className="flex items-center gap-2"><Coins className="w-5 h-5 animate-spin" /> बेट लग रही है...</span>
                ) : (
                  <span className="flex items-center gap-2"><Coins className="w-5 h-5" /> बेट लगाओ</span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Past Results */}
        {game?.results?.length > 0 && (
          <Card className="bg-[#141418] border-white/10">
            <CardHeader>
              <CardTitle className="text-white font-['Unbounded']">पिछले रिजल्ट</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {game.results.slice(0, 5).map((result, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-white/5"
                  >
                    <span className="text-gray-400">{result.date}</span>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="border-[#D4AF37]/50 text-[#D4AF37]">
                        एकल: {result.single_result}
                      </Badge>
                      <Badge variant="outline" className="border-[#10B981]/50 text-[#10B981]">
                        जोड़ी: {result.jodi_result}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default GamePage;
