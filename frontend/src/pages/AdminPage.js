import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  ArrowLeft, Shield, Users, Trophy, Wallet, UserPlus,
  ArrowDownLeft, ArrowUpRight, Coins, History, Eye, X, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import AdminResultsTab from './admin/AdminResultsTab';
import AdminBetsTab from './admin/AdminBetsTab';
import AdminGamesTab from './admin/AdminGamesTab';
import AdminWithdrawalsTab from './admin/AdminWithdrawalsTab';
import AdminDepositsTab from './admin/AdminDepositsTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminChatInbox from './admin/AdminChatInbox';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('results');
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialogs for stat card clicks
  const [todayUsersOpen, setTodayUsersOpen] = useState(false);
  const [todayDepositsOpen, setTodayDepositsOpen] = useState(false);
  const [todayUsers, setTodayUsers] = useState([]);
  const [todayDeposits, setTodayDeposits] = useState({ deposits: [], total: 0, total_amount: 0 });
  const [loadingDialog, setLoadingDialog] = useState(false);

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

  const openTodayUsers = async () => {
    setTodayUsersOpen(true); setLoadingDialog(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/today-new-users`, { withCredentials: true });
      setTodayUsers(data.users);
    } catch (e) { toast.error('Load failed'); }
    finally { setLoadingDialog(false); }
  };

  const openTodayDeposits = async () => {
    setTodayDepositsOpen(true); setLoadingDialog(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/today-deposits`, { withCredentials: true });
      setTodayDeposits(data);
    } catch (e) { toast.error('Load failed'); }
    finally { setLoadingDialog(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 glass border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <button className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-900 transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-[#D4AF37]" />
                <h1 className="text-xl font-bold text-gray-900 font-['Unbounded']">Admin Panel</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards - Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {/* #1 - Total Users - Clickable */}
          <div onClick={() => setActiveTab('users')} className="cursor-pointer" data-testid="stat-total-users">
            <StatCard icon={<Users className="w-5 h-5 text-blue-500" />} bgColor="bg-blue-500/10" label="कुल यूजर्स" value={stats?.total_users || 0} borderColor="border-blue-200 hover:border-blue-400" />
          </div>
          {/* #3 - Today Bets with Amount */}
          <StatCard icon={<Trophy className="w-5 h-5 text-emerald-500" />} bgColor="bg-emerald-500/10" label="आज की बेट्स" value={`₹${stats?.today_bet_amount || 0}`} borderColor="border-emerald-200" subValue={`${stats?.today_bets || 0} बेट्स`} />
          {/* #4 - Today New Users - Clickable */}
          <div onClick={openTodayUsers} className="cursor-pointer" data-testid="stat-today-users">
            <StatCard icon={<UserPlus className="w-5 h-5 text-cyan-500" />} bgColor="bg-cyan-500/10" label="आज नए यूजर्स" value={stats?.today_new_users || 0} valueColor="text-cyan-600" borderColor="border-cyan-200 hover:border-cyan-400" />
          </div>
          {/* Pending Withdrawals */}
          <StatCard icon={<Wallet className="w-5 h-5 text-red-500" />} bgColor="bg-red-500/10" label="लंबित निकासी" value={stats?.pending_withdrawals || 0} borderColor="border-red-200" />
        </div>

        {/* Stats Cards - Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* #5 - Today Deposits - Clickable */}
          <div onClick={openTodayDeposits} className="cursor-pointer" data-testid="stat-today-deposits">
            <GradientStatCard icon={<ArrowDownLeft className="w-5 h-5 text-emerald-500" />} bgColor="bg-emerald-50" label="आज का जमा" value={`₹${stats?.today_deposit_amount || 0}`} valueColor="text-emerald-600" borderColor="border-emerald-200 hover:border-emerald-400" />
          </div>
          <GradientStatCard icon={<ArrowUpRight className="w-5 h-5 text-red-500" />} bgColor="bg-red-50" label="आज की निकासी" value={`₹${stats?.today_withdrawal_amount || 0}`} valueColor="text-red-600" borderColor="border-red-200" />
          <GradientStatCard icon={<Coins className="w-5 h-5 text-[#D4AF37]" />} bgColor="bg-amber-50" label="कुल जमा" value={`₹${stats?.total_deposit_amount || 0}`} valueColor="text-[#D4AF37]" borderColor="border-amber-200" />
          <GradientStatCard icon={<History className="w-5 h-5 text-purple-500" />} bgColor="bg-purple-50" label="कुल निकासी" value={`₹${stats?.total_withdrawal_amount || 0}`} valueColor="text-purple-600" borderColor="border-purple-200" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-50 border border-gray-200 mb-6 flex-wrap">
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

      {/* Today New Users Dialog */}
      <Dialog open={todayUsersOpen} onOpenChange={setTodayUsersOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-['Unbounded']">आज के नए यूजर्स ({todayUsers.length})</DialogTitle></DialogHeader>
          {loadingDialog ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
          ) : todayUsers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">आज कोई नया यूजर नहीं</p>
          ) : (
            <div className="space-y-3">
              {todayUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                      <span className="text-cyan-600 font-bold">{u.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-gray-500 text-sm">{u.phone || u.email}</p>
                      <p className="text-gray-400 text-xs">
                        {u.created_at ? utcDate(u.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">₹{u.balance?.toFixed(2) || '0.00'}</p>
                    <Badge className="bg-cyan-100 text-cyan-700 border-0 text-xs">{u.role || 'user'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Today Deposits Dialog */}
      <Dialog open={todayDepositsOpen} onOpenChange={setTodayDepositsOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-['Unbounded']">आज की जमा ({todayDeposits.total}) - ₹{todayDeposits.total_amount}</DialogTitle></DialogHeader>
          {loadingDialog ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
          ) : todayDeposits.deposits?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">आज कोई जमा नहीं</p>
          ) : (
            <div className="space-y-3">
              {todayDeposits.deposits?.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{d.user_name || 'User'}</p>
                      <p className="text-gray-500 text-sm">{d.user_phone || d.user_email}</p>
                      <p className="text-gray-400 text-xs">
                        {d.created_at ? utcDate(d.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">₹{d.amount}</p>
                    <p className="text-gray-400 text-xs">बैलेंस: ₹{d.user_balance?.toFixed(2) || '0'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ icon, bgColor, label, value, valueColor = 'text-gray-900', borderColor = 'border-gray-200', subValue }) => (
  <Card className={`bg-white ${borderColor} transition-all`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-gray-500 text-sm">{label}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
          {subValue && <p className="text-gray-400 text-xs">{subValue}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const GradientStatCard = ({ icon, bgColor, label, value, valueColor, borderColor }) => (
  <Card className={`${bgColor} ${borderColor} transition-all`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-gray-500 text-sm">{label}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default AdminPage;
