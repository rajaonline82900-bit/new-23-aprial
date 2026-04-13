import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LoginPage = () => {
  const [step, setStep] = useState('phone'); // 'phone', 'otp'
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
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('कृपया 4 अंकों का OTP दर्ज करें'); return; }
    
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/login-otp/verify`, { phone, otp }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('लॉगिन सफल!');
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
        <CardHeader className="space-y-3 text-center">
          {step === 'phone' && (
            <>
              <div className="flex justify-center">
                <MatkaLogo size="lg" />
              </div>
              <CardDescription className="text-gray-400">
                अपने मोबाइल नंबर से लॉगिन करें
              </CardDescription>
            </>
          )}
          {step === 'otp' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep('phone'); setOtp(''); }}
                className="p-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-gray-400 hover:text-white transition-all"
                data-testid="login-back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-white font-['Unbounded']">OTP दर्ज करें</h2>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {step === 'phone' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
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
                    data-testid="login-phone-input"
                    className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                data-testid="login-send-otp-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold transition-all duration-200"
              >
                {loading ? 'OTP भेज रहे हैं...' : 'OTP भेजें'}
              </Button>
              
              <div className="mt-6 text-center">
                <p className="text-gray-400">
                  नया अकाउंट बनाएं?{' '}
                  <Link to="/signup" className="text-[#D4AF37] hover:text-[#FDE047] font-medium">
                    साइनअप करें
                  </Link>
                </p>
              </div>
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
                  data-testid="login-otp-input"
                  className="bg-[#0A0A0C] border-white/10 text-white text-center text-2xl tracking-[1em] placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-base focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="login-verify-otp-button"
                className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                {loading ? 'लॉगिन हो रहा है...' : 'लॉगिन करें'}
              </Button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); }}
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

export default LoginPage;
