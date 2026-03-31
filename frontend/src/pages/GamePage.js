import React, { useState, useEffect, useCallback } from 'react';
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
  Unlock,
  Trash2,
  Send,
  Gift,
  History,
  Home,
  IndianRupee,
  BarChart3
} from 'lucide-react';
import FooterNav from '../components/FooterNav';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const isBettingOpen = (startTime, endTime) => {
  if (!startTime || !endTime) return true;
  // Check holiday - last date of month (IST)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + (istOffset + now.getTimezoneOffset() * 60 * 1000));
  const lastDay = new Date(istNow.getFullYear(), istNow.getMonth() + 1, 0).getDate();
  if (istNow.getDate() === lastDay) return false;
  
  const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

// Generate all jodis 00-99
const ALL_JODIS = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

const GamePage = () => {
  const { gameId } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [bettingOpen, setBettingOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('jantri'); // 'jantri', 'haruf', or 'cross'

  // Jantri state - amounts for each jodi
  const [jantriAmounts, setJantriAmounts] = useState({});
  const [quickAmount, setQuickAmount] = useState('');

  // Haruf Andar/Bahar state
  const [andarAmounts, setAndarAmounts] = useState({});
  const [baharAmounts, setBaharAmounts] = useState({});
  const [harufQuickAmount, setHarufQuickAmount] = useState('');

  // Cross Bet state
  const [crossDigits, setCrossDigits] = useState([]);
  const [crossAmount, setCrossAmount] = useState('');

  useEffect(() => {
    fetchGame();
  }, [gameId]);

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

  const handleJantriAmountChange = useCallback((jodi, value) => {
    const numVal = value.replace(/[^0-9]/g, '');
    setJantriAmounts(prev => {
      if (!numVal || numVal === '0') {
        const next = { ...prev };
        delete next[jodi];
        return next;
      }
      return { ...prev, [jodi]: numVal };
    });
  }, []);

  const handleSetQuickAmount = (jodi) => {
    if (quickAmount && parseInt(quickAmount) >= 10) {
      setJantriAmounts(prev => ({ ...prev, [jodi]: quickAmount }));
    }
  };

  const clearAllAmounts = () => {
    setJantriAmounts({});
  };

  const handleHarufAmountChange = (panel, num, value) => {
    const numVal = value.replace(/[^0-9]/g, '');
    const setter = panel === 'andar' ? setAndarAmounts : setBaharAmounts;
    setter(prev => {
      if (!numVal || numVal === '0') {
        const next = { ...prev };
        delete next[num];
        return next;
      }
      return { ...prev, [num]: numVal };
    });
  };

  const handleSetHarufQuickAmount = (panel, num) => {
    if (harufQuickAmount && parseInt(harufQuickAmount) >= 10) {
      const setter = panel === 'andar' ? setAndarAmounts : setBaharAmounts;
      setter(prev => ({ ...prev, [num]: harufQuickAmount }));
    }
  };

  const clearHarufAmounts = () => {
    setAndarAmounts({});
    setBaharAmounts({});
  };

  // Cross Bet - toggle digit selection
  const toggleCrossDigit = (digit) => {
    setCrossDigits(prev => 
      prev.includes(digit) ? prev.filter(d => d !== digit) : [...prev, digit]
    );
  };

  // Generate all cross jodi combinations from selected digits
  const crossJodis = [];
  if (crossDigits.length >= 2) {
    for (let i = 0; i < crossDigits.length; i++) {
      for (let j = 0; j < crossDigits.length; j++) {
        if (i !== j) {
          crossJodis.push(String(crossDigits[i]) + String(crossDigits[j]));
        }
      }
    }
  }

  const crossBetAmount = parseInt(crossAmount) || 0;
  const crossTotal = crossJodis.length * crossBetAmount;
  const crossPotentialWin = crossTotal * 90;

  const clearCrossBet = () => {
    setCrossDigits([]);
    setCrossAmount('');
  };

  // Calculate totals - Jantri
  const activeBets = Object.entries(jantriAmounts).filter(([_, amt]) => amt && parseInt(amt) >= 10);
  const jantriTotal = activeBets.reduce((sum, [_, amt]) => sum + parseInt(amt), 0);

  // Calculate totals - Haruf
  const activeAndar = Object.entries(andarAmounts).filter(([_, amt]) => amt && parseInt(amt) >= 10);
  const activeBahar = Object.entries(baharAmounts).filter(([_, amt]) => amt && parseInt(amt) >= 10);
  const harufTotal = [...activeAndar, ...activeBahar].reduce((sum, [_, amt]) => sum + parseInt(amt), 0);

  // Grand total
  const totalAmount = jantriTotal + harufTotal + (crossBetAmount >= 10 ? crossTotal : 0);
  const totalPotentialWin = (jantriTotal * 90) + (harufTotal * 9) + (crossBetAmount >= 10 ? crossPotentialWin : 0);
  const totalBetCount = activeBets.length + activeAndar.length + activeBahar.length + (crossBetAmount >= 10 ? crossJodis.length : 0);

  const handlePlaceBatchBets = async () => {
    if (!bettingOpen) {
      toast.error('बेटिंग बंद है!');
      return;
    }

    if (totalBetCount === 0) {
      toast.error('कम से कम एक नंबर पर राशि डालें');
      return;
    }

    if (totalAmount > (user?.balance || 0)) {
      toast.error(`अपर्याप्त बैलेंस! कुल बेट: ₹${totalAmount}, बैलेंस: ₹${user?.balance?.toFixed(2)}`);
      return;
    }

    setPlacing(true);

    try {
      const requests = [];

      // Jantri (jodi) bets
      if (activeBets.length > 0) {
        requests.push(
          axios.post(`${API_URL}/api/bets/batch`, {
            game_id: gameId,
            bet_type: 'jodi',
            bets: activeBets.map(([number, amount]) => ({ number, amount: parseInt(amount) }))
          }, { withCredentials: true })
        );
      }

      // Haruf Andar bets
      if (activeAndar.length > 0) {
        requests.push(
          axios.post(`${API_URL}/api/bets/batch`, {
            game_id: gameId,
            bet_type: 'haruf_andar',
            bets: activeAndar.map(([number, amount]) => ({ number, amount: parseInt(amount) }))
          }, { withCredentials: true })
        );
      }

      // Haruf Bahar bets
      if (activeBahar.length > 0) {
        requests.push(
          axios.post(`${API_URL}/api/bets/batch`, {
            game_id: gameId,
            bet_type: 'haruf_bahar',
            bets: activeBahar.map(([number, amount]) => ({ number, amount: parseInt(amount) }))
          }, { withCredentials: true })
        );
      }

      // Cross bets (jodi type)
      if (crossJodis.length > 0 && crossBetAmount >= 10) {
        requests.push(
          axios.post(`${API_URL}/api/bets/batch`, {
            game_id: gameId,
            bet_type: 'jodi',
            bets: crossJodis.map(number => ({ number, amount: crossBetAmount }))
          }, { withCredentials: true })
        );
      }

      await Promise.all(requests);

      toast.success(`${totalBetCount} बेट्स लगाई गईं! कुल: ₹${totalAmount}`);
      setJantriAmounts({});
      setAndarAmounts({});
      setBaharAmounts({});
      setCrossDigits([]);
      setCrossAmount('');
      await refreshUser();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'बेट नहीं लग पाई');
    } finally {
      setPlacing(false);
    }
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
                <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all" data-testid="back-button">
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
              <span className="text-white font-semibold" data-testid="user-balance">₹{user?.balance?.toFixed(2) || '0.00'}</span>
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

        {/* Tab Toggle - Jantri / Haruf / Cross */}
        <div className="grid grid-cols-3 gap-3 mb-6" data-testid="bet-type-tabs">
          <button
            onClick={() => setActiveTab('jantri')}
            data-testid="tab-jantri"
            className={`py-3 rounded-xl font-bold text-center transition-all ${
              activeTab === 'jantri'
                ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black shadow-lg shadow-[#D4AF37]/20'
                : 'bg-[#141418] text-gray-400 border border-white/10 hover:border-[#D4AF37]/50'
            }`}
          >
            <span className="text-base">जंतरी बेट</span>
            {activeBets.length > 0 && (
              <span className="ml-1 text-xs bg-black/30 px-2 py-0.5 rounded-full">{activeBets.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('haruf')}
            data-testid="tab-haruf"
            className={`py-3 rounded-xl font-bold text-center transition-all ${
              activeTab === 'haruf'
                ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black shadow-lg shadow-[#D4AF37]/20'
                : 'bg-[#141418] text-gray-400 border border-white/10 hover:border-[#D4AF37]/50'
            }`}
          >
            <span className="text-base">हरूफ बेट</span>
            {(activeAndar.length + activeBahar.length) > 0 && (
              <span className="ml-1 text-xs bg-black/30 px-2 py-0.5 rounded-full">{activeAndar.length + activeBahar.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('cross')}
            data-testid="tab-cross"
            className={`py-3 rounded-xl font-bold text-center transition-all ${
              activeTab === 'cross'
                ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black shadow-lg shadow-[#D4AF37]/20'
                : 'bg-[#141418] text-gray-400 border border-white/10 hover:border-[#D4AF37]/50'
            }`}
          >
            <span className="text-base">क्रॉस बेट</span>
            {crossJodis.length > 0 && crossBetAmount >= 10 && (
              <span className="ml-1 text-xs bg-black/30 px-2 py-0.5 rounded-full">{crossJodis.length}</span>
            )}
          </button>
        </div>

        {/* Jantri Betting Grid */}
        {activeTab === 'jantri' && (
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-['Unbounded'] text-lg">
                जंतरी - जोड़ी बेट (00-99)
              </CardTitle>
              {activeBets.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllAmounts}
                  data-testid="clear-all-bets"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  सब हटाओ
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Jantri Grid - 10x10 */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {ALL_JODIS.map((jodi) => {
                const hasAmount = jantriAmounts[jodi] && parseInt(jantriAmounts[jodi]) >= 10;
                return (
                  <div
                    key={jodi}
                    className={`rounded-lg border transition-all ${
                      hasAmount
                        ? 'border-[#D4AF37]/70 bg-[#D4AF37]/10'
                        : 'border-white/10 bg-[#0A0A0C]'
                    }`}
                  >
                    <button
                      onClick={() => handleSetQuickAmount(jodi)}
                      data-testid={`jantri-jodi-${jodi}`}
                      className={`w-full pt-2 pb-1 text-center font-bold text-lg transition-all ${
                        hasAmount ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'
                      }`}
                    >
                      {jodi}
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="₹"
                      value={jantriAmounts[jodi] || ''}
                      onChange={(e) => handleJantriAmountChange(jodi, e.target.value)}
                      data-testid={`jantri-amount-${jodi}`}
                      className="w-full bg-transparent border-t border-white/5 text-center text-xs py-1 text-emerald-400 placeholder-gray-600 outline-none focus:border-[#D4AF37]/50"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Haruf Andar Bahar Section */}
        {activeTab === 'haruf' && (
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-['Unbounded'] text-lg">
                हरूफ अंदर / बाहर (0-9)
              </CardTitle>
              {(activeAndar.length > 0 || activeBahar.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHarufAmounts}
                  data-testid="clear-haruf-bets"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  हटाओ
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Andar Panel */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <h3 className="text-blue-400 font-bold text-base">अंदर (पहला अंक)</h3>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[0,1,2,3,4,5,6,7,8,9].map((num) => {
                    const numStr = String(num);
                    const hasAmount = andarAmounts[numStr] && parseInt(andarAmounts[numStr]) >= 10;
                    return (
                      <div
                        key={`andar-${num}`}
                        className={`rounded-lg border transition-all ${
                          hasAmount
                            ? 'border-blue-500/70 bg-blue-500/10'
                            : 'border-white/10 bg-[#0A0A0C]'
                        }`}
                      >
                        <button
                          onClick={() => handleSetHarufQuickAmount('andar', numStr)}
                          data-testid={`haruf-andar-${num}`}
                          className={`w-full pt-2 pb-1 text-center font-bold text-xl transition-all ${
                            hasAmount ? 'text-blue-400' : 'text-white hover:text-blue-400'
                          }`}
                        >
                          {num}
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="₹"
                          value={andarAmounts[numStr] || ''}
                          onChange={(e) => handleHarufAmountChange('andar', numStr, e.target.value)}
                          data-testid={`haruf-andar-amount-${num}`}
                          className="w-full bg-transparent border-t border-white/5 text-center text-xs py-1 text-emerald-400 placeholder-gray-600 outline-none focus:border-blue-500/50"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bahar Panel */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <h3 className="text-orange-400 font-bold text-base">बाहर (दूसरा अंक)</h3>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[0,1,2,3,4,5,6,7,8,9].map((num) => {
                    const numStr = String(num);
                    const hasAmount = baharAmounts[numStr] && parseInt(baharAmounts[numStr]) >= 10;
                    return (
                      <div
                        key={`bahar-${num}`}
                        className={`rounded-lg border transition-all ${
                          hasAmount
                            ? 'border-orange-500/70 bg-orange-500/10'
                            : 'border-white/10 bg-[#0A0A0C]'
                        }`}
                      >
                        <button
                          onClick={() => handleSetHarufQuickAmount('bahar', numStr)}
                          data-testid={`haruf-bahar-${num}`}
                          className={`w-full pt-2 pb-1 text-center font-bold text-xl transition-all ${
                            hasAmount ? 'text-orange-400' : 'text-white hover:text-orange-400'
                          }`}
                        >
                          {num}
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="₹"
                          value={baharAmounts[numStr] || ''}
                          onChange={(e) => handleHarufAmountChange('bahar', numStr, e.target.value)}
                          data-testid={`haruf-bahar-amount-${num}`}
                          className="w-full bg-transparent border-t border-white/5 text-center text-xs py-1 text-emerald-400 placeholder-gray-600 outline-none focus:border-orange-500/50"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Cross Bet Section */}
        {activeTab === 'cross' && (
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-['Unbounded'] text-lg">
                क्रॉस बेट
              </CardTitle>
              {crossDigits.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCrossBet}
                  data-testid="clear-cross-bets"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  हटाओ
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Digit Selection */}
            <p className="text-gray-400 text-sm mb-3">नंबर चुनें (कम से कम 2)</p>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {[0,1,2,3,4,5,6,7,8,9].map((num) => {
                const isSelected = crossDigits.includes(num);
                return (
                  <button
                    key={`cross-${num}`}
                    onClick={() => toggleCrossDigit(num)}
                    data-testid={`cross-digit-${num}`}
                    className={`py-4 rounded-xl text-2xl font-bold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#FDE047] text-black shadow-lg shadow-[#D4AF37]/20'
                        : 'bg-[#0A0A0C] text-white border border-white/10 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-2">प्रति जोड़ी राशि (₹)</p>
              <Input
                type="number"
                placeholder="हर जोड़ी पर कितना लगाना है"
                value={crossAmount}
                onChange={(e) => setCrossAmount(e.target.value)}
                data-testid="cross-amount-input"
                className="bg-[#0A0A0C] border-white/10 text-white h-12 text-lg"
              />
            </div>

            {/* Generated Jodis Preview */}
            {crossJodis.length > 0 && (
              <div className="p-4 bg-[#0A0A0C] rounded-xl border border-white/10">
                <p className="text-gray-400 text-sm mb-3">
                  बनी जोड़ियां ({crossJodis.length})
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {crossJodis.map((jodi) => (
                    <span
                      key={jodi}
                      data-testid={`cross-jodi-${jodi}`}
                      className="px-3 py-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg text-[#D4AF37] font-bold text-sm"
                    >
                      {jodi}
                    </span>
                  ))}
                </div>
                {crossBetAmount >= 10 && (
                  <div className="text-sm">
                    <span className="text-gray-400">कुल राशि: </span>
                    <span className="text-[#D4AF37] font-bold">₹{crossTotal}</span>
                  </div>
                )}
              </div>
            )}

            {crossDigits.length < 2 && (
              <p className="text-gray-500 text-sm text-center mt-2">
                कम से कम 2 नंबर चुनें - सभी क्रॉस जोड़ियां बनेंगी
              </p>
            )}
          </CardContent>
        </Card>
        )}

        {/* Sticky Bottom Bar - Bet Summary (Always Visible) */}
          <div className="fixed bottom-[52px] left-0 right-0 z-50 glass border-t border-white/10 p-4" data-testid="bet-summary-bar">
            <div className="container mx-auto max-w-screen-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-gray-400 text-xs">बेट्स</p>
                    <p className="text-white font-bold text-lg" data-testid="total-jodis">{totalBetCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">कुल राशि</p>
                    <p className="text-[#D4AF37] font-bold text-lg" data-testid="total-amount">₹{totalAmount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => { setJantriAmounts({}); setAndarAmounts({}); setBaharAmounts({}); setCrossDigits([]); setCrossAmount(''); }}
                    disabled={totalBetCount === 0}
                    data-testid="delete-all-bets-button"
                    variant="outline"
                    className="h-12 px-4 border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                  <Button
                    onClick={handlePlaceBatchBets}
                    disabled={placing || !bettingOpen || totalBetCount === 0}
                    data-testid="place-batch-bet-button"
                    className="h-12 px-8 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold text-base disabled:opacity-50"
                  >
                  {!bettingOpen ? (
                    <span className="flex items-center gap-2"><Lock className="w-5 h-5" /> बंद</span>
                  ) : placing ? (
                    <span className="flex items-center gap-2"><Coins className="w-5 h-5 animate-spin" /> लग रही है...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Send className="w-5 h-5" /> Play</span>
                  )}
                </Button>
                </div>
              </div>
            </div>
          </div>
      </main>

      <FooterNav />
    </div>
  );
};

export default GamePage;
