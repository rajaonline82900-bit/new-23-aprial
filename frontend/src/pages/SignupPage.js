import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { User, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SignupPage = () => {
  const [step, setStep] = useState('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('कृपया नाम दर्ज करें'); return; }
    if (phone.length < 10) { toast.error('कृपया सही मोबाइल नंबर दर्ज करें'); return; }
    if (password.length < 6) { toast.error('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/signup/send-otp`, { name, phone, password, referral_code: refCode }, { withCredentials: true });
      setStep('otp');
      toast.success('OTP भेज दिया गया है');
    } catch (e) { toast.error(e.response?.data?.detail || 'OTP भेजने में समस्या'); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('कृपया 4 अंकों का OTP दर्ज करें'); return; }
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/signup/verify-otp`, { name, phone, otp, password, referral_code: refCode }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('अकाउंट बन गया!');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) { toast.error(e.response?.data?.detail || 'OTP गलत है'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-[#0d1225] to-[#060a14] flex flex-col items-center justify-center px-5 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#1a2a5e]/30 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-80px] right-[-60px] w-[200px] h-[200px] bg-[#2a1a5e]/20 rounded-full blur-[100px]" />

      {step === 'form' ? (
        <div className="w-full max-w-sm relative z-10">
          {/* M11 Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2a3a6e] via-[#1a2550] to-[#0f1a3a] border border-[#3a4a8e]/40 flex items-center justify-center mb-3 shadow-2xl shadow-[#1a2a5e]/50">
              <span className="text-3xl font-black font-['Unbounded'] bg-gradient-to-b from-[#c0c8e8] via-[#8090c0] to-[#5060a0] bg-clip-text text-transparent drop-shadow-lg">M11</span>
            </div>
            <h1 className="text-white text-2xl font-black font-['Unbounded'] tracking-wide">MATKA 11</h1>
            <p className="text-[#6878a8] text-sm mt-1">Play Smart, Win Big!</p>
          </div>

          <p className="text-white text-center text-lg font-bold mb-5">Register Now</p>

          <form onSubmit={handleSendOTP} className="space-y-3">
            {/* Name */}
            <div className="relative flex items-center h-12 bg-[#0f1528]/80 border border-[#2a3a6e]/50 rounded-xl overflow-hidden">
              <User className="w-4 h-4 text-[#5068a0] ml-4 mr-3 flex-shrink-0" />
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required
                data-testid="signup-name-input"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-[#4a5a8a] outline-none h-full pr-4" />
            </div>

            {/* Mobile */}
            <div className="relative flex items-center h-12 bg-[#0f1528]/80 border border-[#2a3a6e]/50 rounded-xl overflow-hidden">
              <Phone className="w-4 h-4 text-[#5068a0] ml-4 mr-2 flex-shrink-0" />
              <span className="text-[#6878a8] text-sm font-medium mr-1">+91</span>
              <div className="w-px h-5 bg-[#2a3a6e]/60 mr-2" />
              <input type="tel" placeholder="Mobile Number" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required maxLength={10} data-testid="signup-phone-input"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-[#4a5a8a] outline-none h-full pr-4" />
            </div>

            {/* Password */}
            <div className="relative flex items-center h-12 bg-[#0f1528]/80 border border-[#2a3a6e]/50 rounded-xl overflow-hidden">
              <Lock className="w-4 h-4 text-[#5068a0] ml-4 mr-3 flex-shrink-0" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Create Password" value={password}
                onChange={(e) => setPassword(e.target.value)} required data-testid="signup-password-input"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-[#4a5a8a] outline-none h-full" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="px-4 text-[#5068a0] hover:text-white transition-all">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {refCode && (
              <div className="flex items-center h-10 bg-[#1a0a2e]/50 border border-[#6a3a9e]/30 rounded-xl px-4">
                <span className="text-[#a878d8] text-xs">Referral: <span className="font-bold text-white">{refCode}</span></span>
              </div>
            )}

            <Button type="submit" disabled={loading} data-testid="signup-submit-button"
              className="w-full h-12 bg-gradient-to-r from-[#1a3a8e] via-[#2a4aae] to-[#1a3a8e] hover:from-[#2a4aae] hover:to-[#1a3a8e] text-white font-black text-base rounded-xl shadow-lg shadow-[#1a2a5e]/50 border border-[#3a5abe]/30 tracking-wider transition-all">
              {loading ? 'OTP भेज रहे हैं...' : 'REGISTER & PLAY NOW'}
            </Button>
          </form>

          <p className="text-center text-[#5a6a9a] text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-white hover:text-[#8090c0] font-bold underline">Log In</Link>
          </p>
        </div>
      ) : (
        /* OTP Step */
        <div className="w-full max-w-sm relative z-10">
          <button onClick={() => { setStep('form'); setOtp(''); }} data-testid="signup-back-button"
            className="flex items-center gap-2 text-[#5a6a9a] hover:text-white mb-6 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm">Back</span>
          </button>

          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#2a3a6e] via-[#1a2550] to-[#0f1a3a] border border-[#3a4a8e]/40 flex items-center justify-center mb-3">
              <span className="text-xl font-black font-['Unbounded'] bg-gradient-to-b from-[#c0c8e8] to-[#5060a0] bg-clip-text text-transparent">M11</span>
            </div>
            <h2 className="text-white text-xl font-bold">Enter OTP</h2>
            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span className="text-emerald-400 text-xs">OTP sent to +91 {phone}</span>
            </div>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="relative flex items-center h-14 bg-[#0f1528]/80 border border-[#2a3a6e]/50 rounded-xl overflow-hidden">
              <input type="text" placeholder="- - - -" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required maxLength={4} data-testid="signup-otp-input"
                className="w-full bg-transparent text-white text-center text-3xl tracking-[0.5em] placeholder:text-[#3a4a7a] placeholder:text-xl placeholder:tracking-[0.3em] outline-none h-full" />
            </div>

            <Button type="submit" disabled={loading} data-testid="signup-verify-button"
              className="w-full h-12 bg-gradient-to-r from-[#1a3a8e] via-[#2a4aae] to-[#1a3a8e] hover:from-[#2a4aae] hover:to-[#1a3a8e] text-white font-black text-base rounded-xl shadow-lg shadow-[#1a2a5e]/50 border border-[#3a5abe]/30 tracking-wider">
              {loading ? 'Verifying...' : 'VERIFY & PLAY NOW'}
            </Button>

            <button type="button" onClick={() => { setStep('form'); setOtp(''); }}
              className="w-full text-center text-[#5a6a9a] text-sm hover:text-white transition-all">
              Change number or resend OTP
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SignupPage;
