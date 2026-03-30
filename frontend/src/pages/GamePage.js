import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, 
  Clock, 
  Coins,
  Trophy,
  Wallet,
  Send
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

  // Direct input state
  const [directNumber, setDirectNumber] = useState('');
  const [directAmount, setDirectAmount] = useState('');

  useEffect(() => {
    fetchGame();
  }, [gameId]);

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
      setDirectNumber('');
      setDirectAmount('');
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
                  <span>{game?.display_time}</span>
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

        {/* Quick Bet - Direct Input */}
        <Card className="bg-gradient-to-br from-[#10B981]/10 to-[#141418] border-[#10B981]/30 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white font-['Unbounded'] text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-[#10B981]" />
              Quick Bet - सीधे नंबर डालें
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Single Quick Bet */}
              <div className="p-4 bg-[#0A0A0C] rounded-xl border border-white/10">
                <p className="text-[#D4AF37] font-semibold mb-3">एकल (0-9) - 9x</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    maxLength={1}
                    placeholder="0-9"
                    value={directNumber}
                    onChange={(e) => setDirectNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    data-testid="direct-single-number"
                    className="bg-[#141418] border-white/10 text-white text-center text-2xl h-14 w-20"
                  />
                  <Input
                    type="number"
                    placeholder="राशि ₹"
                    value={directAmount}
                    onChange={(e) => setDirectAmount(e.target.value)}
                    data-testid="direct-single-amount"
                    className="bg-[#141418] border-white/10 text-white h-14 flex-1"
                  />
                  <Button
                    onClick={() => handlePlaceBet(directNumber, directAmount, 'single')}
                    disabled={placing || !directNumber || !directAmount}
                    data-testid="direct-single-bet-button"
                    className="h-14 px-6 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
                  >
                    {placing ? '...' : 'बेट'}
                  </Button>
                </div>
                {directAmount && directNumber && (
                  <p className="text-emerald-400 text-sm mt-2">
                    जीत: ₹{getPotentialWin(directAmount, 'single')}
                  </p>
                )}
              </div>

              {/* Jodi Quick Bet */}
              <div className="p-4 bg-[#0A0A0C] rounded-xl border border-white/10">
                <p className="text-[#10B981] font-semibold mb-3">जोड़ी (00-99) - 90x</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    maxLength={2}
                    placeholder="00-99"
                    value={selectedNumber}
                    onChange={(e) => setSelectedNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    data-testid="direct-jodi-number"
                    className="bg-[#141418] border-white/10 text-white text-center text-2xl h-14 w-24"
                  />
                  <Input
                    type="number"
                    placeholder="राशि ₹"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="direct-jodi-amount"
                    className="bg-[#141418] border-white/10 text-white h-14 flex-1"
                  />
                  <Button
                    onClick={() => handlePlaceBet(selectedNumber, amount, 'jodi')}
                    disabled={placing || !selectedNumber || !amount}
                    data-testid="direct-jodi-bet-button"
                    className="h-14 px-6 bg-[#10B981] hover:bg-[#059669] text-white font-bold"
                  >
                    {placing ? '...' : 'बेट'}
                  </Button>
                </div>
                {amount && selectedNumber && (
                  <p className="text-emerald-400 text-sm mt-2">
                    जीत: ₹{getPotentialWin(amount, 'jodi')}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[10, 50, 100, 200, 500, 1000].map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDirectAmount(String(amt));
                    setAmount(String(amt));
                  }}
                  className="border-white/10 text-gray-300 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
                >
                  ₹{amt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Number Grid Selection */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded']">नंबर चुनें</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={betType} onValueChange={setBetType} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#0A0A0C] mb-6">
                <TabsTrigger 
                  value="single"
                  data-testid="single-bet-tab"
                  className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
                >
                  एकल (0-9)
                </TabsTrigger>
                <TabsTrigger 
                  value="jodi"
                  data-testid="jodi-bet-tab"
                  className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
                >
                  जोड़ी (00-99)
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="single" className="mt-0">
                <div className="grid grid-cols-5 gap-3">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => setDirectNumber(String(num))}
                      data-testid={`single-number-${num}`}
                      className={`
                        w-full aspect-square rounded-xl text-2xl font-bold transition-all
                        ${directNumber === String(num) 
                          ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black gold-glow' 
                          : 'bg-[#0A0A0C] text-white border border-white/10 hover:border-[#D4AF37]/50'
                        }
                      `}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="jodi" className="mt-0">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-[400px] overflow-y-auto">
                  {Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')).map((num) => (
                    <button
                      key={num}
                      onClick={() => setSelectedNumber(num)}
                      data-testid={`jodi-number-${num}`}
                      className={`
                        py-2 px-1 rounded-lg text-sm font-bold transition-all
                        ${selectedNumber === num 
                          ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black gold-glow' 
                          : 'bg-[#0A0A0C] text-white border border-white/10 hover:border-[#D4AF37]/50'
                        }
                      `}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
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
