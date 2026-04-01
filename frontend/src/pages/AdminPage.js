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
  History,
  PieChart,
  Settings,
  Edit,
  Trash2,
  Save,
  RotateCcw,
  Undo2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('results');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [approvedWithdrawals, setApprovedWithdrawals] = useState([]);
  const [rejectedWithdrawals, setRejectedWithdrawals] = useState([]);
  const [withdrawalSubTab, setWithdrawalSubTab] = useState('pending');
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  
  // Result declaration state
  const [selectedGame, setSelectedGame] = useState('');
  const [resultDate, setResultDate] = useState(new Date());
  const [jodiResult, setJodiResult] = useState('');
  const [declaring, setDeclaring] = useState(false);
  const [todayResults, setTodayResults] = useState({ date: '', games: [] });

  // Game settings state
  const [editingGame, setEditingGame] = useState(null);
  const [gameFormOpen, setGameFormOpen] = useState(false);
  const [gameForm, setGameForm] = useState({
    game_id: '',
    name: '',
    name_hi: '',
    start_time: '',
    end_time: '',
    display_time: '',
    is_active: true
  });
  const [savingGame, setSavingGame] = useState(false);

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

  // Settings state
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [withdrawalProofTelegram, setWithdrawalProofTelegram] = useState('');
  const [withdrawalStartTime, setWithdrawalStartTime] = useState('');
  const [withdrawalEndTime, setWithdrawalEndTime] = useState('');
  const [minBetJodi, setMinBetJodi] = useState(10);
  const [minBetHaruf, setMinBetHaruf] = useState(10);
  const [minBetCrossing, setMinBetCrossing] = useState(10);
  const [minDeposit, setMinDeposit] = useState(100);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [savingSettings, setSavingSettings] = useState(false);

  // Reverse state
  const [reversingResult, setReversingResult] = useState(false);
  const [reversingBets, setReversingBets] = useState(false);
  const [reverseBetType, setReverseBetType] = useState('all');

  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Wallet adjustment state
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState('add');
  const [walletReason, setWalletReason] = useState('');
  const [adjustingWallet, setAdjustingWallet] = useState(false);

  // Bet Distribution state
  const [betDistribution, setBetDistribution] = useState(null);
  const [betDistDate, setBetDistDate] = useState(new Date());
  const [betDistGame, setBetDistGame] = useState('all');
  const [loadingBetDist, setLoadingBetDist] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'bets') {
      fetchBetDistribution();
    }
    if (activeTab === 'games') {
      fetchGames();
    }
    if (activeTab === 'settings') {
      fetchSettings();
    }
    if (activeTab === 'results') {
      fetchTodayResults();
    }
    if (activeTab === 'withdrawals') {
      fetchWithdrawalHistory();
    }
    if (activeTab === 'deposits') {
      fetchDeposits();
    }

    // Auto-refresh for deposits and withdrawals every 10 seconds
    let interval;
    if (activeTab === 'withdrawals') {
      interval = setInterval(() => { fetchData(); fetchWithdrawalHistory(); }, 10000);
    } else if (activeTab === 'deposits') {
      interval = setInterval(() => { fetchData(); fetchDeposits(); }, 10000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeTab, betDistDate, betDistGame]);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, withdrawalsRes, gamesRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/withdrawals`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/games`, { withCredentials: true })
      ]);
      
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setWithdrawals(withdrawalsRes.data.withdrawals);
      setGames(gamesRes.data.games);
    } catch (error) {
      toast.error('डेटा लोड नहीं हो पाया');
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/games`, { withCredentials: true });
      setGames(data.games);
    } catch (error) {
      toast.error('Games load नहीं हो पाए');
    }
  };

  const fetchTodayResults = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/results/status`, { withCredentials: true });
      setTodayResults(data);
    } catch (error) {}
  };

  const fetchWithdrawalHistory = async () => {
    try {
      const [approvedRes, rejectedRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/withdrawals?status=approved`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/withdrawals?status=rejected`, { withCredentials: true })
      ]);
      setApprovedWithdrawals(approvedRes.data.withdrawals);
      setRejectedWithdrawals(rejectedRes.data.withdrawals);
    } catch (error) {}
  };

  const fetchDeposits = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/deposits`, { withCredentials: true });
      setDeposits(data.deposits);
    } catch (error) {}
  };

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/settings`, { withCredentials: true });
      setTelegramLink(data.telegram_link || '');
      setWhatsappLink(data.whatsapp_link || '');
      setWithdrawalProofTelegram(data.withdrawal_proof_telegram || '');
      setWithdrawalStartTime(data.withdrawal_start_time || '');
      setWithdrawalEndTime(data.withdrawal_end_time || '');
      setMinBetJodi(data.min_bet_jodi || 10);
      setMinBetHaruf(data.min_bet_haruf || 10);
      setMinBetCrossing(data.min_bet_crossing || 10);
      setMinDeposit(data.min_deposit || 100);
      setMinWithdrawal(data.min_withdrawal || 100);
    } catch (error) {}
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API_URL}/api/admin/settings`, {
        telegram_link: telegramLink,
        whatsapp_link: whatsappLink,
        withdrawal_proof_telegram: withdrawalProofTelegram,
        withdrawal_start_time: withdrawalStartTime,
        withdrawal_end_time: withdrawalEndTime,
        min_bet_jodi: parseInt(minBetJodi) || 10,
        min_bet_haruf: parseInt(minBetHaruf) || 10,
        min_bet_crossing: parseInt(minBetCrossing) || 10,
        min_deposit: parseInt(minDeposit) || 100,
        min_withdrawal: parseInt(minWithdrawal) || 100
      }, { withCredentials: true });
      toast.success('Settings saved!');
    } catch (error) {
      toast.error('Settings save नहीं हो पाई');
    } finally {
      setSavingSettings(false);
    }
  };

  const openGameForm = (game = null) => {
    if (game) {
      setEditingGame(game.game_id);
      setGameForm({
        game_id: game.game_id,
        name: game.name,
        name_hi: game.name_hi,
        start_time: game.start_time || '',
        end_time: game.end_time || game.time || '',
        display_time: game.display_time,
        is_active: game.is_active !== false
      });
    } else {
      setEditingGame(null);
      setGameForm({
        game_id: '',
        name: '',
        name_hi: '',
        start_time: '',
        end_time: '',
        display_time: '',
        is_active: true
      });
    }
    setGameFormOpen(true);
  };

  const handleSaveGame = async () => {
    if (!gameForm.name || !gameForm.name_hi || !gameForm.start_time || !gameForm.end_time) {
      toast.error('सभी required fields भरें');
      return;
    }

    setSavingGame(true);

    try {
      if (editingGame) {
        await axios.put(`${API_URL}/api/admin/games/${editingGame}`, {
          name: gameForm.name,
          name_hi: gameForm.name_hi,
          start_time: gameForm.start_time,
          end_time: gameForm.end_time,
          display_time: gameForm.display_time,
          is_active: gameForm.is_active
        }, { withCredentials: true });
        toast.success('Game updated successfully');
      } else {
        await axios.post(`${API_URL}/api/admin/games`, {
          game_id: gameForm.game_id,
          name: gameForm.name,
          name_hi: gameForm.name_hi,
          start_time: gameForm.start_time,
          end_time: gameForm.end_time,
          display_time: gameForm.display_time,
          is_active: gameForm.is_active
        }, { withCredentials: true });
        toast.success('Game created successfully');
      }
      
      setGameFormOpen(false);
      fetchGames();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Save failed');
    } finally {
      setSavingGame(false);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!confirm('क्या आप वाकई इस game को delete करना चाहते हैं?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/admin/games/${gameId}`, { withCredentials: true });
      toast.success('Game deleted');
      fetchGames();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const fetchBetDistribution = async () => {
    setLoadingBetDist(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/bet-distribution`, {
        params: { 
          game_id: betDistGame,
          date: format(betDistDate, 'yyyy-MM-dd')
        },
        withCredentials: true
      });
      setBetDistribution(data);
    } catch (error) {
      toast.error('Bet distribution load नहीं हो पाया');
    } finally {
      setLoadingBetDist(false);
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

      toast.success(`रिजल्ट घोषित! ${data.winners.jodi} जोड़ी विजेता`);
      
      setSelectedGame('');
      setJodiResult('');
      fetchTodayResults();
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
      fetchWithdrawalHistory();
    } catch (error) {
      toast.error('कार्रवाई विफल');
    }
  };

  const handleReverseResult = async () => {
    if (!selectedGame) {
      toast.error('गेम चुनें');
      return;
    }
    if (!window.confirm(`क्या आप ${selectedGame} का ${format(resultDate, 'yyyy-MM-dd')} का रिजल्ट रिवर्स करना चाहते हैं? जीती हुई राशि वापस कट जाएगी।`)) {
      return;
    }
    setReversingResult(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/admin/results/reverse`, {
        game_id: selectedGame,
        date: format(resultDate, 'yyyy-MM-dd')
      }, { withCredentials: true });
      toast.success(`${data.message} | जीत कटी: ₹${data.winnings_deducted} | ${data.bets_reverted_to_pending} बेट्स pending`);
      fetchTodayResults();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'रिजल्ट रिवर्स नहीं हो पाया');
    } finally {
      setReversingResult(false);
    }
  };

  const handleReverseBets = async () => {
    if (!selectedGame) {
      toast.error('गेम चुनें');
      return;
    }
    if (!window.confirm(`क्या आप ${selectedGame} की ${format(resultDate, 'yyyy-MM-dd')} की बेट्स रिवर्स करना चाहते हैं? बेट राशि वापस हो जाएगी।`)) {
      return;
    }
    setReversingBets(true);
    try {
      const payload = {
        game_id: selectedGame,
        date: format(resultDate, 'yyyy-MM-dd')
      };
      if (reverseBetType !== 'all') {
        payload.bet_type = reverseBetType;
      }
      const { data } = await axios.post(`${API_URL}/api/admin/bets/reverse`, payload, { withCredentials: true });
      toast.success(`${data.message} | वापसी: ₹${data.amount_refunded} | जीत कटी: ₹${data.winnings_deducted}`);
      fetchTodayResults();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'बेट्स रिवर्स नहीं हो पाईं');
    } finally {
      setReversingBets(false);
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

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`क्या आप वाकई "${selectedUser.name}" का अकाउंट डिलीट करना चाहते हैं? यह एक्शन वापस नहीं होगा!`)) return;
    
    setDeletingUser(true);
    try {
      const { data } = await axios.delete(`${API_URL}/api/admin/users/${selectedUser._id}`, { withCredentials: true });
      toast.success(data.message);
      setUserModalOpen(false);
      setSelectedUser(null);
      setUsers(users.filter(u => u._id !== selectedUser._id));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'डिलीट करने में विफल');
    } finally {
      setDeletingUser(false);
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
          <TabsList className="bg-[#141418] border border-white/10 mb-6 flex-wrap">
            <TabsTrigger 
              value="results"
              data-testid="admin-results-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              रिजल्ट घोषणा
            </TabsTrigger>
            <TabsTrigger 
              value="bets"
              data-testid="admin-bets-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              बेट रिपोर्ट
            </TabsTrigger>
            <TabsTrigger 
              value="games"
              data-testid="admin-games-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              गेम सेटिंग्स
            </TabsTrigger>
            <TabsTrigger 
              value="withdrawals"
              data-testid="admin-withdrawals-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              निकासी
            </TabsTrigger>
            <TabsTrigger 
              value="deposits"
              data-testid="admin-deposits-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              जमा सूची
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              data-testid="admin-users-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              यूजर्स
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              data-testid="admin-settings-tab"
              className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black"
            >
              सेटिंग्स
            </TabsTrigger>
          </TabsList>

          {/* Results Tab */}
          <TabsContent value="results">
            {/* Today's Results Status */}
            {todayResults.games.length > 0 && (
              <Card className="bg-[#141418] border-white/10 mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white font-['Unbounded'] text-base">
                    आज के रिजल्ट ({todayResults.date})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {todayResults.games.map((g) => (
                      <div key={g.game_id} className={`flex items-center justify-between p-3 rounded-lg border ${
                        g.declared ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0A0A0C] border-white/5'
                      }`} data-testid={`result-status-${g.game_id}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${g.declared ? 'bg-emerald-500' : 'bg-gray-600'}`}></div>
                          <div>
                            <p className="text-white font-medium text-sm">{g.name_hi}</p>
                            <p className="text-gray-500 text-xs">{g.start_time} - {g.end_time} | बेट्स: {g.total_bets}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {g.declared ? (
                            <span className="text-emerald-400 font-bold text-lg">{g.jodi_result}</span>
                          ) : (
                            <span className="text-gray-500 text-sm">
                              {g.pending_bets > 0 ? `${g.pending_bets} pending` : 'कोई बेट नहीं'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                        {games.filter(g => g.is_active !== false).map((game) => (
                          <SelectItem key={game.game_id} value={game.game_id} className="text-white hover:bg-white/10">
                            {game.name_hi}
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
                    रिजल्ट जोड़ी नंबर (00-99) दर्ज करें
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

                {/* Reverse Section */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="text-red-400 font-semibold mb-3">रिवर्स ऑप्शन</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* Result Reverse */}
                    <Button
                      onClick={handleReverseResult}
                      disabled={reversingResult || !selectedGame}
                      data-testid="admin-reverse-result-button"
                      variant="outline"
                      className="h-12 border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      {reversingResult ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          रिवर्स हो रहा है...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4" />
                          रिजल्ट रिवर्स
                        </span>
                      )}
                    </Button>

                    {/* Bet Reverse */}
                    <Button
                      onClick={handleReverseBets}
                      disabled={reversingBets || !selectedGame}
                      data-testid="admin-reverse-bets-button"
                      variant="outline"
                      className="h-12 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                    >
                      {reversingBets ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          रिवर्स हो रहा है...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Undo2 className="w-4 h-4" />
                          बेट रिवर्स
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Bet Type Filter for Bet Reverse */}
                  <div className="mt-3">
                    <Label className="text-gray-400 text-sm mb-2 block">बेट रिवर्स फ़िल्टर (बेट टाइप)</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'सभी' },
                        { value: 'jodi', label: 'जोड़ी' },
                        { value: 'haruf_andar', label: 'हरूफ अंदर' },
                        { value: 'haruf_bahar', label: 'हरूफ बाहर' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setReverseBetType(opt.value)}
                          data-testid={`reverse-filter-${opt.value}`}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            reverseBetType === opt.value
                              ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                              : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-orange-500/30'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-gray-500 text-xs mt-3">
                    रिजल्ट रिवर्स: रिजल्ट हटाएगा, जीती राशि काटेगा, बेट्स pending करेगा।
                    बेट रिवर्स: बेट राशि user को वापस करेगा।
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bets Distribution Tab */}
          <TabsContent value="bets">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-[#D4AF37]" />
                    बेट रिपोर्ट - कौन सी जोड़ी पर कितना लगा
                  </CardTitle>
                  <div className="flex gap-2">
                    <Select value={betDistGame} onValueChange={setBetDistGame}>
                      <SelectTrigger className="w-40 bg-[#0A0A0C] border-white/10 text-white">
                        <SelectValue placeholder="सभी गेम्स" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141418] border-white/10">
                        <SelectItem value="all" className="text-white hover:bg-white/10">सभी गेम्स</SelectItem>
                        {games.map((game) => (
                          <SelectItem key={game.game_id} value={game.game_id} className="text-white hover:bg-white/10">
                            {game.name_hi}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="bg-[#0A0A0C] border-white/10 text-white"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(betDistDate, 'dd MMM')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#141418] border-white/10">
                        <Calendar
                          mode="single"
                          selected={betDistDate}
                          onSelect={(date) => date && setBetDistDate(date)}
                          className="bg-[#141418]"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBetDist ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
                  </div>
                ) : !betDistribution || Object.keys(betDistribution.distribution).length === 0 ? (
                  <div className="text-center py-12">
                    <PieChart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">इस तारीख पर कोई पेंडिंग बेट नहीं</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-[#0A0A0C] rounded-lg text-center">
                        <p className="text-gray-400 text-sm">कुल बेट्स</p>
                        <p className="text-2xl font-bold text-white">{betDistribution.summary.total_bets}</p>
                      </div>
                      <div className="p-4 bg-emerald-500/10 rounded-lg text-center border border-emerald-500/30">
                        <p className="text-gray-400 text-sm">कुल राशि</p>
                        <p className="text-2xl font-bold text-emerald-400">₹{betDistribution.summary.total_bet_amount}</p>
                      </div>
                    </div>

                    {/* Game-wise distribution */}
                    {Object.entries(betDistribution.distribution).map(([gameId, gameData]) => (
                      <div key={gameId} className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-white">{gameData.game_name}</h3>
                          <div className="flex gap-4 text-sm">
                            <span className="text-emerald-400">राशि: ₹{gameData.total_amount}</span>
                          </div>
                        </div>

                        {/* Jodi Bets */}
                        {Object.keys(gameData.jodi).length > 0 && (
                          <div className="mb-4">
                            <p className="text-gray-400 text-sm mb-2">जोड़ी बेट्स:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                              {Object.entries(gameData.jodi).map(([number, data]) => (
                                <div 
                                  key={number}
                                  className="p-3 bg-[#0A0A0C] rounded-lg border border-white/10 hover:border-[#D4AF37]/50 transition-all"
                                >
                                  <div className="text-center">
                                    <span className="text-2xl font-bold text-[#D4AF37]">{number}</span>
                                    <div className="mt-1">
                                      <p className="text-white font-semibold">₹{data.amount}</p>
                                      <p className="text-gray-400 text-xs">{data.count} बेट</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Haruf Andar Bets */}
                        {Object.keys(gameData.haruf_andar || {}).length > 0 && (
                          <div className="mt-4">
                            <p className="text-blue-400 text-sm mb-2 font-semibold">हरूफ अंदर:</p>
                            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                              {Object.entries(gameData.haruf_andar).map(([number, data]) => (
                                <div 
                                  key={number}
                                  className="p-2 bg-[#0A0A0C] rounded-lg border border-blue-500/20 text-center"
                                >
                                  <span className="text-xl font-bold text-blue-400">{number}</span>
                                  <p className="text-white text-sm">₹{data.amount}</p>
                                  <p className="text-gray-400 text-xs">{data.count} बेट</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Haruf Bahar Bets */}
                        {Object.keys(gameData.haruf_bahar || {}).length > 0 && (
                          <div className="mt-4">
                            <p className="text-orange-400 text-sm mb-2 font-semibold">हरूफ बाहर:</p>
                            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                              {Object.entries(gameData.haruf_bahar).map(([number, data]) => (
                                <div 
                                  key={number}
                                  className="p-2 bg-[#0A0A0C] rounded-lg border border-orange-500/20 text-center"
                                >
                                  <span className="text-xl font-bold text-orange-400">{number}</span>
                                  <p className="text-white text-sm">₹{data.amount}</p>
                                  <p className="text-gray-400 text-xs">{data.count} बेट</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Games Settings Tab */}
          <TabsContent value="games">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#D4AF37]" />
                    गेम सेटिंग्स
                  </CardTitle>
                  <Button
                    onClick={() => openGameForm()}
                    className="bg-[#D4AF37] hover:bg-[#FDE047] text-black"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    नया गेम
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {games.map((game, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border ${
                        game.is_active !== false ? 'border-white/10' : 'border-red-500/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] flex items-center justify-center border border-[#D4AF37]/30">
                          <Clock className="w-6 h-6 text-[#D4AF37]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-white">{game.name_hi}</h4>
                            {game.is_active === false && (
                              <Badge className="bg-red-500/20 text-red-400">बंद</Badge>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm">{game.name}</p>
                          <p className="text-gray-500 text-xs">ID: {game.game_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[#D4AF37] font-bold text-lg">{game.display_time}</p>
                          <p className="text-gray-400 text-sm">
                            {game.start_time || '--:--'} - {game.end_time || game.time || '--:--'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openGameForm(game)}
                            className="border-white/10 text-gray-300 hover:bg-white/10"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteGame(game.game_id)}
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <CardTitle className="text-white font-['Unbounded']">निकासी प्रबंधन</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Sub-tabs */}
                <div className="flex gap-2 mb-4">
                  {[
                    { value: 'pending', label: 'लंबित', count: withdrawals.length },
                    { value: 'approved', label: 'स्वीकृत', count: approvedWithdrawals.length },
                    { value: 'rejected', label: 'अस्वीकृत', count: rejectedWithdrawals.length }
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setWithdrawalSubTab(tab.value)}
                      data-testid={`withdrawal-subtab-${tab.value}`}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        withdrawalSubTab === tab.value
                          ? tab.value === 'pending' ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                          : tab.value === 'approved' ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                          : 'bg-red-500/20 border border-red-500/50 text-red-400'
                          : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-white/30'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                {/* Pending Withdrawals */}
                {withdrawalSubTab === 'pending' && (
                  withdrawals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">कोई लंबित निकासी नहीं</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {withdrawals.map((w, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
                          <div>
                            <p className="text-white font-medium">{w.user_name}</p>
                            <p className="text-gray-400 text-sm">{w.user_phone || w.user_email}</p>
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
                  )
                )}

                {/* Approved Withdrawals */}
                {withdrawalSubTab === 'approved' && (
                  approvedWithdrawals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">कोई स्वीकृत निकासी नहीं</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvedWithdrawals.map((w, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-emerald-500/10">
                          <div>
                            <p className="text-white font-medium text-sm">{w.user_name}</p>
                            <p className="text-gray-400 text-xs">{w.user_phone || w.user_email} | UPI: {w.upi_id}</p>
                            <p className="text-gray-500 text-xs">{w.approved_at ? utcDate(w.approved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : w.created_at ? utcDate(w.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-400">₹{w.amount}</p>
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">स्वीकृत</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Rejected Withdrawals */}
                {withdrawalSubTab === 'rejected' && (
                  rejectedWithdrawals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">कोई अस्वीकृत निकासी नहीं</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {rejectedWithdrawals.map((w, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-red-500/10">
                          <div>
                            <p className="text-white font-medium text-sm">{w.user_name}</p>
                            <p className="text-gray-400 text-xs">{w.user_phone || w.user_email} | UPI: {w.upi_id}</p>
                            <p className="text-gray-500 text-xs">{w.rejected_at ? utcDate(w.rejected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : w.created_at ? utcDate(w.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-400">₹{w.amount}</p>
                            <Badge className="bg-red-500/20 text-red-400 border-0 text-xs">अस्वीकृत</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <CardTitle className="text-white font-['Unbounded']">जमा सूची</CardTitle>
                <CardDescription className="text-gray-400">
                  सभी सफल जमा की सूची
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deposits.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">कोई जमा नहीं मिला</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deposits.map((d, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-white/5">
                        <div>
                          <p className="text-white font-medium text-sm">{d.user_name || 'User'}</p>
                          <p className="text-gray-400 text-xs">{d.user_phone || d.user_email || ''}</p>
                          <p className="text-gray-500 text-xs">
                            {d.created_at ? utcDate(d.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-400">₹{d.amount}</p>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">सफल</Badge>
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
                  मोबाइल नंबर या नाम से सर्च करें
                </CardDescription>
                <div className="mt-3">
                  <Input
                    type="text"
                    placeholder="मोबाइल नंबर या नाम से सर्च करें..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    data-testid="user-search-input"
                    className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users
                    .filter(u => {
                      if (!userSearch.trim()) return true;
                      const q = userSearch.trim().toLowerCase();
                      return (u.phone && u.phone.includes(q)) || 
                             (u.name && u.name.toLowerCase().includes(q)) ||
                             (u.email && u.email.toLowerCase().includes(q));
                    })
                    .map((u, index) => (
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
                          <p className="text-gray-400 text-sm">{u.phone || u.email}</p>
                          <p className="text-gray-500 text-xs">{u.created_at ? utcDate(u.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}</p>
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

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="bg-[#141418] border-white/10">
              <CardHeader>
                <CardTitle className="text-white font-['Unbounded']">ऐप सेटिंग्स</CardTitle>
                <CardDescription className="text-gray-400">
                  Telegram और WhatsApp लिंक सेट करें
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-gray-300 mb-2 block">Telegram Channel/Group Link</Label>
                  <Input
                    type="url"
                    placeholder="https://t.me/yourchannel"
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                    data-testid="settings-telegram-link"
                    className="bg-[#0A0A0C] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 mb-2 block">WhatsApp Group Link</Label>
                  <Input
                    type="url"
                    placeholder="https://chat.whatsapp.com/..."
                    value={whatsappLink}
                    onChange={(e) => setWhatsappLink(e.target.value)}
                    data-testid="settings-whatsapp-link"
                    className="bg-[#0A0A0C] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 mb-2 block">Withdrawal Proof Telegram Link</Label>
                  <Input
                    type="url"
                    placeholder="https://t.me/withdrawal_proofs"
                    value={withdrawalProofTelegram}
                    onChange={(e) => setWithdrawalProofTelegram(e.target.value)}
                    data-testid="settings-withdrawal-proof"
                    className="bg-[#0A0A0C] border-white/10 text-white"
                  />
                </div>

                {/* Withdrawal Time */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-white font-bold mb-3">निकासी समय (Withdrawal Time)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">शुरू (Start)</Label>
                      <Input
                        type="time"
                        value={withdrawalStartTime}
                        onChange={(e) => setWithdrawalStartTime(e.target.value)}
                        data-testid="settings-withdrawal-start"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">खत्म (End)</Label>
                      <Input
                        type="time"
                        value={withdrawalEndTime}
                        onChange={(e) => setWithdrawalEndTime(e.target.value)}
                        data-testid="settings-withdrawal-end"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">खाली छोड़ने पर 24 घंटे निकासी उपलब्ध रहेगी</p>
                </div>

                {/* Min Bet Amounts */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-white font-bold mb-3">न्यूनतम बेट राशि</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">जोड़ी (₹)</Label>
                      <Input
                        type="number"
                        value={minBetJodi}
                        onChange={(e) => setMinBetJodi(e.target.value)}
                        data-testid="settings-min-bet-jodi"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">हरूफ (₹)</Label>
                      <Input
                        type="number"
                        value={minBetHaruf}
                        onChange={(e) => setMinBetHaruf(e.target.value)}
                        data-testid="settings-min-bet-haruf"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">क्रॉसिंग (₹)</Label>
                      <Input
                        type="number"
                        value={minBetCrossing}
                        onChange={(e) => setMinBetCrossing(e.target.value)}
                        data-testid="settings-min-bet-crossing"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Min Deposit & Withdrawal */}
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-white font-bold mb-3">न्यूनतम जमा / निकासी</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">न्यूनतम जमा (₹)</Label>
                      <Input
                        type="number"
                        value={minDeposit}
                        onChange={(e) => setMinDeposit(e.target.value)}
                        data-testid="settings-min-deposit"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">न्यूनतम निकासी (₹)</Label>
                      <Input
                        type="number"
                        value={minWithdrawal}
                        onChange={(e) => setMinWithdrawal(e.target.value)}
                        data-testid="settings-min-withdrawal"
                        className="bg-[#0A0A0C] border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  data-testid="save-settings-button"
                  className="bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
                >
                  {savingSettings ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> सेव हो रहा है...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Save className="w-4 h-4" /> सेव करें</span>
                  )}
                </Button>
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
                <p className="text-sm text-gray-400 font-normal">{selectedUser?.phone || selectedUser?.email}</p>
                <p className="text-xs text-gray-500 font-normal">अकाउंट बना: {selectedUser?.created_at ? utcDate(selectedUser.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'N/A'}</p>
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
              <div className="flex gap-2 mb-4">
                <Button
                  onClick={() => setWalletModalOpen(true)}
                  className="flex-1 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Wallet Management
                </Button>
                {selectedUser?.role !== 'admin' && (
                  <Button
                    onClick={handleDeleteUser}
                    disabled={deletingUser}
                    data-testid="delete-user-btn"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  >
                    {deletingUser ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    {deletingUser ? 'डिलीट...' : 'अकाउंट डिलीट'}
                  </Button>
                )}
              </div>

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
                            <div>
                              <span className="text-white">₹{d.amount}</span>
                              <p className="text-gray-500 text-[10px]">
                                {utcDate(d.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })} • {utcDate(d.created_at).toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
                              </p>
                            </div>
                          </div>
                          <Badge className={d.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}>
                            {d.status}
                          </Badge>
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
                              <p className="text-gray-500 text-[10px]">{w.upi_id}</p>
                              <p className="text-gray-500 text-[10px]">
                                {utcDate(w.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })} • {utcDate(w.created_at).toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
                              </p>
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
                            <p className="text-gray-500 text-[10px]">
                              {utcDate(b.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })} • {utcDate(b.created_at).toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
                            </p>
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
                            <p className="text-gray-500 text-[10px]">
                              {utcDate(w.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })} • {utcDate(w.created_at).toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
                            </p>
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

      {/* Game Form Dialog */}
      <Dialog open={gameFormOpen} onOpenChange={setGameFormOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded']">
              {editingGame ? 'गेम एडिट करें' : 'नया गेम बनाएं'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editingGame && (
              <div>
                <Label className="text-gray-300 mb-2 block">Game ID (unique)</Label>
                <Input
                  type="text"
                  placeholder="जैसे: mumbai_night"
                  value={gameForm.game_id}
                  onChange={(e) => setGameForm({...gameForm, game_id: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                  className="bg-[#0A0A0C] border-white/10 text-white"
                />
              </div>
            )}

            <div>
              <Label className="text-gray-300 mb-2 block">Game Name (English)</Label>
              <Input
                type="text"
                placeholder="Mumbai Night"
                value={gameForm.name}
                onChange={(e) => setGameForm({...gameForm, name: e.target.value})}
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Game Name (Hindi)</Label>
              <Input
                type="text"
                placeholder="मुंबई नाइट"
                value={gameForm.name_hi}
                onChange={(e) => setGameForm({...gameForm, name_hi: e.target.value})}
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Start Time (24hr)</Label>
                <Input
                  type="time"
                  placeholder="14:00"
                  value={gameForm.start_time}
                  onChange={(e) => setGameForm({...gameForm, start_time: e.target.value})}
                  data-testid="game-start-time-input"
                  className="bg-[#0A0A0C] border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">End Time (24hr)</Label>
                <Input
                  type="time"
                  placeholder="15:00"
                  value={gameForm.end_time}
                  onChange={(e) => setGameForm({...gameForm, end_time: e.target.value})}
                  data-testid="game-end-time-input"
                  className="bg-[#0A0A0C] border-white/10 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Display Time</Label>
              <Input
                type="text"
                placeholder="3:00 PM"
                value={gameForm.display_time}
                onChange={(e) => setGameForm({...gameForm, display_time: e.target.value})}
                data-testid="game-display-time-input"
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-[#0A0A0C] rounded-lg">
              <input
                type="checkbox"
                id="is_active"
                checked={gameForm.is_active}
                onChange={(e) => setGameForm({...gameForm, is_active: e.target.checked})}
                className="w-5 h-5 rounded border-white/10 bg-[#0A0A0C]"
              />
              <Label htmlFor="is_active" className="text-gray-300">Game Active है</Label>
            </div>

            <Button
              onClick={handleSaveGame}
              disabled={savingGame}
              className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
            >
              {savingGame ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingGame ? 'Update करें' : 'बनाएं'}
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
