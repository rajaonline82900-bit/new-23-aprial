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
  Check
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
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);

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

  const handlePlaceBet = async () => {
    if (!selectedNumber) {
      toast.error('कृपया एक नंबर चुनें');
      return;
    }
    
    if (!amount || parseFloat(amount) < 10) {
      toast.error('न्यूनतम बेट ₹10 है');
      return;
    }
    
    if (parseFloat(amount) > (user?.balance || 0)) {
      toast.error('अपर्याप्त बैलेंस');
      return;
    }
    
    setPlacing(true);
    
    try {
      const { data } = await axios.post(`${API_URL}/api/bets`, {
        game_id: gameId,
        bet_type: betType,
        number: selectedNumber,
        amount: parseFloat(amount)
      }, { withCredentials: true });
      
      toast.success(`बेट लगाई गई! संभावित जीत: ₹${data.potential_win}`);
      setSelectedNumber(null);
      setAmount('');
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'बेट नहीं लग पाई');
    } finally {
      setPlacing(false);
    }
  };

  const getMultiplier = () => betType === 'single' ? 9 : 90;

  const getPotentialWin = () => {
    if (!amount) return 0;
    return parseFloat(amount) * getMultiplier();
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

        {/* Betting Section */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded']">बेट लगाएं</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={betType} onValueChange={setBetType} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#0A0A0C] mb-6">
                <TabsTrigger 
                  value="single"
                  data-testid="single-bet-tab"
                  className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
                >
                  एकल अंक (0-9)
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
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSelectedNumber(String(num))}
                      data-testid={`single-number-${num}`}
                      className={`
                        w-full aspect-square rounded-xl text-2xl font-bold transition-all
                        ${selectedNumber === String(num) 
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
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6 max-h-[400px] overflow-y-auto">
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

            {/* Amount Input */}
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">बेट राशि (₹)</label>
                <Input
                  type="number"
                  placeholder="न्यूनतम ₹10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="bet-amount-input"
                  className="bg-[#0A0A0C] border-white/10 text-white text-lg h-12"
                />
              </div>
              
              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2">
                {[10, 50, 100, 500, 1000].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(String(amt))}
                    className="border-white/10 text-gray-300 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
                  >
                    ₹{amt}
                  </Button>
                ))}
              </div>

              {/* Potential Win */}
              {amount && selectedNumber && (
                <div className="bg-[#10B981]/10 rounded-lg p-4 border border-[#10B981]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">संभावित जीत</span>
                    <span className="text-2xl font-bold text-[#10B981]">₹{getPotentialWin().toFixed(2)}</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    गुणक: {getMultiplier()}x ({betType === 'single' ? 'एकल' : 'जोड़ी'})
                  </p>
                </div>
              )}

              {/* Place Bet Button */}
              <Button
                onClick={handlePlaceBet}
                disabled={placing || !selectedNumber || !amount}
                data-testid="place-bet-button"
                className="w-full h-14 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold text-lg disabled:opacity-50"
              >
                {placing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    बेट लग रही है...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    बेट लगाएं
                  </span>
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
