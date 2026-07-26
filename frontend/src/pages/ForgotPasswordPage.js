import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Phone, KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ForgotPasswordPage = () => {
  const [step, setStep] = useState('phone'); // phone -> reset
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) { toast.error('10 अंकों का मोबाइल नंबर डालें'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/password/send-otp`, { phone });
      toast.success('OTP भेज दिया गया');
      setStep('reset');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP भेजने में समस्या');
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (otp.length < 4) { toast.error('OTP डालें'); return; }
    if (newPassword.length < 6) { toast.error('नया पासवर्ड कम से कम 6 अक्षर'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/password/reset`, { phone, otp, new_password: newPassword });
      toast.success('पासवर्ड बदल गया! अब लॉगिन करें');
      navigate('/login');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'रीसेट में समस्या');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden lucky-bg-animated lucky-sparkles flex items-center justify-center p-4" data-testid="forgot-password-page">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex flex-col items-center mb-3">
            <MatkaLogo size="xl" showText={false} />
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-gold-text">LUCKY</span>
              <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-emerald-text">BET</span>
            </div>
          </div>
          <h1 className="lucky-gold-text font-['Unbounded'] text-xl font-black mt-4">पासवर्ड रीसेट</h1>
          <p className="text-gray-300 text-xs mt-1">मोबाइल पर OTP भेजकर नया पासवर्ड सेट करें</p>
        </div>

        <div className="lucky-glass-card p-6">
            <Link to="/login" className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-xs mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Login पर वापस
            </Link>

            {step === 'phone' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">मोबाइल नंबर</Label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 h-11 bg-[#06060A] border border-white/10 rounded-md text-gray-400 text-sm font-medium">+91</div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        type="tel"
                        placeholder="10 अंकों का नंबर"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required maxLength={10} data-testid="forgot-phone-input"
                        className="pl-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                      />
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={loading} data-testid="forgot-send-otp-btn"
                  className="lucky-cta w-full h-11 rounded-xl border-0">
                  {loading ? 'भेज रहे हैं...' : 'OTP भेजें'}
                </Button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                  +91 {phone} पर OTP भेज दिया गया
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">OTP</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="text" placeholder="4 अंकों का OTP"
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      required maxLength={4} data-testid="forgot-otp-input"
                      className="pl-10 h-11 bg-[#06060A] border-white/10 text-white tracking-[0.5em] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">नया पासवर्ड</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      type="password" placeholder="कम से कम 6 अक्षर"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      required minLength={6} data-testid="forgot-new-password"
                      className="pl-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} data-testid="forgot-reset-btn"
                  className="lucky-cta w-full h-11 rounded-xl border-0">
                  {loading ? 'बदल रहे हैं...' : 'पासवर्ड बदलें'}
                </Button>

                <button type="button" onClick={() => setStep('phone')}
                  className="w-full text-center text-gray-400 text-xs hover:text-white">
                  नंबर बदलें
                </button>
              </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
