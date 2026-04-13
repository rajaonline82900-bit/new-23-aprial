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
  const [step, setStep] = useState('form'); // 'form', 'otp'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-sm bg-gray-50 border-gray-200 relative z-10">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            {step === 'otp' && (
              <button
                onClick={() => { setStep('form'); setOtp(''); }}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 transition-all"
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
              <CardTitle className="text-xl font-bold text-gray-900 font-['Unbounded']">
                OTP दर्ज करें
              </CardTitle>
            )}
          </div>
          {step === 'form' && (
            <CardTitle className="text-xl font-bold text-gray-900 font-['Unbounded'] text-center">
              नया अकाउंट बनाएं
            </CardTitle>
          )}
          {/* Step indicator */}
          <div className="flex gap-2">
            <div className={`h-1 flex-1 rounded-full ${step === 'form' || step === 'otp' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
            <div className={`h-1 flex-1 rounded-full ${step === 'otp' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
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
                  className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">मोबाइल नंबर</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-white border border-gray-200 rounded-md text-gray-500 text-sm">
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
                    className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
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

              {refCode && (
                <div className="p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-center">
                  <p className="text-[#D4AF37] text-sm font-medium" data-testid="referral-applied-msg">
                    रेफरल कोड: <span className="font-bold">{refCode.toUpperCase()}</span> लागू होगा
                  </p>
                </div>
              )}

              <div className="pt-2 text-center">
                <p className="text-gray-500">
                  पहले से अकाउंट है?{' '}
                  <Link to="/login" className="text-[#D4AF37] hover:text-[#FDE047] font-medium">
                    लॉगिन करें
                  </Link>
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
                  className="bg-white border-gray-200 text-gray-900 text-center text-2xl tracking-[1em] placeholder:text-gray-500 placeholder:tracking-normal placeholder:text-base focus:border-[#D4AF37] focus:ring-[#D4AF37]"
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
                className="w-full text-center text-gray-500 text-sm hover:text-gray-900 transition-all"
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
