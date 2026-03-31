import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Coins, Smartphone, ArrowLeft, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SignupPage = () => {
  const [method, setMethod] = useState(null);
  const [step, setStep] = useState('form'); // 'form', 'otp', 'password'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('कृपया नाम दर्ज करें'); return; }
    if (!email.trim() || !email.includes('@')) { toast.error('कृपया सही ईमेल दर्ज करें'); return; }
    if (phone.length < 10) { toast.error('कृपया सही मोबाइल नंबर दर्ज करें'); return; }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/otp/send`, { phone, name, email }, { withCredentials: true });
      setStep('otp');
      toast.success('OTP भेज दिया गया है (Demo: 1234)');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP भेजने में समस्या');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('कृपया 4 अंकों का OTP दर्ज करें'); return; }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/otp/verify`, { phone, otp }, { withCredentials: true });
      setStep('password');
      toast.success('OTP सत्यापित! अब पासवर्ड बनाएं');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP गलत है');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async (e) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('पासवर्ड कम से कम 6 अक्षर का होना चाहिए'); return; }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/otp/complete-signup`, { phone, name, email, password }, { withCredentials: true });
      toast.success('अकाउंट बन गया! स्वागत है');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'अकाउंट बनाने में समस्या');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // Method selection screen
  if (!method) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0C]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-md bg-[#141418] border-white/10 relative z-10">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center">
                <Coins className="w-8 h-8 text-black" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white font-['Unbounded']">
              नया अकाउंट बनाएं
            </CardTitle>
            <p className="text-gray-400">अपना पसंदीदा तरीका चुनें</p>
          </CardHeader>

          <CardContent className="space-y-4">
            <button
              onClick={() => setMethod('otp')}
              data-testid="signup-otp-option"
              className="w-full p-4 rounded-xl bg-[#0A0A0C] border border-white/10 hover:border-[#D4AF37]/50 transition-all flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-bold">OTP से साइनअप करें</p>
                <p className="text-gray-500 text-sm">मोबाइल नंबर + OTP वेरीफाई</p>
              </div>
            </button>

            <button
              onClick={handleGoogleSignup}
              data-testid="signup-google-option"
              className="w-full p-4 rounded-xl bg-[#0A0A0C] border border-white/10 hover:border-[#D4AF37]/50 transition-all flex items-center gap-4 group"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="text-left flex-1">
                <p className="text-white font-bold">Continue with Gmail</p>
                <p className="text-gray-500 text-sm">Google अकाउंट से लॉगिन करें</p>
              </div>
            </button>

            <div className="pt-4 text-center">
              <p className="text-gray-400">
                पहले से अकाउंट है?{' '}
                <Link to="/login" className="text-[#D4AF37] hover:text-[#FDE047] font-medium">
                  लॉगिन करें
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // OTP Form Steps
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0C]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md bg-[#141418] border-white/10 relative z-10">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (step === 'password') { setStep('otp'); setPassword(''); }
                else if (step === 'otp') { setStep('form'); setOtp(''); }
                else { setMethod(null); }
              }}
              className="p-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-gray-400 hover:text-white transition-all"
              data-testid="signup-back-button"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <CardTitle className="text-xl font-bold text-white font-['Unbounded']">
              {step === 'password' ? 'पासवर्ड बनाएं' : step === 'otp' ? 'OTP दर्ज करें' : 'OTP से साइनअप'}
            </CardTitle>
          </div>
          {/* Step indicator */}
          <div className="flex gap-2">
            <div className={`h-1 flex-1 rounded-full ${step === 'form' || step === 'otp' || step === 'password' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
            <div className={`h-1 flex-1 rounded-full ${step === 'otp' || step === 'password' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
            <div className={`h-1 flex-1 rounded-full ${step === 'password' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
          </div>
        </CardHeader>

        <CardContent>
          {step === 'form' && (
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
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">ईमेल (Gmail)</Label>
                <Input
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="otp-email-input"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
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
                    className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="send-otp-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                {loading ? 'OTP भेज रहे हैं...' : 'OTP भेजें'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
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
                  className="bg-[#0A0A0C] border-white/10 text-white text-center text-2xl tracking-[1em] placeholder:text-gray-500 placeholder:tracking-normal placeholder:text-base focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="verify-otp-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                {loading ? 'सत्यापित हो रहा है...' : 'OTP सत्यापित करें'}
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

          {step === 'password' && (
            <form onSubmit={handleCompleteSignup} className="space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-green-400 text-sm">+91 {phone} सत्यापित हो गया</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">पासवर्ड बनाएं</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="कम से कम 6 अक्षर"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="signup-password-input"
                    className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-gray-500 text-xs">यह पासवर्ड लॉगिन के लिए उपयोग होगा</p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="complete-signup-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                {loading ? 'अकाउंट बन रहा है...' : 'अकाउंट बनाएं'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SignupPage;
