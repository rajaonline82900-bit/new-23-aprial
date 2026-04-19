import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, ArrowDownLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminFundRequestsTab = () => {
  const [deposits, setDeposits] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [processing, setProcessing] = useState('');

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/deposits`, {
        params: { limit: 100, status: filter },
        withCredentials: true
      });
      setDeposits(data.deposits || []);
      setStats(data.stats || {});
    } catch (e) { toast.error('Load failed'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleApprove = async (orderId) => {
    setProcessing(orderId);
    try {
      await axios.post(`${API_URL}/api/admin/deposits/${orderId}/approve`, {}, { withCredentials: true });
      toast.success('Deposit approved!');
      fetchDeposits();
    } catch (e) { toast.error(e.response?.data?.detail || 'Approve failed'); }
    finally { setProcessing(''); }
  };

  const handleReject = async (orderId) => {
    setProcessing(orderId);
    try {
      await axios.post(`${API_URL}/api/admin/deposits/${orderId}/reject`, {}, { withCredentials: true });
      toast.success('Deposit rejected');
      fetchDeposits();
    } catch (e) { toast.error(e.response?.data?.detail || 'Reject failed'); }
    finally { setProcessing(''); }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'pending': return <Badge className="bg-yellow-500/20 text-yellow-400 border-0"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed': return <Badge className="bg-red-500/20 text-red-400 border-0"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'expired': return <Badge className="bg-orange-500/20 text-orange-400 border-0"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'rejected': return <Badge className="bg-gray-500/20 text-gray-400 border-0"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default: return <Badge className="bg-gray-500/20 text-gray-400 border-0">{status}</Badge>;
    }
  };

  const filters = [
    { key: 'all', label: 'All', count: stats.all },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'completed', label: 'Success', count: stats.completed },
    { key: 'failed', label: 'Failed', count: stats.failed },
    { key: 'expired', label: 'Expired', count: stats.expired },
  ];

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <CardTitle className="text-white font-['Unbounded'] text-lg">Fund Requests</CardTitle>
        <div className="flex gap-2 mt-3 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`fund-filter-${f.key}`}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === f.key
                  ? 'bg-[#D4AF37] text-black'
                  : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-white/30'
              }`}
            >
              {f.label} {f.count !== undefined ? `(${f.count})` : ''}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
        ) : deposits.length === 0 ? (
          <p className="text-gray-400 text-center py-8">कोई request नहीं</p>
        ) : (
          <div className="space-y-3">
            {deposits.map((d, i) => (
              <div key={i} className="p-3 bg-[#0A0A0C] rounded-lg border border-white/10" data-testid={`fund-request-${i}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{d.user_name || 'User'}</p>
                      <p className="text-gray-400 text-xs">{d.user_phone || d.user_email || ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold text-lg">₹{d.amount}</p>
                    {getStatusBadge(d.status)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div>
                    <span>{d.order_id || ''}</span>
                    <span className="ml-2">
                      {d.created_at ? utcDate(d.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                    </span>
                  </div>
                  {d.status !== 'completed' && d.status !== 'rejected' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(d.order_id)}
                        disabled={processing === d.order_id}
                        data-testid={`approve-deposit-${i}`}
                        className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        {processing === d.order_id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(d.order_id)}
                        disabled={processing === d.order_id}
                        data-testid={`reject-deposit-${i}`}
                        className="h-7 px-3 border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs font-bold"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminFundRequestsTab;
