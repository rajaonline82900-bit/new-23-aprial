import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
  BarChart3
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

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

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
      
      // Reset form
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users.map((u, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5"
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
                      <div className="text-right">
                        <Badge className={u.role === 'admin' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-gray-500/20 text-gray-400'}>
                          {u.role}
                        </Badge>
                        <p className="text-white font-semibold mt-1">₹{u.balance?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;
