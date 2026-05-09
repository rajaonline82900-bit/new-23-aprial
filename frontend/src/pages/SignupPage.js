import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SignupPage = () => {
  const [mode, setMode] = useState('otp'); // 'otp' | 'password'
  const [step, setStep] = useState('form'); // 'form', 'otp'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get('ref') || '';
  const [refCode, setRefCode] = useState(urlRefCode);

  const handleGoogleSignup = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handlePasswordSignup = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error('कृपया नाम दर्ज करें (कम से कम 2 अक्षर)'); return; }
    if (!/^\d{10}$/.test(phone)) { toast.error('10 अंकों का मोबाइल नंबर डालें'); return; }
    if (password.length < 6) { toast.error('पासवर्ड कम से कम 6 अक्षर का चाहिए'); return; }

    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/register-mobile`, {
        name: name.trim(), phone, password, referral_code: refCode || undefined
      }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('अकाउंट बन गया! स्वागत है');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Signup में समस्या');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('कृपया नाम दर्ज करें'); return; }
    if (phone.length < 10) { toast.error('कृपया सही मोबाइल नंबर दर्ज करें'); return; }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/otp/send`, { phone, name }, { withCredentials: true });
      setStep('otp');
      toast.success('OTP भेज दिया गया है');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP भेजने में समस्या');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSignup = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('कृपया 4 अंकों का OTP दर्ज करें'); return; }

    setLoading(true);
    try {
      // First verify OTP
      await axios.post(`${API_URL}/api/auth/otp/verify`, { phone, otp }, { withCredentials: true });
      
      // Then complete signup (no password needed)
      const resp = await axios.post(`${API_URL}/api/auth/otp/complete-signup`, { 
        phone, name,
        referral_code: refCode || undefined
      }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      
      toast.success('अकाउंट बन गया! स्वागत है');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP गलत है');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0C]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-sm bg-[#141418] border-white/10 relative z-10">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            {step === 'otp' && (
              <button
                onClick={() => { setStep('form'); setOtp(''); }}
                className="p-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-gray-400 hover:text-white transition-all"
                data-testid="signup-back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {step === 'form' && (
              <div className="flex justify-center w-full">
                <MatkaLogo size="lg" />
              </div>
            )}
            {step === 'otp' && (
              <CardTitle className="text-xl font-bold text-white font-['Unbounded']">
                OTP दर्ज करें
              </CardTitle>
            )}
          </div>
          {step === 'form' && (
            <CardTitle className="text-xl font-bold text-white font-['Unbounded'] text-center">
              नया अकाउंट बनाएं
            </CardTitle>
          )}
          {/* Step indicator */}
          <div className="flex gap-2">
            <div className={`h-1 flex-1 rounded-full ${step === 'form' || step === 'otp' ? 'bg-[#D4AF37]' : 'bg-[#0A0A0C]/10'}`} />
            <div className={`h-1 flex-1 rounded-full ${step === 'otp' ? 'bg-[#D4AF37]' : 'bg-[#0A0A0C]/10'}`} />
          </div>
        </CardHeader>

        <CardContent>
          {step === 'form' && (
            <>
              {/* Google Auth Button - top */}
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={loading}
                data-testid="signup-google-btn"
                className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-gray-100 text-gray-800 font-bold rounded-md transition-all disabled:opacity-50 mb-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center text-xs"><span className="px-2 bg-[#141418] text-gray-500">या</span></div>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-2 p-1 bg-[#0A0A0C] rounded-lg border border-white/5 mb-3">
                <button
                  type="button"
                  onClick={() => setMode('otp')}
                  data-testid="signup-mode-otp"
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${mode === 'otp' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}`}
                >Mobile + OTP</button>
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  data-testid="signup-mode-password"
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${mode === 'password' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}`}
                >Mobile + Password</button>
              </div>
            </>
          )}

          {step === 'form' && mode === 'otp' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">नाम</Label>
                <Input
                  type="text"
                  placeholder="आपका नाम"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="otp-name-input"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">मोबाइल नंबर</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-[#0A0A0C] border border-white/10 rounded-md text-gray-400 text-sm">
                    +91
                  </div>
                  <Input
                    type="tel"
                    placeholder="XXXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    maxLength={10}
                    data-testid="otp-phone-input"
                    className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">रेफरल कोड <span className="text-gray-500 text-xs">(optional)</span></Label>
                <Input
                  type="text"
                  placeholder="दोस्त का रेफरल कोड"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  maxLength={10}
                  data-testid="signup-referral-input"
                  disabled={!!urlRefCode}
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37] uppercase"
                />
                {urlRefCode && (
                  <p className="text-[#D4AF37] text-xs">लिंक से रेफरल कोड लागू है</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="send-otp-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                {loading ? 'OTP भेज रहे हैं...' : 'OTP भेजें'}
              </Button>

              {refCode && (
                <div className="p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-center">
                  <p className="text-[#D4AF37] text-sm font-medium" data-testid="referral-applied-msg">
                    रेफरल कोड: <span className="font-bold">{refCode.toUpperCase()}</span> लागू होगा
                  </p>
                </div>
              )}

              <div className="pt-2 text-center">
                <p className="text-gray-400">
                  पहले से अकाउंट है?{' '}
                  <Link to="/login" className="text-[#D4AF37] hover:text-[#FDE047] font-medium">
                    लॉगिन करें
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === 'form' && mode === 'password' && (
            <form onSubmit={handlePasswordSignup} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">नाम</Label>
                <Input
                  type="text" placeholder="आपका नाम"
                  value={name} onChange={(e) => setName(e.target.value)}
                  required data-testid="password-name-input"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">मोबाइल नंबर</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-[#0A0A0C] border border-white/10 rounded-md text-gray-400 text-sm">+91</div>
                  <Input
                    type="tel" placeholder="XXXXXXXXXX"
                    value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required maxLength={10} data-testid="password-phone-input"
                    className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">पासवर्ड</Label>
                <Input
                  type="password" placeholder="कम से कम 6 अक्षर"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={6} data-testid="password-input"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">रेफरल कोड <span className="text-gray-500 text-xs">(optional)</span></Label>
                <Input
                  type="text" placeholder="दोस्त का रेफरल कोड"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  maxLength={10} disabled={!!urlRefCode} data-testid="signup-referral-input-pwd"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37] uppercase"
                />
              </div>
              <Button type="submit" disabled={loading} data-testid="password-signup-btn"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
                {loading ? 'अकाउंट बन रहा है...' : 'अकाउंट बनाएं'}
              </Button>
              <div className="pt-2 text-center">
                <p className="text-gray-400">पहले से अकाउंट है?{' '}
                  <Link to="/login" className="text-[#D4AF37] hover:text-[#FDE047] font-medium">लॉगिन करें</Link>
                </p>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyAndSignup} className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-green-400 text-sm">+91 {phone} पर OTP भेज दिया गया</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">OTP दर्ज करें</Label>
                <Input
                  type="text"
                  placeholder="4 अंकों का OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  required
                  maxLength={4}
                  data-testid="otp-code-input"
                  className="bg-[#0A0A0C] border-white/10 text-white text-center text-2xl tracking-[1em] placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-base focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="verify-otp-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                {loading ? 'अकाउंट बन रहा है...' : 'अकाउंट बनाएं'}
              </Button>

              <button
                type="button"
                onClick={() => { setStep('form'); setOtp(''); }}
                className="w-full text-center text-gray-400 text-sm hover:text-white transition-all"
              >
                नंबर बदलें या दोबारा OTP भेजें
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SignupPage;
