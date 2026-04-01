import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Coins, Eye, EyeOff, ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LoginPage = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState('phone'); // 'phone', 'otp', 'newpass'
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Allow email for admin login or 10-digit phone
    const isEmail = phone.includes('@');
    if (!isEmail && phone.length < 10) { toast.error('कृपया सही मोबाइल नंबर दर्ज करें'); return; }
    setLoading(true);
    
    const result = await login(phone, password);
    
    if (result.success) {
      toast.success('लॉगिन सफल!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleForgotSendOTP = async (e) => {
    e.preventDefault();
    if (forgotPhone.length < 10) { toast.error('कृपया सही मोबाइल नंबर दर्ज करें'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/password/send-otp`, { phone: forgotPhone });
      setForgotStep('otp');
      toast.success('OTP भेज दिया गया है');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP भेजने में समस्या');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotVerifyOTP = async (e) => {
    e.preventDefault();
    if (forgotOtp.length < 4) { toast.error('कृपया 4 अंकों का OTP दर्ज करें'); return; }
    setForgotStep('newpass');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('पासवर्ड कम से कम 6 अक्षर का होना चाहिए'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/password/reset`, { phone: forgotPhone, otp: forgotOtp, new_password: newPassword });
      toast.success('पासवर्ड बदल दिया गया! अब लॉगिन करें');
      setForgotMode(false);
      setForgotStep('phone');
      setForgotPhone('');
      setForgotOtp('');
      setNewPassword('');
      setPhone(forgotPhone);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'पासवर्ड बदलने में समस्या');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password UI
  if (forgotMode) {
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
                  if (forgotStep === 'newpass') setForgotStep('otp');
                  else if (forgotStep === 'otp') setForgotStep('phone');
                  else { setForgotMode(false); }
                }}
                className="p-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-gray-400 hover:text-white transition-all"
                data-testid="forgot-back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <CardTitle className="text-xl font-bold text-white font-['Unbounded']">
                {forgotStep === 'newpass' ? 'नया पासवर्ड' : forgotStep === 'otp' ? 'OTP दर्ज करें' : 'पासवर्ड रीसेट'}
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <div className={`h-1 flex-1 rounded-full ${forgotStep === 'phone' || forgotStep === 'otp' || forgotStep === 'newpass' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
              <div className={`h-1 flex-1 rounded-full ${forgotStep === 'otp' || forgotStep === 'newpass' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
              <div className={`h-1 flex-1 rounded-full ${forgotStep === 'newpass' ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
            </div>
          </CardHeader>

          <CardContent>
            {forgotStep === 'phone' && (
              <form onSubmit={handleForgotSendOTP} className="space-y-4">
                <p className="text-gray-400 text-sm">अपना रजिस्टर्ड मोबाइल नंबर दर्ज करें</p>
                <div className="space-y-2">
                  <Label className="text-gray-300">मोबाइल नंबर</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-[#0A0A0C] border border-white/10 rounded-md text-gray-400 text-sm">
                      +91
                    </div>
                    <Input
                      type="tel"
                      placeholder="XXXXXXXXXX"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      maxLength={10}
                      data-testid="forgot-phone-input"
                      className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading} data-testid="forgot-send-otp-button" className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
                  {loading ? 'OTP भेज रहे हैं...' : 'OTP भेजें'}
                </Button>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleForgotVerifyOTP} className="space-y-4">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-green-400 text-sm">+91 {forgotPhone} पर OTP भेज दिया गया</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">OTP दर्ज करें</Label>
                  <Input
                    type="text"
                    placeholder="4 अंकों का OTP"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    maxLength={4}
                    data-testid="forgot-otp-input"
                    className="bg-[#0A0A0C] border-white/10 text-white text-center text-2xl tracking-[1em] placeholder:text-gray-500 placeholder:tracking-normal placeholder:text-base focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  />
                </div>
                <Button type="submit" disabled={loading} data-testid="forgot-verify-otp-button" className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
                  आगे बढ़ें
                </Button>
              </form>
            )}

            {forgotStep === 'newpass' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-green-400 text-sm">OTP सत्यापित हो गया</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">नया पासवर्ड</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="कम से कम 6 अक्षर"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      data-testid="forgot-new-password-input"
                      className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] pr-10"
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} data-testid="forgot-reset-button" className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
                  {loading ? 'पासवर्ड बदल रहे हैं...' : 'पासवर्ड बदलें'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Normal Login Form
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
            सट्टा मटका
          </CardTitle>
          <CardDescription className="text-gray-400">
            अपने अकाउंट में लॉगिन करें
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-300">मोबाइल नंबर</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-[#0A0A0C] border border-white/10 rounded-md text-gray-400 text-sm">
                  +91
                </div>
                <Input
                  id="phone"
                  type="text"
                  placeholder="XXXXXXXXXX या admin@email.com"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow email (contains @) or digits only for phone
                    if (val.includes('@') || val === '') {
                      setPhone(val);
                    } else {
                      setPhone(val.replace(/\D/g, '').slice(0, 10));
                    }
                  }}
                  required
                  data-testid="login-phone-input"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-300">पासवर्ड</Label>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setForgotPhone(phone); }}
                  data-testid="forgot-password-link"
                  className="text-[#D4AF37] hover:text-[#FDE047] text-sm font-medium"
                >
                  पासवर्ड भूल गए?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="पासवर्ड दर्ज करें"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
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
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold transition-all duration-200"
            >
              {loading ? 'लॉगिन हो रहा है...' : 'लॉगिन करें'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-400">
              नया अकाउंट बनाएं?{' '}
              <Link to="/signup" className="text-[#D4AF37] hover:text-[#FDE047] font-medium">
                साइनअप करें
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
