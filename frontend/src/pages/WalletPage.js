import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import FooterNav from '../components/FooterNav';
import { speak } from '../utils/voice';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  ArrowLeft, 
  Wallet, 
  Plus, 
  Minus,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Building2,
  QrCode,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const WalletPage = () => {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);
  const [txFilter, setTxFilter] = useState('all');
  const [appSettings, setAppSettings] = useState({});
  const [cancellingId, setCancellingId] = useState(null);
  const [withdrawMethod, setWithdrawMethod] = useState('upi');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [scannerImage, setScannerImage] = useState(null);
  const [scannerPreview, setScannerPreview] = useState('');
  const [uploadingScanner, setUploadingScanner] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/wallet`, { withCredentials: true });
      setTransactions(data.transactions);
    } catch (error) {
      console.error('Wallet fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPaymentStatus = useCallback(async (orderId) => {
    setCheckingPayment(true);
    let attempts = 0;
    const maxAttempts = 30;
    const pollInterval = 3000;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setCheckingPayment(false);
        toast.info('भुगतान की पुष्टि में समय लग रहा है। कुछ देर बाद पेज रीफ्रेश करें।');
        return;
      }

      try {
        const { data } = await axios.get(
          `${API_URL}/api/wallet/deposit/status/${orderId}`,
          { withCredentials: true }
        );

        if (data.status === 'completed') {
          toast.success(`₹${data.amount} सफलतापूर्वक जमा हो गए!`);
          await refreshUser();
          await fetchWallet();
          setCheckingPayment(false);
          window.history.replaceState({}, '', '/wallet');
          return;
        }

        if (data.status === 'failed') {
          toast.error('भुगतान विफल हो गया');
          setCheckingPayment(false);
          window.history.replaceState({}, '', '/wallet');
          return;
        }

        attempts++;
        setTimeout(poll, pollInterval);
      } catch (error) {
        attempts++;
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, [fetchWallet, refreshUser]);

  useEffect(() => {
    fetchWallet();
    refreshUser();
    
    // Fetch app settings
    axios.get(`${API_URL}/api/settings`).then(r => setAppSettings(r.data)).catch(() => {});
    
    // Check if returning from IMB payment
    const payment = searchParams.get('payment');
    const orderId = searchParams.get('order_id');
    const tab = searchParams.get('tab');
    if (payment === 'success' && orderId) {
      checkPaymentStatus(orderId);
    } else if (payment === 'failed') {
      toast.error('भुगतान विफल हो गया');
      window.history.replaceState({}, '', '/wallet');
    }
    if (tab === 'withdraw') {
      setWithdrawOpen(true);
    }
  }, [fetchWallet, refreshUser, searchParams, checkPaymentStatus]);

  // Voice warning when withdrawal dialog opens and time is outside allowed window
  useEffect(() => {
    if (withdrawOpen && appSettings.withdrawal_start_time && appSettings.withdrawal_end_time) {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const curMin = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = appSettings.withdrawal_start_time.split(':').map(Number);
      const [eh, em] = appSettings.withdrawal_end_time.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const allowed = startMin > endMin ? (curMin >= startMin || curMin <= endMin) : (curMin >= startMin && curMin <= endMin);
      if (!allowed) {
        speak(`निकासी बंद है। निकासी का समय ${appSettings.withdrawal_start_time} से ${appSettings.withdrawal_end_time} तक है`);
      }
    }
  }, [withdrawOpen, appSettings]);

  const handleWithdrawAmountChange = (val) => {
    setWithdrawAmount(val);
    const minW = appSettings.min_withdrawal || 100;
    if (val && parseFloat(val) > 0 && parseFloat(val) < minW) {
      speak(`न्यूनतम निकासी ${minW} रुपये है`);
    }
  };

  const handleDepositAmountChange = (val) => {
    setDepositAmount(val);
    const minD = appSettings.min_deposit || 100;
    if (val && parseFloat(val) > 0 && parseFloat(val) < minD) {
      speak(`न्यूनतम जमा ${minD} रुपये है`);
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    const minD = appSettings.min_deposit || 100;
    if (!amount || amount < minD) {
      toast.error(`न्यूनतम जमा ₹${minD} है`);
      speak(`न्यूनतम जमा ${minD} रुपये है`);
      return;
    }
    if (amount > 50000) {
      toast.error('अधिकतम जमा ₹50,000 है');
      return;
    }

    setProcessing(true);

    try {
      const { data } = await axios.post(`${API_URL}/api/wallet/deposit`, {
        amount: amount,
        origin_url: window.location.origin
      }, { withCredentials: true });

      // Try to open in new tab
      const paymentWindow = window.open(data.url, '_blank');
      
      if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
        // Popup blocked — show payment link in dialog
        setPaymentLink(data.url);
      } else {
        setDepositOpen(false);
        setDepositAmount('');
        toast.success('भुगतान पेज नई टैब में खुल गया है।');
      }
      
      // Start polling for payment status
      checkPaymentStatus(data.order_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'जमा अनुरोध विफल');
    } finally {
      setProcessing(false);
    }
  };

  const handleScannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('केवल इमेज फाइल अपलोड करें');
      return;
    }
    setScannerPreview(URL.createObjectURL(file));
    setUploadingScanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post(`${API_URL}/api/wallet/upload-scanner`, formData, { withCredentials: true });
      setScannerImage(data.url);
      toast.success('स्कैनर अपलोड हो गया');
    } catch (error) {
      toast.error('स्कैनर अपलोड विफल');
      setScannerPreview('');
    } finally {
      setUploadingScanner(false);
    }
  };

  const handleWithdraw = async () => {
    const minW = appSettings.min_withdrawal || 100;
    if (!withdrawAmount || parseFloat(withdrawAmount) < minW) {
      toast.error(`न्यूनतम निकासी ₹${minW} है`);
      speak(`न्यूनतम निकासी ${minW} रुपये है`);
      return;
    }

    if (parseFloat(withdrawAmount) > (user?.balance || 0)) {
      toast.error('अपर्याप्त बैलेंस');
      return;
    }

    if (withdrawMethod === 'upi' && !upiId) {
      toast.error('कृपया UPI ID दर्ज करें');
      return;
    }
    if (withdrawMethod === 'bank' && (!bankAccount || !ifscCode || !accountHolder)) {
      toast.error('कृपया सभी बैंक डिटेल्स भरें');
      return;
    }
    if (withdrawMethod === 'scanner' && !scannerImage) {
      toast.error('कृपया QR/स्कैनर इमेज अपलोड करें');
      return;
    }

    setProcessing(true);

    try {
      const payload = {
        amount: parseFloat(withdrawAmount),
        withdrawal_method: withdrawMethod,
      };
      if (withdrawMethod === 'upi') payload.upi_id = upiId;
      if (withdrawMethod === 'bank') {
        payload.bank_account = bankAccount;
        payload.ifsc_code = ifscCode;
        payload.account_holder = accountHolder;
      }
      if (withdrawMethod === 'scanner') payload.scanner_image = scannerImage;

      await axios.post(`${API_URL}/api/wallet/withdraw`, payload, { withCredentials: true });

      toast.success('निकासी अनुरोध सबमिट हो गया');
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setUpiId('');
      setBankAccount('');
      setIfscCode('');
      setAccountHolder('');
      setScannerImage(null);
      setScannerPreview('');
      setWithdrawMethod('upi');
      await refreshUser();
      await fetchWallet();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'निकासी अनुरोध विफल');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelWithdrawal = async (txId) => {
    setCancellingId(txId);
    try {
      await axios.post(`${API_URL}/api/wallet/withdraw/${txId}/cancel`, {}, { withCredentials: true });
      toast.success('निकासी रद्द कर दी गई, राशि वापस आ गई');
      await refreshUser();
      await fetchWallet();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'निकासी रद्द करने में विफल');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3 mr-1" /> पूर्ण</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" /> लंबित</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> अस्वीकृत</Badge>;
      case 'cancelled':
        return <Badge className="bg-orange-500/20 text-orange-400"><XCircle className="w-3 h-3 mr-1" /> रद्द</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-xl font-bold text-white font-['Unbounded']">वॉलेट</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Payment Status Check */}
        {checkingPayment && (
          <Card className="bg-[#D4AF37]/10 border-[#D4AF37]/30 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
                <div>
                  <p className="text-white font-medium">भुगतान स्थिति की जांच हो रही है...</p>
                  <p className="text-gray-400 text-sm">कृपया प्रतीक्षा करें</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] border-[#D4AF37]/30 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 mb-1">कुल बैलेंस</p>
                <p className="text-4xl font-bold text-white font-['Unbounded']">
                  ₹{user?.balance?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-[#D4AF37]" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                onClick={() => { setDepositOpen(true); setPaymentLink(null); }}
                data-testid="deposit-button"
                className="h-12 bg-[#10B981] hover:bg-[#059669] text-white font-bold"
              >
                <Plus className="w-5 h-5 mr-2" />
                जमा करें
              </Button>
              <Button
                onClick={() => setWithdrawOpen(true)}
                data-testid="withdraw-button"
                variant="outline"
                className="h-12 border-white/20 text-white hover:bg-white/10"
              >
                <Minus className="w-5 h-5 mr-2" />
                निकासी
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="bg-[#141418] border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-['Unbounded']">लेनदेन</CardTitle>
              <a
                href={`${API_URL}/api/wallet/export`}
                data-testid="export-transactions"
                className="px-3 py-1.5 rounded-lg bg-[#0A0A0C] border border-white/10 text-gray-400 hover:text-white text-xs font-medium transition-all flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </a>
            </div>
            {/* Filter Tabs */}
            <div className="flex gap-2 mt-3">
              {[
                { key: 'all', label: 'सभी' },
                { key: 'deposit', label: 'जमा' },
                { key: 'withdrawal', label: 'निकासी' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTxFilter(tab.key)}
                  data-testid={`tx-filter-${tab.key}`}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    txFilter === tab.key
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : transactions.filter(tx => txFilter === 'all' || tx.type === txFilter).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">कोई लेनदेन नहीं</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions
                  .filter(tx => txFilter === 'all' || tx.type === txFilter)
                  .map((tx, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'deposit' 
                          ? 'bg-emerald-500/20' 
                          : 'bg-red-500/20'
                      }`}>
                        {tx.type === 'deposit' 
                          ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                          : <ArrowUpRight className="w-5 h-5 text-red-400" />
                        }
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {tx.type === 'deposit' ? 'जमा' : 'निकासी'}
                          {tx.type === 'withdrawal' && tx.upi_id && (
                            <span className="text-gray-500 text-xs ml-2">({tx.upi_id})</span>
                          )}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {utcDate(tx.created_at).toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' })} • {utcDate(tx.created_at).toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className={`font-bold ${
                        tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}
                      </p>
                      {getStatusBadge(tx.status)}
                      {tx.type === 'withdrawal' && tx.status === 'pending' && (
                        <button
                          onClick={() => handleCancelWithdrawal(tx.id)}
                          disabled={cancellingId === tx.id}
                          data-testid={`cancel-withdrawal-${tx.id}`}
                          className="mt-1 px-3 py-1 text-xs font-bold rounded-lg bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/40 hover:text-red-300 transition-all disabled:opacity-50"
                        >
                          {cancellingId === tx.id ? 'रद्द हो रहा...' : 'रद्द करें'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded']">पैसे जमा करें</DialogTitle>
            <DialogDescription className="text-gray-400">
              राशि दर्ज करें और UPI से भुगतान करें
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-300">राशि (₹)</Label>
              <Input
                type="number"
                placeholder={`राशि दर्ज करें (न्यूनतम ₹${appSettings.min_deposit || 100})`}
                value={depositAmount}
                onChange={(e) => handleDepositAmountChange(e.target.value)}
                data-testid="deposit-amount-input"
                className="bg-[#0A0A0C] border-white/10 text-white mt-2 text-lg h-12"
              />
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 2000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDepositAmount(String(amt))}
                  data-testid={`deposit-quick-${amt}`}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    depositAmount === String(amt)
                      ? 'bg-[#D4AF37] text-black'
                      : 'bg-[#0A0A0C] text-gray-300 border border-white/10 hover:border-[#D4AF37]/50'
                  }`}
                >
                  ₹{amt >= 1000 ? `${amt/1000}K` : amt}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleDeposit}
            disabled={!depositAmount || parseFloat(depositAmount) < 100 || processing}
            data-testid="confirm-deposit-button"
            className="w-full mt-4 h-12 bg-[#10B981] hover:bg-[#059669] text-white font-bold"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                प्रोसेसिंग...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {depositAmount && parseFloat(depositAmount) >= 100
                  ? `₹${depositAmount} जमा करें`
                  : 'भुगतान करें'
                }
              </span>
            )}
          </Button>

          {/* Payment Link - shown when popup is blocked */}
          {paymentLink && (
            <div className="mt-3 p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg">
              <p className="text-sm text-gray-300 mb-2">भुगतान पेज खोलने के लिए नीचे क्लिक करें:</p>
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="payment-link-btn"
                className="block w-full text-center py-3 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold rounded-lg transition-all"
              >
                भुगतान पेज खोलें
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Unbounded']">पैसे निकालें</DialogTitle>
            <DialogDescription className="text-gray-400">
              निकासी राशि और UPI ID दर्ज करें
            </DialogDescription>
          </DialogHeader>
          
          {/* Withdrawal Time Warning */}
          {appSettings.withdrawal_start_time && appSettings.withdrawal_end_time && (() => {
            const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const curMin = now.getHours() * 60 + now.getMinutes();
            const [sh, sm] = appSettings.withdrawal_start_time.split(':').map(Number);
            const [eh, em] = appSettings.withdrawal_end_time.split(':').map(Number);
            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            const allowed = startMin > endMin ? (curMin >= startMin || curMin <= endMin) : (curMin >= startMin && curMin <= endMin);
            if (!allowed) {
              return (
                <div className="blink-warning bg-red-600/20 border-2 border-red-500 rounded-xl p-4 text-center mt-2" data-testid="withdrawal-time-warning">
                  <p className="text-red-500 text-xl font-black">निकासी बंद है!</p>
                  <p className="text-red-400 text-lg font-bold mt-1">निकासी का समय {appSettings.withdrawal_start_time} से {appSettings.withdrawal_end_time} तक है</p>
                </div>
              );
            }
            return (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center mt-2">
                <p className="text-green-400 text-sm font-medium">निकासी समय: {appSettings.withdrawal_start_time} - {appSettings.withdrawal_end_time}</p>
              </div>
            );
          })()}
          
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-300">राशि (₹)</Label>
              <Input
                type="number"
                placeholder={`न्यूनतम ₹${appSettings.min_withdrawal || 100}`}
                value={withdrawAmount}
                onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                data-testid="withdraw-amount-input"
                className="bg-[#0A0A0C] border-white/10 text-white mt-2"
              />
              {withdrawAmount && parseFloat(withdrawAmount) < (appSettings.min_withdrawal || 100) && (
                <div className="blink-warning mt-2 p-2 rounded-lg bg-red-600/20 border border-red-500">
                  <p className="text-red-500 text-lg font-black text-center">न्यूनतम निकासी ₹{appSettings.min_withdrawal || 100} है!</p>
                </div>
              )}
              <p className="text-gray-400 text-sm mt-1">
                उपलब्ध: ₹{user?.balance?.toFixed(2) || '0.00'}
              </p>
            </div>
            
            {/* Method Tabs */}
            <div>
              <Label className="text-gray-300 mb-2 block">भुगतान विधि चुनें</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'upi', label: 'UPI ID', icon: <CreditCard className="w-4 h-4" /> },
                  { key: 'bank', label: 'बैंक', icon: <Building2 className="w-4 h-4" /> },
                  { key: 'scanner', label: 'स्कैनर', icon: <QrCode className="w-4 h-4" /> },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setWithdrawMethod(m.key)}
                    data-testid={`withdraw-method-${m.key}`}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg text-sm font-bold transition-all ${
                      withdrawMethod === m.key
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* UPI Fields */}
            {withdrawMethod === 'upi' && (
              <div>
                <Label className="text-gray-300">UPI ID</Label>
                <Input
                  type="text"
                  placeholder="example@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  data-testid="withdraw-upi-input"
                  className="bg-[#0A0A0C] border-white/10 text-white mt-2"
                />
              </div>
            )}

            {/* Bank Account Fields */}
            {withdrawMethod === 'bank' && (
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-300">खाताधारक का नाम</Label>
                  <Input
                    type="text"
                    placeholder="खाताधारक का नाम"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    data-testid="withdraw-account-holder"
                    className="bg-[#0A0A0C] border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">अकाउंट नंबर</Label>
                  <Input
                    type="text"
                    placeholder="अकाउंट नंबर"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    data-testid="withdraw-bank-account"
                    className="bg-[#0A0A0C] border-white/10 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">IFSC कोड</Label>
                  <Input
                    type="text"
                    placeholder="IFSC कोड"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    data-testid="withdraw-ifsc-code"
                    className="bg-[#0A0A0C] border-white/10 text-white mt-1"
                  />
                </div>
              </div>
            )}

            {/* Scanner Upload */}
            {withdrawMethod === 'scanner' && (
              <div>
                <Label className="text-gray-300">QR / स्कैनर इमेज अपलोड करें</Label>
                <div className="mt-2">
                  {scannerPreview ? (
                    <div className="relative">
                      <img src={scannerPreview} alt="Scanner" className="w-full max-h-48 object-contain rounded-lg border border-white/10" />
                      <button
                        onClick={() => { setScannerPreview(''); setScannerImage(null); }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      {uploadingScanner && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-white/20 hover:border-[#D4AF37]/50 cursor-pointer transition-all bg-[#0A0A0C]" data-testid="scanner-upload-area">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-gray-400 text-sm">इमेज चुनें या यहाँ ड्रॉप करें</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleScannerUpload} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleWithdraw}
            disabled={processing}
            data-testid="confirm-withdraw-button"
            className="w-full mt-4 h-12 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                प्रोसेसिंग...
              </span>
            ) : (
              'निकासी अनुरोध भेजें'
            )}
          </Button>
        </DialogContent>
      </Dialog>
      <FooterNav />
    </div>
  );
};

export default WalletPage;
