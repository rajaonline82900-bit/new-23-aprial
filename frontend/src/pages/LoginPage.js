import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Phone, Lock, Eye, EyeOff, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LoginPage = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) { toast.error('10 अंकों का मोबाइल नंबर डालें'); return; }
    if (password.length < 6) { toast.error('पासवर्ड कम से कम 6 अक्षर का चाहिए'); return; }

    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/login`, {
        phone, password
      }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('लॉगिन सफल! 🎉');
      if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((reg) => { if (window.subscribePush) window.subscribePush(reg); });
      }
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'लॉगिन में समस्या');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#06060A] flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-20 w-[420px] h-[420px] rounded-full bg-[#D4AF37]/20 blur-[120px]" />
        <div className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full bg-[#10B981]/15 blur-[120px]" />
        <div className="absolute top-1/3 left-10 w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
        <div className="absolute top-1/2 right-12 w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3 relative">
            <div className="absolute inset-0 bg-[#D4AF37]/30 rounded-full blur-2xl" />
            <MatkaLogo size="lg" />
          </div>
          <h1 className="text-white font-['Unbounded'] text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-[#FDE047] via-[#D4AF37] to-[#FDE047] bg-clip-text text-transparent">
              वापस आपका स्वागत है
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">अकाउंट में login करें और खेलना शुरू करें</p>
        </div>

        <div className="flex justify-center gap-2 mb-4 text-[10px]">
          <div className="px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] flex items-center gap-1">
            <Shield className="w-3 h-3" /> Secure Login
          </div>
          <div className="px-2.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] flex items-center gap-1">
            <Zap className="w-3 h-3" /> Instant Access
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#10B981]/30 via-transparent to-[#D4AF37]/40 blur-sm" />
          <div className="relative rounded-2xl bg-[#0F0F14]/95 border border-white/10 backdrop-blur-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <h2 className="text-white text-xl font-bold font-['Unbounded'] mb-1">लॉगिन</h2>
            <p className="text-gray-500 text-xs mb-5">मोबाइल नंबर और पासवर्ड डालें</p>

            <form onSubmit={handleLogin} className="space-y-4">
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
                      required
                      maxLength={10}
                      data-testid="login-phone-input"
                      className="pl-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-xs">पासवर्ड</Label>
                  <Link to="/forgot-password" className="text-[#D4AF37] hover:text-[#FDE047] text-[11px] font-medium" data-testid="forgot-password-link">
                    पासवर्ड भूल गए?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="आपका पासवर्ड"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="login-password-input"
                    className="pl-10 pr-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    data-testid="toggle-login-password"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] hover:opacity-95 text-black font-bold shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition-all"
              >
                {loading ? 'लॉगिन हो रहा है...' : 'लॉगिन करें →'}
              </Button>

              <p className="text-center text-gray-400 text-sm pt-1">
                नया अकाउंट बनाएं?{' '}
                <Link to="/signup" className="text-[#D4AF37] hover:text-[#FDE047] font-semibold">साइनअप करें</Link>
              </p>
            </form>
          </div>
        </div>

        <p className="text-center text-gray-600 text-[11px] mt-5">
          🔒 End-to-end encrypted · Trusted by thousands
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
