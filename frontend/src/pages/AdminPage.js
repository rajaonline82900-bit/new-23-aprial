import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  ArrowLeft, Shield, Users, Trophy, Wallet, UserPlus,
  ArrowDownLeft, ArrowUpRight, Coins, History, Loader2, Eye
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
import AdminJantriTab from './admin/AdminJantriTab';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('results');
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayUsersOpen, setTodayUsersOpen] = useState(false);
  const [todayDepositsOpen, setTodayDepositsOpen] = useState(false);
  const [todayUsers, setTodayUsers] = useState([]);
  const [todayDeposits, setTodayDeposits] = useState({ deposits: [], total: 0, total_amount: 0 });
  const [loadingDialog, setLoadingDialog] = useState(false);
  const [selectedTodayUser, setSelectedTodayUser] = useState(null);
  const [todayUserDetailOpen, setTodayUserDetailOpen] = useState(false);
  const [todayUserDetails, setTodayUserDetails] = useState(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') { toast.error('Admin access required'); navigate('/dashboard'); return; }
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
    } catch (error) { toast.error('डेटा लोड नहीं हो पाया'); }
    finally { setLoading(false); }
  };

  const openTodayUsers = async () => {
    setTodayUsersOpen(true); setLoadingDialog(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/today-new-users`, { withCredentials: true });
      setTodayUsers(data.users);
    } catch (e) { toast.error('Load failed'); }
    finally { setLoadingDialog(false); }
  };

  const openTodayUserDetail = async (u) => {
    setSelectedTodayUser(u);
    setTodayUserDetailOpen(true);
    setLoadingUserDetail(true);
    try {
      const [depositsRes, withdrawalsRes, betsRes, winningsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users/${u._id}/deposits`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/withdrawals`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/bets`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/winnings`, { withCredentials: true })
      ]);
      setTodayUserDetails({
        deposits: depositsRes.data.deposits, totalDeposited: depositsRes.data.total_deposited,
        withdrawals: withdrawalsRes.data.withdrawals, totalWithdrawn: withdrawalsRes.data.total_withdrawn,
        bets: betsRes.data.bets, betStats: betsRes.data.stats,
        winnings: winningsRes.data.winnings, totalWinnings: winningsRes.data.total_winnings
      });
    } catch (e) { toast.error('User details load failed'); }
    finally { setLoadingUserDetail(false); }
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
      <div className="min-h-screen bg-[#0A0A0C] flex flex-col items-center justify-center">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[#D4AF37] via-[#FDE047] to-[#D4AF37] flex items-center justify-center font-black font-['Unbounded'] text-black text-base shadow-lg shadow-[#D4AF37]/30">M</div>
          </div>
          <div className="absolute inset-0 animate-[spin_1.5s_linear_infinite]">
            {[0,45,90,135,180,225,270,315].map((deg, i) => (
              <div key={i} className="absolute w-full h-full" style={{transform:`rotate(${deg}deg)`}}>
                <div className="w-2 h-2 rounded-full bg-[#D4AF37] mx-auto" style={{opacity:0.3+(i*0.09)}} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-xl font-black font-['Unbounded'] bg-gradient-to-r from-[#D4AF37] to-[#FDE047] bg-clip-text text-transparent">MATKA</span>
          <span className="text-2xl font-black font-['Unbounded'] text-white">11</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
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
        {/* Stats Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div onClick={() => setActiveTab('users')} className="cursor-pointer" data-testid="stat-total-users">
            <StatCard icon={<Users className="w-5 h-5 text-blue-400" />} bgColor="bg-blue-500/20" label="कुल यूजर्स" value={stats?.total_users || 0} borderColor="border-blue-500/20 hover:border-blue-400" />
          </div>
          <StatCard icon={<Trophy className="w-5 h-5 text-emerald-400" />} bgColor="bg-emerald-500/20" label="आज की बेट्स" value={`₹${stats?.today_bet_amount || 0}`} borderColor="border-emerald-500/20" subValue={`${stats?.today_bets || 0} बेट्स`} />
          <div onClick={openTodayUsers} className="cursor-pointer" data-testid="stat-today-users">
            <StatCard icon={<UserPlus className="w-5 h-5 text-cyan-400" />} bgColor="bg-cyan-500/20" label="आज नए यूजर्स" value={stats?.today_new_users || 0} valueColor="text-cyan-400" borderColor="border-cyan-500/20 hover:border-cyan-400" />
          </div>
          <StatCard icon={<Wallet className="w-5 h-5 text-red-400" />} bgColor="bg-red-500/20" label="लंबित निकासी" value={stats?.pending_withdrawals || 0} borderColor="border-red-500/20" />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div onClick={openTodayDeposits} className="cursor-pointer" data-testid="stat-today-deposits">
            <GradientStatCard icon={<ArrowDownLeft className="w-5 h-5 text-emerald-400" />} gradient="from-emerald-500/10 to-[#141418]" border="border-emerald-500/30 hover:border-emerald-400" label="आज का जमा" value={`₹${stats?.today_deposit_amount || 0}`} valueColor="text-emerald-400" />
          </div>
          <GradientStatCard icon={<ArrowUpRight className="w-5 h-5 text-red-400" />} gradient="from-red-500/10 to-[#141418]" border="border-red-500/30" label="आज की निकासी" value={`₹${stats?.today_withdrawal_amount || 0}`} valueColor="text-red-400" />
          <GradientStatCard icon={<Coins className="w-5 h-5 text-[#D4AF37]" />} gradient="from-[#D4AF37]/10 to-[#141418]" border="border-[#D4AF37]/30" label="कुल जमा" value={`₹${stats?.total_deposit_amount || 0}`} valueColor="text-[#D4AF37]" />
          <GradientStatCard icon={<History className="w-5 h-5 text-purple-400" />} gradient="from-purple-500/10 to-[#141418]" border="border-purple-500/30" label="कुल निकासी" value={`₹${stats?.total_withdrawal_amount || 0}`} valueColor="text-purple-400" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#141418] border border-white/10 mb-6 flex-wrap">
            {[
              { value: 'results', label: 'रिजल्ट घोषणा' },
              { value: 'jantri', label: 'जंतरी रिपोर्ट' },
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
          <TabsContent value="jantri"><AdminJantriTab games={games} /></TabsContent>
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
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-['Unbounded']">आज के नए यूजर्स ({todayUsers.length})</DialogTitle></DialogHeader>
          {loadingDialog ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
          ) : todayUsers.length === 0 ? (
            <p className="text-gray-400 text-center py-8">आज कोई नया यूजर नहीं</p>
          ) : (
            <div className="space-y-3">
              {todayUsers.map((u, i) => (
                <div key={i} onClick={() => openTodayUserDetail(u)} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-white/10 cursor-pointer hover:border-cyan-400/50 transition-all" data-testid={`today-user-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <span className="text-cyan-400 font-bold">{u.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{u.name}</p>
                      <p className="text-gray-400 text-sm">{u.phone || u.email}</p>
                      <p className="text-gray-500 text-xs">
                        {u.created_at ? utcDate(u.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-semibold text-white">₹{u.balance?.toFixed(2) || '0.00'}</p>
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">{u.role || 'user'}</Badge>
                    </div>
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Today Deposits Dialog */}
      <Dialog open={todayDepositsOpen} onOpenChange={setTodayDepositsOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-['Unbounded']">आज की जमा ({todayDeposits.total}) - ₹{todayDeposits.total_amount}</DialogTitle></DialogHeader>
          {loadingDialog ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
          ) : todayDeposits.deposits?.length === 0 ? (
            <p className="text-gray-400 text-center py-8">आज कोई जमा नहीं</p>
          ) : (
            <div className="space-y-3">
              {todayDeposits.deposits?.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{d.user_name || 'User'}</p>
                      <p className="text-gray-400 text-sm">{d.user_phone || d.user_email}</p>
                      <p className="text-gray-500 text-xs">
                        {d.created_at ? utcDate(d.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">₹{d.amount}</p>
                    <p className="text-gray-500 text-xs">बैलेंस: ₹{d.user_balance?.toFixed(2) || '0'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Today User Detail Dialog */}
      <Dialog open={todayUserDetailOpen} onOpenChange={setTodayUserDetailOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded'] flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <span className="text-cyan-400 font-bold text-xl">{selectedTodayUser?.name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p>{selectedTodayUser?.name}</p>
                <p className="text-sm text-gray-400 font-normal">{selectedTodayUser?.phone || selectedTodayUser?.email}</p>
                <p className="text-xs text-gray-500 font-normal">
                  रजिस्टर: {selectedTodayUser?.created_at ? utcDate(selectedTodayUser.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingUserDetail ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
          ) : todayUserDetails ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">बैलेंस</p><p className="text-lg font-bold text-white">₹{selectedTodayUser?.balance?.toFixed(2) || '0'}</p></div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">कुल जमा</p><p className="text-lg font-bold text-emerald-400">₹{todayUserDetails.totalDeposited || 0}</p></div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">कुल निकासी</p><p className="text-lg font-bold text-red-400">₹{todayUserDetails.totalWithdrawn || 0}</p></div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">कुल जीत</p><p className="text-lg font-bold text-[#D4AF37]">₹{todayUserDetails.totalWinnings || 0}</p></div>
              </div>

              {todayUserDetails.betStats && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">कुल बेट्स</p><p className="text-white font-bold">{todayUserDetails.betStats.total_bets}</p></div>
                  <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">जीती</p><p className="text-emerald-400 font-bold">{todayUserDetails.betStats.won}</p></div>
                  <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">हारी</p><p className="text-red-400 font-bold">{todayUserDetails.betStats.lost}</p></div>
                  <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">लंबित</p><p className="text-yellow-400 font-bold">{todayUserDetails.betStats.pending}</p></div>
                </div>
              )}

              {/* Recent Deposits */}
              {todayUserDetails.deposits?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-300 mb-2">हाल की जमा</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {todayUserDetails.deposits.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#0A0A0C] rounded text-sm">
                        <div className="flex items-center gap-2"><ArrowDownLeft className="w-3 h-3 text-emerald-400" /><span className="text-white">₹{d.amount}</span></div>
                        <Badge className={d.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 text-xs' : 'bg-yellow-500/20 text-yellow-400 text-xs'}>{d.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Bets */}
              {todayUserDetails.bets?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-300 mb-2">हाल की बेट्स</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {todayUserDetails.bets.slice(0, 5).map((b, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#0A0A0C] rounded text-sm">
                        <span className="text-white">{b.game_name} - {b.number} ({b.bet_type})</span>
                        <Badge className={b.status === 'won' ? 'bg-emerald-500/20 text-emerald-400 text-xs' : b.status === 'lost' ? 'bg-red-500/20 text-red-400 text-xs' : 'bg-yellow-500/20 text-yellow-400 text-xs'}>
                          {b.status === 'won' ? `₹${b.won_amount}` : b.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Withdrawals */}
              {todayUserDetails.withdrawals?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-2">हाल की निकासी</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {todayUserDetails.withdrawals.slice(0, 5).map((w, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#0A0A0C] rounded text-sm">
                        <div className="flex items-center gap-2"><ArrowUpRight className="w-3 h-3 text-red-400" /><span className="text-white">₹{w.amount}</span></div>
                        <Badge className={w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 text-xs' : w.status === 'rejected' ? 'bg-red-500/20 text-red-400 text-xs' : 'bg-yellow-500/20 text-yellow-400 text-xs'}>{w.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">कोई डेटा नहीं</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ icon, bgColor, label, value, valueColor = 'text-white', borderColor = 'border-white/10', subValue }) => (
  <Card className={`bg-[#141418] ${borderColor} transition-all`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
          {subValue && <p className="text-gray-500 text-xs">{subValue}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const GradientStatCard = ({ icon, gradient, border, label, value, valueColor }) => (
  <Card className={`bg-gradient-to-br ${gradient} ${border} transition-all`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${border.replace('border-', 'bg-').replace('/30', '/20').split(' ')[0]} flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default AdminPage;
