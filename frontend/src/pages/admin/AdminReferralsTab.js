import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Loader2, Users, Gift } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminReferralsTab = () => {
  const [referrals, setReferrals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/referrals`, { params: { limit: 100 }, withCredentials: true });
      setReferrals(data.referrals || []);
      setTotal(data.total || 0);
    } catch (e) { toast.error('Load failed'); }
    finally { setLoading(false); }
  };

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <CardTitle className="text-white font-['Unbounded'] text-lg flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-400" /> Referral Users
          <Badge className="bg-pink-500/20 text-pink-400 border-0 ml-2">{total} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
        ) : referrals.length === 0 ? (
          <p className="text-gray-400 text-center py-8">कोई referral user नहीं</p>
        ) : (
          <div className="space-y-3">
            {referrals.map((r, i) => (
              <div key={i} className="p-3 bg-[#0A0A0C] rounded-lg border border-white/10" data-testid={`referral-${i}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{r.user_name}</p>
                      <p className="text-gray-400 text-xs">{r.user_phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">₹{r.user_balance?.toFixed(2) || '0'}</p>
                    <Badge className="bg-pink-500/20 text-pink-400 border-0 text-[10px]">Referred</Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-white/5 pt-2 mb-2">
                  <div>
                    <span>Referred by: </span>
                    <span className="text-[#D4AF37] font-medium">{r.referrer_name} ({r.referrer_phone})</span>
                  </div>
                  <span>
                    {r.joined_at ? utcDate(r.joined_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
                {/* Bonus status row */}
                <div className="grid grid-cols-3 gap-2 mt-1 text-[11px]">
                  <div className="rounded-md p-2 bg-blue-500/10 border border-blue-500/30">
                    <p className="text-blue-300 font-bold leading-none">First Deposit</p>
                    <p className="text-white font-black tabular-nums mt-1" data-testid={`refer-firstdep-${i}`}>₹{(r.first_deposit_amount || 0).toFixed(2)}</p>
                  </div>
                  <div className="rounded-md p-2 bg-amber-500/10 border border-amber-500/30">
                    <p className="text-amber-300 font-bold leading-none">5% Bonus</p>
                    <p className="text-[#FFD700] font-black tabular-nums mt-1" data-testid={`refer-bonus-${i}`}>₹{(r.bonus_amount || 0).toFixed(2)}</p>
                  </div>
                  <div className={`rounded-md p-2 border ${r.bonus_paid ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-gray-500/10 border-gray-500/30'}`}>
                    <p className={`font-bold leading-none ${r.bonus_paid ? 'text-emerald-300' : 'text-gray-400'}`}>Status</p>
                    <p className={`font-black mt-1 ${r.bonus_paid ? 'text-emerald-400' : 'text-gray-400'}`} data-testid={`refer-status-${i}`}>{r.bonus_paid ? '✓ Paid' : 'Pending'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminReferralsTab;
