import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, CheckCircle, Phone, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LoginPage = () => {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (phone.length < 10) { toast.error('कृपया सही मोबाइल नंबर दर्ज करें'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/login-otp/send`, { phone }, { withCredentials: true });
      setStep('otp');
      toast.success('OTP भेज दिया गया है');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP भेजने में समस्या');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('कृपया 4 अंकों का OTP दर्ज करें'); return; }
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/login-otp/verify`, { phone, otp }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('लॉगिन सफल!');
      if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((reg) => { if (window.subscribePush) window.subscribePush(reg); });
      }
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP गलत है');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-[#D4AF37]/8 to-transparent" />
      <div className="absolute top-32 left-[-40px] w-36 h-36 bg-[#D4AF37]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-[-30px] w-28 h-28 bg-[#10B981]/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center px-5 pt-16 pb-8">
        {step === 'phone' ? (
          <>
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#FDE047] to-[#D4AF37] flex items-center justify-center font-black font-['Unbounded'] text-black text-2xl shadow-lg shadow-[#D4AF37]/30">
                M
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-3xl font-black font-['Unbounded'] bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] bg-clip-text text-transparent">MATKA</span>
                <span className="text-4xl font-black font-['Unbounded'] text-white">11</span>
              </div>
            </div>
            <p className="text-gray-500 text-xs mb-10">India's Trusted Matka Platform</p>

            <h1 className="text-white text-2xl font-black font-['Unbounded'] mb-1">लॉगिन करें</h1>
            <p className="text-gray-400 text-sm mb-8">अपने मोबाइल नंबर से लॉगिन करें</p>

            <form onSubmit={handleSendOTP} className="w-full max-w-sm space-y-4">
              <div>
                <p className="text-gray-400 text-xs mb-2 ml-1">मोबाइल नंबर</p>
                <div className="flex">
                  <span className="flex items-center px-4 bg-[#141418] border border-white/10 border-r-0 rounded-l-xl text-[#D4AF37] font-bold text-sm">+91</span>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input type="tel" placeholder="XXXXXXXXXX" value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required maxLength={10} data-testid="login-phone-input"
                      className="pl-10 h-12 bg-[#141418] border-white/10 text-white text-lg tracking-wider placeholder:text-gray-500 rounded-l-none rounded-r-xl focus:border-[#D4AF37] focus:ring-[#D4AF37]" />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={loading} data-testid="login-send-otp-button"
                className="w-full h-12 bg-gradient-to-r from-[#D4AF37] to-[#FDE047] hover:from-[#FDE047] hover:to-[#D4AF37] text-black font-black text-base rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all">
                {loading ? 'OTP भेज रहे हैं...' : <><span>OTP भेजें</span><ChevronRight className="w-5 h-5 ml-1 inline" /></>}
              </Button>

              <p className="text-center text-gray-400 text-sm mt-6">
                नया अकाउंट बनाएं?{' '}
                <Link to="/signup" className="text-[#D4AF37] hover:text-[#FDE047] font-bold">साइनअप करें</Link>
              </p>
            </form>
          </>
        ) : (
          <>
            {/* OTP Step */}
            <div className="w-full max-w-sm">
              <button onClick={() => { setStep('phone'); setOtp(''); }} data-testid="login-back-button"
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-all">
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">वापस जाएं</span>
              </button>

              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center font-black font-['Unbounded'] text-black text-sm">M</div>
                <h1 className="text-white text-xl font-black font-['Unbounded']">OTP दर्ज करें</h1>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 mb-6">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-400 text-sm">+91 {phone} पर OTP भेज दिया गया</p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <p className="text-gray-400 text-xs mb-2 ml-1">4 अंकों का OTP</p>
                  <Input type="text" placeholder="- - - -" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required maxLength={4} data-testid="login-otp-input"
                    className="h-14 bg-[#141418] border-white/10 text-white text-center text-3xl tracking-[0.5em] placeholder:text-gray-600 placeholder:tracking-[0.3em] placeholder:text-xl rounded-xl focus:border-[#D4AF37] focus:ring-[#D4AF37]" />
                </div>

                <Button type="submit" disabled={loading} data-testid="login-verify-otp-button"
                  className="w-full h-12 bg-gradient-to-r from-[#D4AF37] to-[#FDE047] hover:from-[#FDE047] hover:to-[#D4AF37] text-black font-black text-base rounded-xl shadow-lg shadow-[#D4AF37]/20">
                  {loading ? 'लॉगिन हो रहा है...' : <><span>लॉगिन करें</span><ChevronRight className="w-5 h-5 ml-1 inline" /></>}
                </Button>

                <button type="button" onClick={() => { setStep('phone'); setOtp(''); }}
                  className="w-full text-center text-[#D4AF37] text-sm font-medium hover:text-[#FDE047] transition-all">
                  नंबर बदलें या दोबारा OTP भेजें
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
