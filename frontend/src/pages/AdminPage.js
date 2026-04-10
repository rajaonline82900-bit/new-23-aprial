import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  ArrowLeft, Shield, Users, Trophy, Wallet, BarChart3, UserPlus,
  ArrowDownLeft, ArrowUpRight, Coins, History
} from 'lucide-react';
import { toast } from 'sonner';

// Tab components
import AdminResultsTab from './admin/AdminResultsTab';
import AdminBetsTab from './admin/AdminBetsTab';
import AdminGamesTab from './admin/AdminGamesTab';
import AdminWithdrawalsTab from './admin/AdminWithdrawalsTab';
import AdminDepositsTab from './admin/AdminDepositsTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminChatInbox from './admin/AdminChatInbox';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('results');
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const [statsRes, gamesRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/stats`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/games`, { withCredentials: true })
      ]);
      setStats(statsRes.data);
      setGames(gamesRes.data.games);
    } catch (error) {
      toast.error('डेटा लोड नहीं हो पाया');
    } finally {
      setLoading(false);
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
          <StatCard icon={<Users className="w-5 h-5 text-blue-400" />} bgColor="bg-blue-500/20" label="कुल यूजर्स" value={stats?.total_users || 0} />
          <StatCard icon={<BarChart3 className="w-5 h-5 text-[#D4AF37]" />} bgColor="bg-[#D4AF37]/20" label="कुल बेट्स" value={stats?.total_bets || 0} />
          <StatCard icon={<Trophy className="w-5 h-5 text-emerald-400" />} bgColor="bg-emerald-500/20" label="आज की बेट्स" value={stats?.today_bets || 0} />
          <StatCard icon={<UserPlus className="w-5 h-5 text-cyan-400" />} bgColor="bg-cyan-500/20" label="आज नए यूजर्स" value={stats?.today_new_users || 0} valueColor="text-cyan-400" borderColor="border-cyan-500/30" />
          <StatCard icon={<Wallet className="w-5 h-5 text-red-400" />} bgColor="bg-red-500/20" label="लंबित निकासी" value={stats?.pending_withdrawals || 0} />
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <GradientStatCard icon={<ArrowDownLeft className="w-5 h-5 text-emerald-400" />} gradient="from-emerald-500/10 to-[#141418]" border="border-emerald-500/30" label="आज का जमा" value={`₹${stats?.today_deposit_amount || 0}`} valueColor="text-emerald-400" />
          <GradientStatCard icon={<ArrowUpRight className="w-5 h-5 text-red-400" />} gradient="from-red-500/10 to-[#141418]" border="border-red-500/30" label="आज की निकासी" value={`₹${stats?.today_withdrawal_amount || 0}`} valueColor="text-red-400" />
          <GradientStatCard icon={<Coins className="w-5 h-5 text-[#D4AF37]" />} gradient="from-[#D4AF37]/10 to-[#141418]" border="border-[#D4AF37]/30" label="कुल जमा" value={`₹${stats?.total_deposit_amount || 0}`} valueColor="text-[#D4AF37]" />
          <GradientStatCard icon={<History className="w-5 h-5 text-purple-400" />} gradient="from-purple-500/10 to-[#141418]" border="border-purple-500/30" label="कुल निकासी" value={`₹${stats?.total_withdrawal_amount || 0}`} valueColor="text-purple-400" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#141418] border border-white/10 mb-6 flex-wrap">
            {[
              { value: 'results', label: 'रिजल्ट घोषणा' },
              { value: 'bets', label: 'बेट रिपोर्ट' },
              { value: 'games', label: 'गेम सेटिंग्स' },
              { value: 'withdrawals', label: 'निकासी' },
              { value: 'deposits', label: 'जमा सूची' },
              { value: 'users', label: 'यूजर्स' },
              { value: 'settings', label: 'सेटिंग्स' },
              { value: 'help', label: 'Chat' },
            ].map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} data-testid={`admin-${tab.value}-tab`}
                className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="results"><AdminResultsTab games={games} /></TabsContent>
          <TabsContent value="bets"><AdminBetsTab games={games} /></TabsContent>
          <TabsContent value="games"><AdminGamesTab /></TabsContent>
          <TabsContent value="withdrawals"><AdminWithdrawalsTab /></TabsContent>
          <TabsContent value="deposits"><AdminDepositsTab /></TabsContent>
          <TabsContent value="users"><AdminUsersTab /></TabsContent>
          <TabsContent value="settings"><AdminSettingsTab /></TabsContent>
          <TabsContent value="help"><AdminChatInbox API={API_URL} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const StatCard = ({ icon, bgColor, label, value, valueColor = 'text-white', borderColor = 'border-white/10' }) => (
  <Card className={`bg-[#141418] ${borderColor}`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const GradientStatCard = ({ icon, gradient, border, label, value, valueColor }) => (
  <Card className={`bg-gradient-to-br ${gradient} ${border}`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${border.replace('border-', 'bg-').replace('/30', '/20')} flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default AdminPage;
