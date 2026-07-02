import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Loader2, RefreshCw, History } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_OPTS = [
  { id: '',            label: 'सभी (All)' },
  { id: 'gali_disawar', label: 'Gali / Disawar' },
  { id: 'kalyan',       label: 'Kalyan' },
  { id: 'aviator',      label: 'Aviator' },
];

const STATUS_OPTS = [
  { id: '',        label: 'सभी status' },
  { id: 'pending', label: 'Pending' },
  { id: 'won',     label: 'Won' },
  { id: 'lost',    label: 'Lost' },
];

const BET_TYPE_LABEL = {
  jodi: 'जोड़ी', haruf_andar: 'हरूफ अंदर', haruf_bahar: 'हरूफ बाहर',
  single_ank: 'Single', kalyan_jodi: 'Jodi',
  single_panna: 'Single Patti', double_panna: 'Double Patti', triple_panna: 'Triple Patti',
  half_sangam: 'Half Sangam', full_sangam: 'Full Sangam',
  aviator: 'Aviator',
};

const AdminHistoryTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [phone, setPhone] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve phone → user_id if provided
      let user_id;
      if (phone.trim()) {
        try {
          const { data } = await axios.get(`${API}/api/admin/users?search=${encodeURIComponent(phone.trim())}`, { withCredentials: true });
          const u = (data.users || data || [])[0];
          if (u) user_id = u._id || u.id;
          else { toast.info('No user found for this phone'); }
        } catch { /* ignore */ }
      }
      const params = { limit: 300 };
      if (category) params.category = category;
      if (status) params.status = status;
      if (date) params.date = date;
      if (user_id) params.user_id = user_id;
      const { data } = await axios.get(`${API}/api/admin/bet-history`, { params, withCredentials: true });
      setRows(data.bets || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'History load fail');
    } finally { setLoading(false); }
  }, [category, status, date, phone]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const wonCount = rows.filter(r => r.status === 'won').length;
  const lostCount = rows.filter(r => r.status === 'lost').length;

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
            <History className="w-5 h-5 text-[#D4AF37]" />पूरी बेट हिस्ट्री
          </CardTitle>
          <Button onClick={fetchHistory} disabled={loading} size="sm"
            className="bg-[#D4AF37] hover:bg-[#FDE047] text-black" data-testid="history-refresh">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Select value={category || '_all'} onValueChange={(v) => setCategory(v === '_all' ? '' : v)}>
            <SelectTrigger className="bg-[#0A0A0C] border-white/10 text-white h-9" data-testid="history-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-[#141418] border-white/10">
              {CATEGORY_OPTS.map(o => <SelectItem key={o.id || '_all'} value={o.id || '_all'} className="text-white hover:bg-white/10">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status || '_all'} onValueChange={(v) => setStatus(v === '_all' ? '' : v)}>
            <SelectTrigger className="bg-[#0A0A0C] border-white/10 text-white h-9" data-testid="history-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#141418] border-white/10">
              {STATUS_OPTS.map(o => <SelectItem key={o.id || '_all'} value={o.id || '_all'} className="text-white hover:bg-white/10">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-[#0A0A0C] border-white/10 text-white h-9" data-testid="history-date" />
          <Input placeholder="Phone search" value={phone} onChange={e => setPhone(e.target.value)}
            className="bg-[#0A0A0C] border-white/10 text-white h-9" data-testid="history-phone" />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-gray-400 text-[10px]">Rows</p><p className="text-white font-bold">{rows.length}</p></div>
          <div className="p-2 bg-[#0A0A0C] rounded text-center"><p className="text-gray-400 text-[10px]">Total ₹</p><p className="text-[#D4AF37] font-bold">₹{totalAmount.toFixed(0)}</p></div>
          <div className="p-2 bg-emerald-500/10 rounded text-center border border-emerald-500/20"><p className="text-gray-400 text-[10px]">Won</p><p className="text-emerald-400 font-bold">{wonCount}</p></div>
          <div className="p-2 bg-red-500/10 rounded text-center border border-red-500/20"><p className="text-gray-400 text-[10px]">Lost</p><p className="text-red-400 font-bold">{lostCount}</p></div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No bets found for these filters</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left border-b border-white/10">
                  <th className="py-2 px-2">Date / Time</th>
                  <th className="py-2 px-2">User</th>
                  <th className="py-2 px-2">Game</th>
                  <th className="py-2 px-2">Session</th>
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2">Number</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                  <th className="py-2 px-2 text-right">Win</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b, i) => {
                  const ts = b.created_at ? new Date(b.created_at) : null;
                  const dt = ts ? `${ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ${ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : (b.date || '-');
                  const status = b.status || 'pending';
                  const badgeCls =
                    status === 'won' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                    status === 'lost' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                    'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
                  return (
                    <tr key={`${b.id}-${i}`} className="border-b border-white/5 hover:bg-white/5"
                      data-testid={`history-row-${i}`}>
                      <td className="py-1.5 px-2 text-gray-300 tabular-nums">{dt}</td>
                      <td className="py-1.5 px-2 text-white">
                        <div>{b.user_name}</div>
                        <div className="text-gray-500 text-[10px]">{b.user_phone}</div>
                      </td>
                      <td className="py-1.5 px-2 text-white">{b.game_name}</td>
                      <td className="py-1.5 px-2 text-gray-300">{b.session || '-'}</td>
                      <td className="py-1.5 px-2 text-gray-300">{BET_TYPE_LABEL[b.bet_type] || b.bet_type}</td>
                      <td className="py-1.5 px-2 font-mono text-[#D4AF37]">{b.digit || '-'}</td>
                      <td className="py-1.5 px-2 text-right text-white">₹{(b.amount || 0).toFixed(0)}</td>
                      <td className="py-1.5 px-2 text-right text-emerald-400">
                        {b.winnings ? `₹${b.winnings.toFixed(0)}` : '-'}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeCls}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminHistoryTab;
