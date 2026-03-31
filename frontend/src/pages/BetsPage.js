import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  ArrowLeft, 
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  Coins
} from 'lucide-react';
import { toast } from 'sonner';

import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BetsPage = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchBets();
  }, []);

  const fetchBets = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/bets`, { withCredentials: true });
      setBets(data.bets);
    } catch (error) {
      toast.error('बेट्स लोड नहीं हो पाई');
    } finally {
      setLoading(false);
    }
  };

  const filteredBets = bets.filter(bet => {
    if (filter === 'all') return true;
    return bet.status === filter;
  });

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

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
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

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4 text-center">
              <p className="text-gray-400 text-sm">कुल बेट्स</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4 text-center">
              <p className="text-gray-400 text-sm">जीती</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.won}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4 text-center">
              <p className="text-gray-400 text-sm">हारी</p>
              <p className="text-2xl font-bold text-red-400">{stats.lost}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] border-[#D4AF37]/30">
            <CardContent className="p-4 text-center">
              <p className="text-gray-400 text-sm">कुल जीत</p>
              <p className="text-2xl font-bold text-[#D4AF37]">₹{stats.totalWinnings}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-[#141418] border border-white/10">
            <TabsTrigger 
              value="all"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              सभी
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              लंबित
            </TabsTrigger>
            <TabsTrigger 
              value="won"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              जीती
            </TabsTrigger>
            <TabsTrigger 
              value="lost"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              हारी
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Bets List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBets.length === 0 ? (
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-8 text-center">
              <Coins className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">कोई बेट नहीं मिली</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBets.map((bet, index) => (
              <Card 
                key={index} 
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
                          {bet.bet_type === 'single' ? 'एकल' : 'जोड़ी'} • {bet.date}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(bet.status)}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div>
                      <p className="text-gray-400 text-sm">बेट राशि</p>
                      <p className="text-white font-semibold">₹{bet.amount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">
                        {bet.status === 'won' ? 'जीत' : 'संभावित जीत'}
                      </p>
                      <p className={`font-bold ${
                        bet.status === 'won' ? 'text-emerald-400' : 'text-[#D4AF37]'
                      }`}>
                        ₹{bet.status === 'won' ? bet.won_amount : bet.potential_win}
                      </p>
                    </div>
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
