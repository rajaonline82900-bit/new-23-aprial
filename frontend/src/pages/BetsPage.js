import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, Coins, Filter, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const BetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gameFilter, setGameFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [games, setGames] = useState([]);

  const fetchBets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (gameFilter !== 'all') params.append('game_id', gameFilter);
      if (dateFilter) params.append('date', dateFilter);
      
      const { data } = await axios.get(`${API_URL}/api/bets?${params.toString()}`, { withCredentials: true });
      setBets(data.bets);
    } catch (error) {
      toast.error('बेट्स लोड नहीं हो पाई');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, gameFilter, dateFilter]);

  const fetchGames = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/games`);
      setGames(data.games);
    } catch (e) {}
  };

  useEffect(() => { fetchGames(); }, []);
  useEffect(() => { fetchBets(); }, [fetchBets]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'won':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3 mr-1" /> जीता</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> हारा</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" /> लंबित</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">{status}</Badge>;
    }
  };

  const stats = {
    total: bets.length,
    won: bets.filter(b => b.status === 'won').length,
    lost: bets.filter(b => b.status === 'lost').length,
    pending: bets.filter(b => b.status === 'pending').length,
    totalWinnings: bets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.won_amount || 0), 0)
  };

  const statusTabs = [
    { key: 'all', label: 'सभी' },
    { key: 'pending', label: 'लंबित' },
    { key: 'won', label: 'जीती' },
    { key: 'lost', label: 'हारी' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0C] pb-20">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-xl font-bold text-white font-['Unbounded']">मेरी बेट्स</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-3 text-center">
              <p className="text-gray-400 text-xs">कुल बेट्स</p>
              <p className="text-xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-3 text-center">
              <p className="text-gray-400 text-xs">जीती</p>
              <p className="text-xl font-bold text-emerald-400">{stats.won}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-3 text-center">
              <p className="text-gray-400 text-xs">हारी</p>
              <p className="text-xl font-bold text-red-400">{stats.lost}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] border-[#D4AF37]/30">
            <CardContent className="p-3 text-center">
              <p className="text-gray-400 text-xs">कुल जीत</p>
              <p className="text-xl font-bold text-[#D4AF37]">₹{stats.totalWinnings}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Filter className="w-4 h-4" />
              <span>फ़िल्टर</span>
            </div>
            
            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {statusTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  data-testid={`bet-filter-${tab.key}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    statusFilter === tab.key
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-[#0A0A0C] text-gray-400 border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Game + Date Filter */}
            <div className="flex gap-2">
              <select
                value={gameFilter}
                onChange={(e) => setGameFilter(e.target.value)}
                data-testid="bet-filter-game"
                className="flex-1 bg-[#0A0A0C] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#D4AF37] outline-none"
              >
                <option value="all">सभी गेम</option>
                {games.map(g => (
                  <option key={g.id} value={g.id}>{g.name_hi || g.name}</option>
                ))}
              </select>
              
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  data-testid="bet-filter-date"
                  className="bg-[#0A0A0C] border-white/10 text-white pl-9 text-sm"
                />
              </div>
            </div>
            
            {(gameFilter !== 'all' || dateFilter || statusFilter !== 'all') && (
              <button
                onClick={() => { setGameFilter('all'); setDateFilter(''); setStatusFilter('all'); }}
                data-testid="bet-filter-clear"
                className="text-[#D4AF37] text-xs hover:underline"
              >
                सभी फ़िल्टर हटाएं
              </button>
            )}
          </CardContent>
        </Card>

        {/* Bets List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bets.length === 0 ? (
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-8 text-center">
              <Coins className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">कोई बेट नहीं मिली</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bets.map((bet, index) => (
              <Card 
                key={index} 
                data-testid={`bet-card-${index}`}
                className={`bg-[#141418] border-white/10 ${
                  bet.status === 'won' ? 'border-l-4 border-l-emerald-500' : 
                  bet.status === 'lost' ? 'border-l-4 border-l-red-500' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] flex items-center justify-center border border-[#D4AF37]/30">
                        <span className="text-xl font-bold text-[#D4AF37]">{bet.number}</span>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">{bet.game_name}</h4>
                        <p className="text-gray-400 text-sm">
                          {bet.bet_type === 'single' ? 'एकल' : bet.bet_type === 'jodi' ? 'जोड़ी' : bet.bet_type}
                        </p>
                        <p className="text-gray-500 text-[10px]">
                          {utcDate(bet.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })} • {utcDate(bet.created_at).toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(bet.status)}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div>
                      <p className="text-gray-400 text-xs">बेट राशि</p>
                      <p className="text-white font-semibold">₹{bet.amount}</p>
                    </div>
                    {bet.status === 'won' && (
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">जीत</p>
                        <p className="font-bold text-emerald-400">₹{bet.won_amount}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <FooterNav />
    </div>
  );
};

export default BetsPage;
