import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { User, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// M11 Logo with Matka Pot SVG
const M11Logo = () => (
  <div className="flex flex-col items-center mb-1">
    <div className="relative">
      {/* M11 Text - metallic chrome style */}
      <div className="text-5xl font-black font-['Unbounded'] tracking-wider text-center leading-none"
        style={{
          background: 'linear-gradient(180deg, #e8eaf0 0%, #a0a8c0 30%, #7080a8 60%, #4a5a80 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 8px rgba(100,120,180,0.3))',
        }}>
        M11
      </div>
      {/* Matka Pot SVG */}
      <div className="flex justify-center mt-1">
        <svg width="40" height="36" viewBox="0 0 40 36" fill="none">
          <ellipse cx="20" cy="6" rx="8" ry="4" stroke="#8090b0" strokeWidth="1.5" fill="none"/>
          <path d="M12 6 C10 12, 6 18, 8 26 C10 32, 16 35, 20 35 C24 35, 30 32, 32 26 C34 18, 30 12, 28 6"
            stroke="#8090b0" strokeWidth="1.5" fill="none"/>
          <ellipse cx="20" cy="6" rx="5" ry="2.5" fill="#2a3a6e" stroke="#6070a0" strokeWidth="0.8"/>
        </svg>
      </div>
    </div>
    <h1 className="text-xl font-black font-['Unbounded'] tracking-widest mt-2"
      style={{
        background: 'linear-gradient(180deg, #c8d0e8 0%, #7888b0 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
      MATKA 11
    </h1>
    <p className="text-[#5a6a90] text-xs mt-0.5 italic">Play Smart, Win Big!</p>
  </div>
);

// Bokeh background lights
const BokehBackground = () => (
  <>
    <div className="absolute inset-0 bg-gradient-to-b from-[#080c18] via-[#0a1020] to-[#060a14]" />
    {/* Bokeh circles */}
    <div className="absolute top-[10%] left-[15%] w-24 h-24 bg-[#1a2a60]/25 rounded-full blur-[40px]" />
    <div className="absolute top-[5%] right-[20%] w-16 h-16 bg-[#3a2a6e]/20 rounded-full blur-[30px]" />
    <div className="absolute top-[30%] left-[60%] w-10 h-10 bg-[#2a4a8e]/15 rounded-full blur-[20px]" />
    <div className="absolute bottom-[25%] left-[10%] w-20 h-20 bg-[#2a1a5e]/20 rounded-full blur-[35px]" />
    <div className="absolute bottom-[15%] right-[15%] w-14 h-14 bg-[#1a3a7e]/15 rounded-full blur-[25px]" />
    <div className="absolute top-[50%] left-[40%] w-8 h-8 bg-[#4a3a8e]/12 rounded-full blur-[15px]" />
    <div className="absolute top-[20%] right-[40%] w-6 h-6 bg-[#5a4a9e]/10 rounded-full blur-[12px]" />
    {/* Small bright dots */}
    <div className="absolute top-[12%] left-[30%] w-1.5 h-1.5 bg-[#6080c0]/40 rounded-full" />
    <div className="absolute top-[25%] right-[25%] w-1 h-1 bg-[#8090c0]/30 rounded-full" />
    <div className="absolute bottom-[35%] left-[20%] w-1 h-1 bg-[#7080b0]/25 rounded-full" />
    <div className="absolute top-[45%] right-[35%] w-1.5 h-1.5 bg-[#5a6a9a]/35 rounded-full" />
  </>
);

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
    if (!name.trim()) { toast.error('Please enter your name'); return; }
    if (phone.length < 10) { toast.error('Please enter valid mobile number'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/signup/send-otp`, { name, phone, password, referral_code: refCode }, { withCredentials: true });
      setStep('otp');
      toast.success('OTP sent successfully!');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('Please enter 4 digit OTP'); return; }
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/signup/verify-otp`, { name, phone, otp, password, referral_code: refCode }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('Account created!');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) { toast.error(e.response?.data?.detail || 'Invalid OTP'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6">
      <BokehBackground />

      {step === 'form' ? (
        <div className="w-full max-w-sm relative z-10">
          <M11Logo />

          <p className="text-white text-center text-base font-semibold mt-4 mb-4">Register Now</p>

          <form onSubmit={handleSendOTP} className="space-y-2.5">
            {/* Name */}
            <div className="flex items-center h-11 bg-[#101828]/90 border border-[#1e2a4a]/60 rounded-xl px-3 gap-2.5 backdrop-blur-sm">
              <User className="w-4 h-4 text-[#4a5a80] flex-shrink-0" />
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required
                data-testid="signup-name-input"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-[#3a4a6a] outline-none" />
            </div>

            {/* Mobile */}
            <div className="flex items-center h-11 bg-[#101828]/90 border border-[#1e2a4a]/60 rounded-xl px-3 gap-2 backdrop-blur-sm">
              <Phone className="w-4 h-4 text-[#4a5a80] flex-shrink-0" />
              <span className="text-[#5a6a8a] text-xs font-semibold">+91</span>
              <div className="w-px h-4 bg-[#1e2a4a]" />
              <input type="tel" placeholder="Mobile Number" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required maxLength={10} data-testid="signup-phone-input"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-[#3a4a6a] outline-none" />
            </div>

            {/* Password */}
            <div className="flex items-center h-11 bg-[#101828]/90 border border-[#1e2a4a]/60 rounded-xl px-3 gap-2.5 backdrop-blur-sm">
              <Lock className="w-4 h-4 text-[#4a5a80] flex-shrink-0" />
              <input type={showPassword ? 'text' : 'password'} placeholder="Create Password" value={password}
                onChange={(e) => setPassword(e.target.value)} required data-testid="signup-password-input"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-[#3a4a6a] outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#4a5a80] hover:text-white">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {refCode && (
              <div className="flex items-center h-9 bg-[#1a0a2e]/40 border border-[#5a3a8e]/30 rounded-xl px-3">
                <span className="text-[#a878d8] text-xs">Referral: <span className="font-bold text-white">{refCode}</span></span>
              </div>
            )}

            <div className="pt-1">
              <Button type="submit" disabled={loading} data-testid="signup-submit-button"
                className="w-full h-11 rounded-xl font-black text-sm tracking-wider text-white shadow-xl shadow-[#1a2a5e]/40 border-0"
                style={{ background: 'linear-gradient(135deg, #1a3a8e 0%, #2a50be 50%, #1a3a8e 100%)' }}>
                {loading ? 'SENDING OTP...' : 'REGISTER & PLAY NOW'}
              </Button>
            </div>
          </form>

          <p className="text-center text-[#4a5a7a] text-sm mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-[#8898c8] hover:text-white font-bold underline underline-offset-2">Log In</Link>
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm relative z-10">
          <button onClick={() => { setStep('form'); setOtp(''); }} data-testid="signup-back-button"
            className="flex items-center gap-2 text-[#4a5a7a] hover:text-white mb-5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm">Back</span>
          </button>

          <div className="flex flex-col items-center mb-5">
            <div className="text-3xl font-black font-['Unbounded']"
              style={{ background: 'linear-gradient(180deg, #c0c8e8 0%, #6070a0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              M11
            </div>
            <h2 className="text-white text-lg font-bold mt-1">Verify OTP</h2>
            <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span className="text-emerald-400 text-xs">OTP sent to +91 {phone}</span>
            </div>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-3">
            <div className="flex items-center h-14 bg-[#101828]/90 border border-[#1e2a4a]/60 rounded-xl backdrop-blur-sm">
              <input type="text" placeholder="- - - -" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required maxLength={4} data-testid="signup-otp-input"
                className="w-full bg-transparent text-white text-center text-3xl tracking-[0.5em] placeholder:text-[#2a3a5a] placeholder:text-xl placeholder:tracking-[0.3em] outline-none h-full" />
            </div>

            <Button type="submit" disabled={loading} data-testid="signup-verify-button"
              className="w-full h-11 rounded-xl font-black text-sm tracking-wider text-white shadow-xl shadow-[#1a2a5e]/40 border-0"
              style={{ background: 'linear-gradient(135deg, #1a3a8e 0%, #2a50be 50%, #1a3a8e 100%)' }}>
              {loading ? 'VERIFYING...' : 'VERIFY & PLAY NOW'}
            </Button>

            <button type="button" onClick={() => { setStep('form'); setOtp(''); }}
              className="w-full text-center text-[#4a5a7a] text-sm hover:text-white">
              Change number or resend OTP
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SignupPage;
