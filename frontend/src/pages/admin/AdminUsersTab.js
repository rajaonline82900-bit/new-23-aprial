import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Eye, Loader2, Wallet, Plus, Minus, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminUsersTab = () => {
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userDetailTab, setUserDetailTab] = useState('deposits');
  const [userDetails, setUserDetails] = useState({ deposits: [], withdrawals: [], bets: [], winnings: [], stats: {} });
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState('add');
  const [walletReason, setWalletReason] = useState('');
  const [adjustingWallet, setAdjustingWallet] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/users?limit=500`, { withCredentials: true });
      setUsers(data.users);
    } catch (error) {}
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openUserDetails = async (u) => {
    setSelectedUser(u); setUserModalOpen(true); setLoadingUserDetails(true); setUserDetailTab('deposits');
    try {
      const [depositsRes, withdrawalsRes, betsRes, winningsRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/users/${u._id}/deposits`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/withdrawals`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/bets`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/users/${u._id}/winnings`, { withCredentials: true })
      ]);
      setUserDetails({
        deposits: depositsRes.data.deposits, totalDeposited: depositsRes.data.total_deposited,
        withdrawals: withdrawalsRes.data.withdrawals, totalWithdrawn: withdrawalsRes.data.total_withdrawn, pendingWithdrawal: withdrawalsRes.data.pending_amount,
        bets: betsRes.data.bets, betStats: betsRes.data.stats,
        winnings: winningsRes.data.winnings, totalWinnings: winningsRes.data.total_winnings
      });
    } catch (error) { toast.error('User details load नहीं हो पाए'); }
    finally { setLoadingUserDetails(false); }
  };

  const handleWalletAdjustment = async () => {
    if (!walletAmount || parseFloat(walletAmount) <= 0) { toast.error('Valid amount दर्ज करें'); return; }
    if (!walletReason) { toast.error('Reason दर्ज करें'); return; }
    setAdjustingWallet(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/admin/users/${selectedUser._id}/wallet`, {
        amount: parseFloat(walletAmount), type: walletType, reason: walletReason
      }, { withCredentials: true });
      toast.success(data.message);
      setWalletModalOpen(false); setWalletAmount(''); setWalletReason('');
      setUsers(prev => prev.map(u => u._id === selectedUser._id ? { ...u, balance: data.new_balance } : u));
      setSelectedUser(prev => ({ ...prev, balance: data.new_balance }));
      openUserDetails({ ...selectedUser, balance: data.new_balance });
    } catch (error) { toast.error(error.response?.data?.detail || 'Wallet adjustment failed'); }
    finally { setAdjustingWallet(false); }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`क्या आप वाकई "${selectedUser.name}" का अकाउंट डिलीट करना चाहते हैं?`)) return;
    setDeletingUser(true);
    try {
      const { data } = await axios.delete(`${API_URL}/api/admin/users/${selectedUser._id}`, { withCredentials: true });
      toast.success(data.message);
      setUserModalOpen(false); setSelectedUser(null);
      setUsers(users.filter(u => u._id !== selectedUser._id));
    } catch (error) { toast.error(error.response?.data?.detail || 'डिलीट करने में विफल'); }
    finally { setDeletingUser(false); }
  };

  return (
    <>
      <Card className="bg-[#141418] border-white/10">
        <CardHeader>
          <CardTitle className="text-white font-['Unbounded']">सभी यूजर्स</CardTitle>
          <CardDescription className="text-gray-400">मोबाइल नंबर या नाम से सर्च करें</CardDescription>
          <div className="mt-3">
            <Input type="text" placeholder="मोबाइल नंबर या नाम से सर्च करें..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
              data-testid="user-search-input" className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.filter(u => {
              if (!userSearch.trim()) return true;
              const q = userSearch.trim().toLowerCase();
              return (u.phone && u.phone.includes(q)) || (u.name && u.name.toLowerCase().includes(q)) || (u.email && u.email.toLowerCase().includes(q));
            }).map((u, index) => (
              <div key={index} onClick={() => openUserDetails(u)} className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5 cursor-pointer hover:border-[#D4AF37]/50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                      <span className="text-[#D4AF37] font-bold">{u.name?.charAt(0).toUpperCase()}</span>
                    </div>
                    {u.last_seen && (Date.now() - new Date(u.last_seen.endsWith('Z') ? u.last_seen : u.last_seen + 'Z').getTime()) < 300000 && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#0A0A0C]" title="ऑनलाइन"></div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{u.name}</p>
                    <p className="text-gray-400 text-sm">{u.phone || u.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <p className="text-gray-400 text-xs">
                        {u.created_at ? new Date(u.created_at.endsWith?.('Z') ? u.created_at : u.created_at + 'Z').toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </p>
                      <span className={`text-xs ${u.last_seen && (Date.now() - new Date(u.last_seen.endsWith?.('Z') ? u.last_seen : u.last_seen + 'Z').getTime()) < 300000 ? 'text-green-400' : 'text-gray-400'}`}>
                        {u.last_seen ? (
                          (Date.now() - new Date(u.last_seen.endsWith?.('Z') ? u.last_seen : u.last_seen + 'Z').getTime()) < 300000
                            ? 'ऑनलाइन'
                            : (() => { const diff = Math.floor((Date.now() - new Date(u.last_seen.endsWith?.('Z') ? u.last_seen : u.last_seen + 'Z').getTime()) / 60000); if (diff < 60) return `${diff} मिनट पहले`; if (diff < 1440) return `${Math.floor(diff/60)} घंटे पहले`; return `${Math.floor(diff/1440)} दिन पहले`; })()
                        ) : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Badge className={u.role === 'admin' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-[#141418]0/20 text-gray-400'}>{u.role}</Badge>
                    <p className="text-white font-semibold mt-1">₹{u.balance?.toFixed(2) || '0.00'}</p>
                  </div>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Details Modal */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded'] flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                <span className="text-[#D4AF37] font-bold text-xl">{selectedUser?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p>{selectedUser?.name}</p>
                <p className="text-sm text-gray-400 font-normal">{selectedUser?.phone || selectedUser?.email}</p>
                <p className="text-xs text-gray-400 font-normal">अकाउंट बना: {selectedUser?.created_at ? utcDate(selectedUser.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'N/A'}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingUserDetails ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">बैलेंस</p><p className="text-lg font-bold text-white">₹{selectedUser?.balance?.toFixed(2) || '0'}</p></div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">कुल जमा</p><p className="text-lg font-bold text-emerald-400">₹{userDetails.totalDeposited || 0}</p></div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">कुल निकासी</p><p className="text-lg font-bold text-red-400">₹{userDetails.totalWithdrawn || 0}</p></div>
                <div className="p-3 bg-[#0A0A0C] rounded-lg text-center"><p className="text-gray-400 text-xs">कुल जीत</p><p className="text-lg font-bold text-[#D4AF37]">₹{userDetails.totalWinnings || 0}</p></div>
              </div>

              <div className="flex gap-2 mb-4">
                <Button onClick={() => setWalletModalOpen(true)} className="flex-1 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"><Wallet className="w-4 h-4 mr-2" />Wallet Management</Button>
                {selectedUser?.role !== 'admin' && (
                  <Button onClick={handleDeleteUser} disabled={deletingUser} data-testid="delete-user-btn" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                    {deletingUser ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    {deletingUser ? 'डिलीट...' : 'अकाउंट डिलीट'}
                  </Button>
                )}
              </div>

              <Tabs value={userDetailTab} onValueChange={setUserDetailTab}>
                <TabsList className="bg-[#0A0A0C] border border-white/10 w-full grid grid-cols-4">
                  <TabsTrigger value="deposits" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">जमा</TabsTrigger>
                  <TabsTrigger value="withdrawals" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">निकासी</TabsTrigger>
                  <TabsTrigger value="bets" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">बेट्स</TabsTrigger>
                  <TabsTrigger value="winnings" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black text-xs">जीत</TabsTrigger>
                </TabsList>

                <TabsContent value="deposits" className="mt-4">
                  {userDetails.deposits?.length === 0 ? <p className="text-gray-400 text-center py-4">कोई जमा नहीं</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.deposits?.map((d, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div className="flex items-center gap-2">
                            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                            <div>
                              <span className="text-white">₹{d.amount}</span>
                              <p className="text-gray-400 text-[10px]">{utcDate(d.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })}</p>
                            </div>
                          </div>
                          <Badge className={d.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}>{d.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="withdrawals" className="mt-4">
                  {userDetails.withdrawals?.length === 0 ? <p className="text-gray-400 text-center py-4">कोई निकासी नहीं</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.withdrawals?.map((w, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div className="flex items-center gap-2">
                            <ArrowUpRight className="w-4 h-4 text-red-400" />
                            <div>
                              <span className="text-white">₹{w.amount}</span>
                              <p className="text-gray-400 text-[10px]">{w.upi_id}</p>
                            </div>
                          </div>
                          <Badge className={w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : w.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>{w.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="bets" className="mt-4">
                  {userDetails.betStats && (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">कुल</p><p className="text-white font-bold">{userDetails.betStats.total_bets}</p></div>
                      <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">जीती</p><p className="text-emerald-400 font-bold">{userDetails.betStats.won}</p></div>
                      <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">हारी</p><p className="text-red-400 font-bold">{userDetails.betStats.lost}</p></div>
                      <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-xs text-gray-400">लंबित</p><p className="text-yellow-400 font-bold">{userDetails.betStats.pending}</p></div>
                    </div>
                  )}
                  {userDetails.bets?.length === 0 ? <p className="text-gray-400 text-center py-4">कोई बेट नहीं</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.bets?.slice(0, 20).map((b, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div>
                            <p className="text-white">{b.game_name} - {b.number}</p>
                            <p className="text-gray-400 text-xs">{b.bet_type} - ₹{b.amount}</p>
                          </div>
                          <Badge className={b.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' : b.status === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                            {b.status === 'won' ? `जीता ₹${b.won_amount}` : b.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="winnings" className="mt-4">
                  {userDetails.winnings?.length === 0 ? <p className="text-gray-400 text-center py-4">कोई जीत नहीं</p> : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.winnings?.map((w, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg">
                          <div>
                            <p className="text-white">{w.game_name} - {w.number}</p>
                            <p className="text-gray-400 text-xs">{w.bet_type} - बेट: ₹{w.amount}</p>
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
            <DialogDescription className="text-gray-400">{selectedUser?.name} के wallet में पैसे जोड़ें या काटें</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-[#0A0A0C] rounded-lg text-center">
              <p className="text-gray-400 text-sm">वर्तमान बैलेंस</p>
              <p className="text-3xl font-bold text-white">₹{selectedUser?.balance?.toFixed(2) || '0'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={walletType === 'add' ? 'default' : 'outline'} onClick={() => setWalletType('add')} className={walletType === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'border-white/10 text-gray-300'}><Plus className="w-4 h-4 mr-2" />जोड़ें</Button>
              <Button variant={walletType === 'deduct' ? 'default' : 'outline'} onClick={() => setWalletType('deduct')} className={walletType === 'deduct' ? 'bg-red-500 hover:bg-red-600' : 'border-white/10 text-gray-300'}><Minus className="w-4 h-4 mr-2" />काटें</Button>
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">राशि (₹)</Label>
              <Input type="number" placeholder="Amount" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">कारण</Label>
              <Input type="text" placeholder="Reason for adjustment" value={walletReason} onChange={(e) => setWalletReason(e.target.value)} className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <Button onClick={handleWalletAdjustment} disabled={adjustingWallet} className={`w-full ${walletType === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {adjustingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{walletType === 'add' ? <><Plus className="w-4 h-4 mr-2" />पैसे जोड़ें</> : <><Minus className="w-4 h-4 mr-2" />पैसे काटें</>}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUsersTab;
