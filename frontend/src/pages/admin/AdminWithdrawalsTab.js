import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CheckCircle, XCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminWithdrawalsTab = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [approvedWithdrawals, setApprovedWithdrawals] = useState([]);
  const [rejectedWithdrawals, setRejectedWithdrawals] = useState([]);
  const [withdrawalSubTab, setWithdrawalSubTab] = useState('pending');

  const fetchWithdrawals = useCallback(async () => {
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/withdrawals?status=pending`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/withdrawals?status=approved`, { withCredentials: true }),
        axios.get(`${API_URL}/api/admin/withdrawals?status=rejected`, { withCredentials: true })
      ]);
      setWithdrawals(pendingRes.data.withdrawals);
      setApprovedWithdrawals(approvedRes.data.withdrawals);
      setRejectedWithdrawals(rejectedRes.data.withdrawals);
    } catch (error) {}
  }, []);

  useEffect(() => {
    fetchWithdrawals();
    const interval = setInterval(fetchWithdrawals, 10000);
    return () => clearInterval(interval);
  }, [fetchWithdrawals]);

  const handleWithdrawalAction = async (id, action) => {
    try {
      await axios.post(`${API_URL}/api/admin/withdrawals/${id}/${action}`, {}, { withCredentials: true });
      toast.success(action === 'approve' ? 'निकासी स्वीकृत' : 'निकासी अस्वीकृत और राशि वापस');
      fetchWithdrawals();
    } catch (error) { toast.error('कार्रवाई विफल'); }
  };

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader><CardTitle className="text-white font-['Unbounded']">निकासी प्रबंधन</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          {[
            { value: 'pending', label: 'लंबित', count: withdrawals.length },
            { value: 'approved', label: 'स्वीकृत', count: approvedWithdrawals.length },
            { value: 'rejected', label: 'अस्वीकृत', count: rejectedWithdrawals.length }
          ].map((tab) => (
            <button key={tab.value} onClick={() => setWithdrawalSubTab(tab.value)} data-testid={`withdrawal-subtab-${tab.value}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                withdrawalSubTab === tab.value
                  ? tab.value === 'pending' ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                  : tab.value === 'approved' ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                  : 'bg-red-500/20 border border-red-500/50 text-red-400'
                  : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-white/30'
              }`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {withdrawalSubTab === 'pending' && (
          withdrawals.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400">कोई लंबित निकासी नहीं</p></div>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((w, index) => (
                <div key={index} className="p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{w.user_name}</p>
                      <p className="text-gray-400 text-sm">{w.user_phone || w.user_email}</p>
                    </div>
                    <p className="text-xl font-bold text-white">₹{w.amount}</p>
                  </div>
                  <div className="bg-[#141418] rounded-lg p-3 mb-3 space-y-2">
                    {(!w.withdrawal_method || w.withdrawal_method === 'upi') && w.upi_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-sm">UPI: <span className="text-white">{w.upi_id}</span></span>
                        <button onClick={() => { navigator.clipboard.writeText(w.upi_id); toast.success('UPI ID कॉपी हो गई'); }} className="px-2 py-1 rounded bg-white/5 text-gray-300 hover:bg-white/10 text-xs" data-testid={`copy-upi-${w.id}`}>कॉपी</button>
                      </div>
                    )}
                    {w.withdrawal_method === 'bank' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">नाम: <span className="text-white">{w.account_holder}</span></span>
                          <button onClick={() => { navigator.clipboard.writeText(w.account_holder || ''); toast.success('कॉपी हो गया'); }} className="px-2 py-1 rounded bg-white/5 text-gray-300 hover:bg-white/10 text-xs">कॉपी</button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">A/C: <span className="text-white">{w.bank_account}</span></span>
                          <button onClick={() => { navigator.clipboard.writeText(w.bank_account || ''); toast.success('कॉपी हो गया'); }} className="px-2 py-1 rounded bg-white/5 text-gray-300 hover:bg-white/10 text-xs">कॉपी</button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm">IFSC: <span className="text-white">{w.ifsc_code}</span></span>
                          <button onClick={() => { navigator.clipboard.writeText(w.ifsc_code || ''); toast.success('कॉपी हो गया'); }} className="px-2 py-1 rounded bg-white/5 text-gray-300 hover:bg-white/10 text-xs">कॉपी</button>
                        </div>
                      </>
                    )}
                    {w.withdrawal_method === 'scanner' && w.scanner_image && (
                      <div>
                        <p className="text-gray-400 text-sm mb-2">स्कैनर:</p>
                        <img src={`${API_URL}${w.scanner_image}`} alt="Scanner" className="w-32 h-32 object-contain rounded-lg border border-white/10 mb-2" />
                        <a href={`${API_URL}${w.scanner_image}`} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium hover:bg-[#D4AF37]/20" data-testid={`download-scanner-${w.id}`}>
                          <Download className="w-3 h-3" /> डाउनलोड
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleWithdrawalAction(w.id, 'approve')} data-testid={`approve-withdrawal-${w.id}`} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                      <CheckCircle className="w-4 h-4 mr-1" />स्वीकृत
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleWithdrawalAction(w.id, 'reject')} data-testid={`reject-withdrawal-${w.id}`} className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10">
                      <XCircle className="w-4 h-4 mr-1" />अस्वीकृत
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {withdrawalSubTab === 'approved' && (
          approvedWithdrawals.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400">कोई स्वीकृत निकासी नहीं</p></div>
          ) : (
            <div className="space-y-3">
              {approvedWithdrawals.map((w, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-emerald-500/10">
                  <div>
                    <p className="text-white font-medium text-sm">{w.user_name}</p>
                    <p className="text-gray-400 text-xs">{w.user_phone || w.user_email} | {w.withdrawal_method === 'bank' ? `बैंक: ${w.bank_account}` : w.withdrawal_method === 'scanner' ? 'स्कैनर' : `UPI: ${w.upi_id}`}</p>
                    <p className="text-gray-400 text-xs">{w.approved_at ? utcDate(w.approved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}</p>
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

        {withdrawalSubTab === 'rejected' && (
          rejectedWithdrawals.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400">कोई अस्वीकृत निकासी नहीं</p></div>
          ) : (
            <div className="space-y-3">
              {rejectedWithdrawals.map((w, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[#0A0A0C] rounded-lg border border-red-500/10">
                  <div>
                    <p className="text-white font-medium text-sm">{w.user_name}</p>
                    <p className="text-gray-400 text-xs">{w.user_phone || w.user_email} | {w.withdrawal_method === 'bank' ? `बैंक: ${w.bank_account}` : w.withdrawal_method === 'scanner' ? 'स्कैनर' : `UPI: ${w.upi_id}`}</p>
                    <p className="text-gray-400 text-xs">{w.rejected_at ? utcDate(w.rejected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : ''}</p>
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
  );
};

export default AdminWithdrawalsTab;
