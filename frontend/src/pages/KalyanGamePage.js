import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Dice5, Spade, Layers, Gem, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const BET_TYPES = [
  { key: 'single_ank', name: 'Single Ank', rate: '1 × 9.5', icon: Dice5, format: 'single digit (0-9)' },
  { key: 'kalyan_jodi', name: 'Jodi', rate: '1 × 95', icon: Dice5, format: '2 digits (00-99)', close_only: true },
  { key: 'single_panna', name: 'Single Panna', rate: '1 × 140', icon: Spade, format: '3 unique digits' },
  { key: 'double_panna', name: 'Double Panna', rate: '1 × 280', icon: Layers, format: '3 digits, 2 same' },
  { key: 'triple_panna', name: 'Triple Panna', rate: '1 × 700', icon: Layers, format: '3 same digits' },
  { key: 'half_sangam', name: 'Half Sangam', rate: '1 × 1000', icon: Gem, format: 'A-BCD or ABC-D', close_only: true },
  { key: 'full_sangam', name: 'Full Sangam', rate: '1 × 10000', icon: Coins, format: 'ABC-DEF', close_only: true },
];

// Valid panna combinations for validation hints
const categorizePanna = (p) => {
  if (!/^\d{3}$/.test(p)) return '';
  const unique = new Set(p.split('')).size;
  if (unique === 3) return 'single_panna';
  if (unique === 1) return 'triple_panna';
  return 'double_panna';
};

const KalyanGamePage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [game, setGame] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [session, setSession] = useState('open');
  const [digit, setDigit] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayResult, setTodayResult] = useState(null);
  const [myBets, setMyBets] = useState([]);

  useEffect(() => {
    fetchGame();
    fetchResult();
    fetchBets();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const { data } = await axios.get(`${API}/api/games`, { withCredentials: true });
      const g = (data.games || []).find(x => x.id === gameId);
      setGame(g);
    } catch (e) { console.error(e); }
  };
  const fetchResult = async () => {
    try {
      const { data } = await axios.get(`${API}/api/kalyan/today/${gameId}`, { withCredentials: true });
      setTodayResult(data.result);
    } catch (e) { console.error(e); }
  };
  const fetchBets = async () => {
    try {
      const { data } = await axios.get(`${API}/api/kalyan/my-bets?game_id=${gameId}&date=${todayStr()}`, { withCredentials: true });
      setMyBets(data.bets || []);
    } catch (e) { console.error(e); }
  };

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const placeBet = async () => {
    if (!selectedType) return;
    if (!digit.trim()) { toast.error('Digit enter karo'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 10) { toast.error('Minimum bet ₹10'); return; }

    // Client-side format validation
    if (selectedType === 'single_ank' && !/^\d$/.test(digit)) { toast.error('Single digit (0-9) chahiye'); return; }
    if (selectedType === 'kalyan_jodi' && !/^\d{2}$/.test(digit)) { toast.error('2 digit jodi chahiye'); return; }
    if (['single_panna', 'double_panna', 'triple_panna'].includes(selectedType)) {
      if (!/^\d{3}$/.test(digit)) { toast.error('3 digit panna chahiye'); return; }
      if (categorizePanna(digit) !== selectedType) { toast.error(`Ye ${selectedType.replace('_', ' ')} nahi hai`); return; }
    }
    if (selectedType === 'half_sangam' && !/^(\d-\d{3}|\d{3}-\d)$/.test(digit)) { toast.error('Format: A-BCD or ABC-D'); return; }
    if (selectedType === 'full_sangam' && !/^\d{3}-\d{3}$/.test(digit)) { toast.error('Format: ABC-DEF'); return; }

    setLoading(true);
    try {
      await axios.post(`${API}/api/kalyan/bet`, {
        game_id: gameId, bet_type: selectedType, session, digit, amount: amt, date: todayStr()
      }, { withCredentials: true });
      toast.success(`Bet lag gayi ₹${amt}`);
      setDigit(''); setAmount('');
      await refreshUser();
      fetchBets();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bet fail');
    } finally {
      setLoading(false);
    }
  };

  const currentType = BET_TYPES.find(t => t.key === selectedType);
  const sessionDisabled = currentType?.close_only;

  useEffect(() => {
    if (sessionDisabled) setSession('close');
  }, [selectedType, sessionDisabled]);

  if (!game) return (
    <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0C] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#D4AF37] to-[#B8941E] px-3 py-4 flex items-center gap-3 shadow-lg">
        <button onClick={() => navigate('/dashboard')} className="text-black" data-testid="kalyan-back">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-black font-black text-lg uppercase tracking-wide">{game.name}</h1>
          <p className="text-black/70 text-xs">{game.display_time}</p>
        </div>
        <div className="text-right">
          <p className="text-black/70 text-[10px]">Balance</p>
          <p className="text-black font-black text-sm">₹{(user?.balance || 0).toFixed(0)}</p>
        </div>
      </div>

      {/* Today result strip */}
      <div className="bg-[#141418] border-b border-white/10 px-3 py-3">
        <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">Today's Result</p>
        <p className="text-white font-black text-xl font-mono tracking-widest" data-testid="kalyan-today-result">
          {todayResult?.open_panna || 'XXX'}-{todayResult?.jodi || (todayResult?.open_ank ? `${todayResult.open_ank}*` : 'XX')}-{todayResult?.close_panna || 'XXX'}
        </p>
      </div>

      {/* Bet Types Grid */}
      {!selectedType && (
        <div className="p-3 space-y-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Game Chunein</p>
          <div className="grid grid-cols-2 gap-3">
            {BET_TYPES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setSelectedType(t.key)}
                  data-testid={`kalyan-bet-type-${t.key}`}
                  className="relative group bg-gradient-to-br from-[#1a1410] to-[#241a12] border border-[#D4AF37]/30 rounded-2xl p-4 hover:border-[#D4AF37] transition-all active:scale-95"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FDE047] to-[#D4AF37] flex items-center justify-center shadow-lg">
                      <Icon className="w-6 h-6 text-black" />
                    </div>
                    <p className="text-white font-bold text-sm text-center">{t.name}</p>
                    <p className="text-[#D4AF37] text-[10px] font-bold">{t.rate}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* My bets today */}
          {myBets.length > 0 && (
            <div className="mt-6">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Aaj Ki Bets ({myBets.length})</p>
              <div className="space-y-2">
                {myBets.map(b => (
                  <div key={b.id} className="bg-[#141418] border border-white/10 rounded-xl p-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-white font-bold text-xs">{BET_TYPES.find(t => t.key === b.bet_type)?.name || b.bet_type}</p>
                      <p className="text-gray-400 text-[10px]">{b.session} • {b.digit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#D4AF37] font-bold">₹{b.amount}</p>
                      <p className={`text-[10px] font-bold ${b.status === 'won' ? 'text-green-400' : b.status === 'lost' ? 'text-red-400' : b.status === 'reversed' ? 'text-orange-400' : 'text-gray-400'}`}>
                        {b.status.toUpperCase()}{b.status === 'won' ? ` +₹${b.payout}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bet Form */}
      {selectedType && currentType && (
        <div className="p-4 space-y-5">
          <button onClick={() => setSelectedType(null)} className="text-[#D4AF37] text-sm flex items-center gap-1" data-testid="kalyan-bet-back">
            <ArrowLeft className="w-4 h-4" /> वापस
          </button>

          <div className="text-center">
            <h2 className="text-white text-xl font-black">{currentType.name}</h2>
            <p className="text-[#D4AF37] text-xs font-bold mt-1">Rate: {currentType.rate}</p>
            <p className="text-gray-500 text-[10px] mt-1">Format: {currentType.format}</p>
          </div>

          {/* Session selector */}
          <div>
            <p className="text-gray-400 text-xs mb-2">Choose Session</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => !sessionDisabled && setSession('open')}
                disabled={sessionDisabled}
                data-testid="kalyan-session-open"
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                  session === 'open' && !sessionDisabled
                    ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                    : sessionDisabled ? 'bg-[#141418] text-gray-600 border-white/5 cursor-not-allowed' : 'bg-[#141418] text-gray-400 border-white/10'
                }`}
              >OPEN</button>
              <button
                onClick={() => setSession('close')}
                data-testid="kalyan-session-close"
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                  session === 'close' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-[#141418] text-gray-400 border-white/10'
                }`}
              >CLOSE</button>
            </div>
            {sessionDisabled && <p className="text-gray-500 text-[10px] mt-1">Ye bet type sirf Close session me hota hai</p>}
          </div>

          {/* Digit input */}
          <div>
            <p className="text-gray-400 text-xs mb-2">Enter Digit</p>
            <input
              type="text"
              value={digit}
              onChange={e => setDigit(e.target.value.toUpperCase().replace(/[^0-9\-]/g, ''))}
              placeholder={currentType.format}
              data-testid="kalyan-digit-input"
              className="w-full bg-[#141418] border-2 border-white/10 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white font-mono text-lg tracking-widest outline-none"
            />
          </div>

          {/* Amount */}
          <div>
            <p className="text-gray-400 text-xs mb-2">Enter Amount (₹)</p>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Minimum ₹10"
              data-testid="kalyan-amount-input"
              className="w-full bg-[#141418] border-2 border-white/10 focus:border-[#D4AF37] rounded-xl px-4 py-3 text-white font-bold text-lg outline-none"
            />
            <div className="flex gap-2 mt-2">
              {[10, 50, 100, 500].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} data-testid={`kalyan-quick-${v}`}
                  className="flex-1 py-2 rounded-lg bg-[#141418] border border-white/10 text-gray-300 text-xs hover:border-[#D4AF37]/50">
                  ₹{v}
                </button>
              ))}
            </div>
          </div>

          {/* Win preview */}
          {amount && parseFloat(amount) >= 10 && (
            <div className="bg-gradient-to-r from-[#D4AF37]/20 to-transparent border border-[#D4AF37]/30 rounded-xl p-3">
              <p className="text-gray-400 text-[10px] uppercase">Jeetne par milega</p>
              <p className="text-[#D4AF37] font-black text-xl">
                ₹{(parseFloat(amount) * (parseFloat(currentType.rate.split('× ')[1]) || 0)).toFixed(0)}
              </p>
            </div>
          )}

          <button
            onClick={placeBet}
            disabled={loading}
            data-testid="kalyan-submit-bet"
            className="w-full py-4 rounded-xl font-black text-black text-base tracking-wide disabled:opacity-50 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #FDE047 0%, #D4AF37 100%)', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }}
          >
            {loading ? 'Submitting...' : 'Submit Bet'}
          </button>
        </div>
      )}
    </div>
  );
};

export default KalyanGamePage;
