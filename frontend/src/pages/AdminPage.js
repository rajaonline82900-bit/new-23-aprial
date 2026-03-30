import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  ArrowLeft, 
  Shield,
  Users,
  Trophy,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  CalendarIcon,
  Loader2,
  BarChart3,
  Eye,
  Plus,
  Minus,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GAMES = [
  { id: 'delhi_bazaar', name: 'दिल्ली बाजार' },
  { id: 'shri_ganesh', name: 'श्री गणेश' },
  { id: 'faridabad', name: 'फरीदाबाद' },
  { id: 'ghaziabad', name: 'गाजियाबाद' },
  { id: 'gali', name: 'गली' },
  { id: 'disawar', name: 'दिसावर' }
];

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('results');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Result declaration state
  const [selectedGame, setSelectedGame] = useState('');
  const [resultDate, setResultDate] = useState(new Date());
  const [jodiResult, setJodiResult] = useState('');
  const [declaring, setDeclaring] = useState(false);

  // User detail modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userDetailTab, setUserDetailTab] = useState('deposits');
  const [userDetails, setUserDetails] = useState({
    deposits: [],
    withdrawals: [],
    bets: [],
    winnings: [],
    stats: {}
  });
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Wallet adjustment state
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState('add');
  const [walletReason, setWalletReason] = useState('');
  const [adjustingWallet, setAdjustingWallet] = useState(false);

  // Jantri Report state
  const [jantriData, setJantriData] = useState([]);
  const [jantriGameFilter, setJantriGameFilter] = useState('all');
  const [jantriDays, setJantriDays] = useState(30);
  const [loadingJantri, setLoadingJantri] = useState(false);
  const [gameNames, setGameNames] = useState({});

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'jantri') {
      fetchJantri();
    }
  }, [activeTab, jantriGameFilter, jantriDays]);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, withdrawalsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/withdrawals`, { withCredentials: true })
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setWithdrawals(withdrawalsRes.data.withdrawals);
    } catch (error) {
      toast.error('डेटा लोड नहीं हो पाया');
    } finally {
      setLoading(false);
    }
  };

  const fetchJantri = async () => {
    setLoadingJantri(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/jantri`, {
        params: { game_id: jantriGameFilter, days: jantriDays },
        withCredentials: true
      });
      setJantriData(data.jantri);
      setGameNames(data.game_names);
    } catch (error) {
      toast.error('Jantri data load नहीं हो पाया');
    } finally {
      setLoadingJantri(false);
    }
  };

  const handleDeclareResult = async () => {
    if (!selectedGame) {
      toast.error('कृपया गेम चुनें');
      return;
    }
    
    if (!jodiResult || !jodiResult.match(/^[0-9]{2}$/)) {
      toast.error('जोड़ी रिजल्ट 00-99 होना चाहिए');
      return;
    }

    setDeclaring(true);

    try {
      const { data } = await axios.post(`${API_URL}/api/admin/results`, {
        game_id: selectedGame,
        date: format(resultDate, 'yyyy-MM-dd'),
        jodi_result: jodiResult
      }, { withCredentials: true });

      toast.success(`रिजल्ट घोषित! ${data.winners.single} एकल और ${data.winners.jodi} जोड़ी विजेता`);
      
      setSelectedGame('');
      setJodiResult('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'रिजल्ट घोषित नहीं हो पाया');
    } finally {
      setDeclaring(false);
    }
  };

  const handleWithdrawalAction = async (id, action) => {
    try {
      await axios.post(`${API_URL}/api/admin/withdrawals/${id}/${action}`, {}, { withCredentials: true });
      toast.success(action === 'approve' ? 'निकासी स्वीकृत' : 'निकासी अस्वीकृत और राशि वापस');
      fetchData();
    } catch (error) {
      toast.error('कार्रवाई विफल');
    }
  };

  const openUserDetails = async (u) => {
    setSelectedUser(u);
    setUserModalOpen(true);
    setLoadingUserDetails(true);
    setUserDetailTab('deposits');

    try {
      const [depositsRes, withdrawalsRes, betsRes, winningsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users/${u._id}/deposits`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/withdrawals`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/bets`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/winnings`, { withCredentials: true })
      ]);

      setUserDetails({
        deposits: depositsRes.data.deposits,
        totalDeposited: depositsRes.data.total_deposited,
        withdrawals: withdrawalsRes.data.withdrawals,
        totalWithdrawn: withdrawalsRes.data.total_withdrawn,
        pendingWithdrawal: withdrawalsRes.data.pending_amount,
        bets: betsRes.data.bets,
        betStats: betsRes.data.stats,
        winnings: winningsRes.data.winnings,
        totalWinnings: winningsRes.data.total_winnings
      });
    } catch (error) {
      toast.error('User details load नहीं हो पाए');
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const handleWalletAdjustment = async () => {
    if (!walletAmount || parseFloat(walletAmount) <= 0) {
      toast.error('Valid amount दर्ज करें');
      return;
    }

    if (!walletReason) {
      toast.error('Reason दर्ज करें');
      return;
    }

    setAdjustingWallet(true);

    try {
      const { data } = await axios.post(`${API_URL}/api/admin/users/${selectedUser._id}/wallet`, {
        amount: parseFloat(walletAmount),
        type: walletType,
        reason: walletReason
      }, { withCredentials: true });

      toast.success(data.message);
      setWalletModalOpen(false);
      setWalletAmount('');
      setWalletReason('');
      
      // Update user in list
      setUsers(prev => prev.map(u => 
        u._id === selectedUser._id 
          ? { ...u, balance: data.new_balance }
          : u
      ));
      
      // Update selected user
      setSelectedUser(prev => ({ ...prev, balance: data.new_balance }));
      
      // Refresh user details
      openUserDetails({ ...selectedUser, balance: data.new_balance });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Wallet adjustment failed');
    } finally {
      setAdjustingWallet(false);
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
                <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-[#D4AF37]" />
                <h1 className="text-xl font-bold text-white font-['Unbounded']">Admin Panel</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">कुल यूजर्स</p>
                  <p className="text-xl font-bold text-white">{stats?.total_users || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">कुल बेट्स</p>
                  <p className="text-xl font-bold text-white">{stats?.total_bets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">आज की बेट्स</p>
                  <p className="text-xl font-bold text-white">{stats?.today_bets || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">लंबित निकासी</p>
                  <p className="text-xl font-bold text-white">{stats?.pending_withdrawals || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-[#141418] border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">आज का जमा</p>
                  <p className="text-xl font-bold text-emerald-400">₹{stats?.today_deposit_amount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-500/10 to-[#141418] border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">आज की निकासी</p>
                  <p className="text-xl font-bold text-red-400">₹{stats?.today_withdrawal_amount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-[#141418] border-[#D4AF37]/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">कुल जमा</p>
                  <p className="text-xl font-bold text-[#D4AF37]">₹{stats?.total_deposit_amount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-[#141418] border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <History className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">कुल निकासी</p>
                  <p className="text-xl font-bold text-purple-400">₹{stats?.total_withdrawal_amount || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#141418] border border-white/10 mb-6">
            <TabsTrigger 
              value="results"
              data-testid="admin-results-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              रिजल्ट घोषणा
            </TabsTrigger>
            <TabsTrigger 
              value="jantri"
              data-testid="admin-jantri-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              जंत्री रिपोर्ट
            </TabsTrigger>
            <TabsTrigger 
              value="withdrawals"
              data-testid="admin-withdrawals-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              निकासी अनुरोध
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              data-testid="admin-users-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              यूजर्स
            </TabsTrigger>
          </TabsList>

          {/* Results Tab */}
          <TabsContent value="results">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <CardTitle className="text-white font-['Unbounded']">नया रिजल्ट घोषित करें</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300 mb-2 block">गेम चुनें</Label>
                    <Select value={selectedGame} onValueChange={setSelectedGame}>
                      <SelectTrigger 
                        data-testid="admin-game-select"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      >
                        <SelectValue placeholder="गेम चुनें" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141418] border-white/10">
                        {GAMES.map((game) => (
                          <SelectItem key={game.id} value={game.id} className="text-white hover:bg-white/10">
                            {game.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-gray-300 mb-2 block">तारीख</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          data-testid="admin-date-picker"
                          className="w-full justify-start text-left bg-[#0A0A0C] border-white/10 text-white"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(resultDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#141418] border-white/10">
                        <Calendar
                          mode="single"
                          selected={resultDate}
                          onSelect={(date) => date && setResultDate(date)}
                          className="bg-[#141418]"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300 mb-2 block">जोड़ी रिजल्ट (00-99)</Label>
                  <Input
                    type="text"
                    maxLength={2}
                    placeholder="00-99"
                    value={jodiResult}
                    onChange={(e) => setJodiResult(e.target.value.replace(/[^0-9]/g, ''))}
                    data-testid="admin-jodi-result-input"
                    className="bg-[#0A0A0C] border-white/10 text-white text-center text-4xl h-20 font-bold"
                  />
                  <p className="text-gray-400 text-sm mt-2">
                    एकल रिजल्ट जोड़ी के आखिरी अंक से auto-calculate होगा
                  </p>
                </div>

                <Button
                  onClick={handleDeclareResult}
                  disabled={declaring}
                  data-testid="admin-declare-result-button"
                  className="w-full h-12 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
                >
                  {declaring ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      रिजल्ट घोषित हो रहा है...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      रिजल्ट घोषित करें
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jantri Report Tab */}
          <TabsContent value="jantri">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-white font-['Unbounded']">जंत्री रिपोर्ट</CardTitle>
                  <div className="flex gap-2">
                    <Select value={jantriGameFilter} onValueChange={setJantriGameFilter}>
                      <SelectTrigger className="w-40 bg-[#0A0A0C] border-white/10 text-white">
                        <SelectValue placeholder="सभी गेम्स" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141418] border-white/10">
                        <SelectItem value="all" className="text-white hover:bg-white/10">सभी गेम्स</SelectItem>
                        {GAMES.map((game) => (
                          <SelectItem key={game.id} value={game.id} className="text-white hover:bg-white/10">
                            {game.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(jantriDays)} onValueChange={(v) => setJantriDays(Number(v))}>
                      <SelectTrigger className="w-32 bg-[#0A0A0C] border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141418] border-white/10">
                        <SelectItem value="7" className="text-white hover:bg-white/10">7 दिन</SelectItem>
                        <SelectItem value="15" className="text-white hover:bg-white/10">15 दिन</SelectItem>
                        <SelectItem value="30" className="text-white hover:bg-white/10">30 दिन</SelectItem>
                        <SelectItem value="60" className="text-white hover:bg-white/10">60 दिन</SelectItem>
                        <SelectItem value="90" className="text-white hover:bg-white/10">90 दिन</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingJantri ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
                  </div>
                ) : jantriData.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">कोई रिजल्ट नहीं मिला</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left p-3 text-gray-400 font-medium">तारीख</th>
                          {(jantriGameFilter === 'all' ? GAMES : GAMES.filter(g => g.id === jantriGameFilter)).map((game) => (
                            <th key={game.id} className="text-center p-3 text-gray-400 font-medium min-w-[80px]">
                              {game.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jantriData.map((row, index) => (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                            <td className="p-3 text-white font-medium">{row.date}</td>
                            {(jantriGameFilter === 'all' ? GAMES : GAMES.filter(g => g.id === jantriGameFilter)).map((game) => (
                              <td key={game.id} className="text-center p-3">
                                {row.results[game.id] ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-2xl font-bold text-[#D4AF37]">
                                      {row.results[game.id].jodi}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      ({row.results[game.id].single})
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">--</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <CardTitle className="text-white font-['Unbounded']">लंबित निकासी अनुरोध</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">कोई लंबित निकासी नहीं</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {withdrawals.map((w, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5"
                      >
                        <div>
                          <p className="text-white font-medium">{w.user_name}</p>
                          <p className="text-gray-400 text-sm">{w.user_email}</p>
                          <p className="text-gray-400 text-sm">UPI: {w.upi_id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">₹{w.amount}</p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleWithdrawalAction(w.id, 'approve')}
                              data-testid={`approve-withdrawal-${w.id}`}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              स्वीकृत
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWithdrawalAction(w.id, 'reject')}
                              data-testid={`reject-withdrawal-${w.id}`}
                              className="border-red-500 text-red-500 hover:bg-red-500/10"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              अस्वीकृत
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <CardTitle className="text-white font-['Unbounded']">सभी यूजर्स</CardTitle>
                <CardDescription className="text-gray-400">
                  यूजर पर क्लिक करें details देखने के लिए
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((u, index) => (
                    <div
                      key={index}
                      onClick={() => openUserDetails(u)}
                      className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5 cursor-pointer hover:border-[#D4AF37]/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                          <span className="text-[#D4AF37] font-bold">{u.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{u.name}</p>
                          <p className="text-gray-400 text-sm">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge className={u.role === 'admin' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-gray-500/20 text-gray-400'}>
                            {u.role}
                          </Badge>
                          <p className="text-white font-semibold mt-1">₹{u.balance?.toFixed(2) || '0.00'}</p>
                        </div>
                        <Eye className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* User Details Modal */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded'] flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                <span className="text-[#D4AF37] font-bold text-xl">
                  {selectedUser?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p>{selectedUser?.name}</p>
                <p className="text-sm text-gray-400 font-normal">{selectedUser?.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingUserDetails ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : (
            <>
              {/* User Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center">
                  <p className="text-gray-400 text-xs">बैलेंस</p>
                  <p className="text-lg font-bold text-white">₹{selectedUser?.balance?.toFixed(2) || '0'}</p>
                </div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center">
                  <p className="text-gray-400 text-xs">कुल जमा</p>
                  <p className="text-lg font-bold text-emerald-400">₹{userDetails.totalDeposited || 0}</p>
                </div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center">
                  <p className="text-gray-400 text-xs">कुल निकासी</p>
                  <p className="text-lg font-bold text-red-400">₹{userDetails.totalWithdrawn || 0}</p>
                </div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center">
                  <p className="text-gray-400 text-xs">कुल जीत</p>
                  <p className="text-lg font-bold text-[#D4AF37]">₹{userDetails.totalWinnings || 0}</p>
                </div>
              </div>

              {/* Wallet Management Button */}
              <Button
                onClick={() => setWalletModalOpen(true)}
                className="w-full mb-4 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Wallet Management
              </Button>

              {/* Detail Tabs */}
              <Tabs value={userDetailTab} onValueChange={setUserDetailTab}>
                <TabsList className="bg-[#0A0A0C] border border-white/10 w-full grid grid-cols-4">
                  <TabsTrigger value="deposits" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">
                    जमा
                  </TabsTrigger>
                  <TabsTrigger value="withdrawals" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">
                    निकासी
                  </TabsTrigger>
                  <TabsTrigger value="bets" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">
                    बेट्स
                  </TabsTrigger>
                  <TabsTrigger value="winnings" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">
                    जीत
                  </TabsTrigger>
                </TabsList>

                {/* Deposits */}
                <TabsContent value="deposits" className="mt-4">
                  {userDetails.deposits?.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">कोई जमा नहीं</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.deposits?.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div className="flex items-center gap-2">
                            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                            <span className="text-white">₹{d.amount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={d.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}>
                              {d.status}
                            </Badge>
                            <span className="text-gray-400 text-xs">
                              {new Date(d.created_at).toLocaleDateString('hi-IN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Withdrawals */}
                <TabsContent value="withdrawals" className="mt-4">
                  {userDetails.withdrawals?.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">कोई निकासी नहीं</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.withdrawals?.map((w, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-red-400" />
                            <div>
                              <span className="text-white">₹{w.amount}</span>
                              <p className="text-gray-400 text-xs">{w.upi_id}</p>
                            </div>
                          </div>
                          <Badge className={
                            w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            w.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }>
                            {w.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Bets */}
                <TabsContent value="bets" className="mt-4">
                  {userDetails.betStats && (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="p-2 bg-[#0A0A0C] rounded text-center">
                        <p className="text-xs text-gray-400">कुल</p>
                        <p className="text-white font-bold">{userDetails.betStats.total_bets}</p>
                      </div>
                      <div className="p-2 bg-[#0A0A0C] rounded text-center">
                        <p className="text-xs text-gray-400">जीती</p>
                        <p className="text-emerald-400 font-bold">{userDetails.betStats.won}</p>
                      </div>
                      <div className="p-2 bg-[#0A0A0C] rounded text-center">
                        <p className="text-xs text-gray-400">हारी</p>
                        <p className="text-red-400 font-bold">{userDetails.betStats.lost}</p>
                      </div>
                      <div className="p-2 bg-[#0A0A0C] rounded text-center">
                        <p className="text-xs text-gray-400">लंबित</p>
                        <p className="text-yellow-400 font-bold">{userDetails.betStats.pending}</p>
                      </div>
                    </div>
                  )}
                  {userDetails.bets?.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">कोई बेट नहीं</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.bets?.slice(0, 20).map((b, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div>
                            <p className="text-white">{b.game_name} - {b.number}</p>
                            <p className="text-gray-400 text-xs">{b.bet_type} • ₹{b.amount}</p>
                          </div>
                          <Badge className={
                            b.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' :
                            b.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }>
                            {b.status === 'won' ? `जीता ₹${b.won_amount}` : b.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Winnings */}
                <TabsContent value="winnings" className="mt-4">
                  {userDetails.winnings?.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">कोई जीत नहीं</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.winnings?.map((w, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div>
                            <p className="text-white">{w.game_name} - {w.number}</p>
                            <p className="text-gray-400 text-xs">{w.bet_type} • बेट: ₹{w.amount}</p>
                          </div>
                          <span className="text-emerald-400 font-bold">+₹{w.won_amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Adjustment Modal */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded']">Wallet Management</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedUser?.name} के wallet में पैसे जोड़ें या काटें
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-[#0A0A0C] rounded-lg text-center">
              <p className="text-gray-400 text-sm">वर्तमान बैलेंस</p>
              <p className="text-3xl font-bold text-white">₹{selectedUser?.balance?.toFixed(2) || '0'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={walletType === 'add' ? 'default' : 'outline'}
                onClick={() => setWalletType('add')}
                className={walletType === 'add' 
                  ? 'bg-emerald-500 hover:bg-emerald-600' 
                  : 'border-white/10 text-gray-300'
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                जोड़ें
              </Button>
              <Button
                variant={walletType === 'deduct' ? 'default' : 'outline'}
                onClick={() => setWalletType('deduct')}
                className={walletType === 'deduct' 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'border-white/10 text-gray-300'
                }
              >
                <Minus className="w-4 h-4 mr-2" />
                काटें
              </Button>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">राशि (₹)</Label>
              <Input
                type="number"
                placeholder="Amount"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">कारण</Label>
              <Input
                type="text"
                placeholder="Reason for adjustment"
                value={walletReason}
                onChange={(e) => setWalletReason(e.target.value)}
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
            </div>

            <Button
              onClick={handleWalletAdjustment}
              disabled={adjustingWallet}
              className={`w-full ${walletType === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {adjustingWallet ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {walletType === 'add' ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
                  {walletType === 'add' ? 'पैसे जोड़ें' : 'पैसे काटें'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
