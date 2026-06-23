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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #0A0A14 0%, #14142B 50%, #0A0A14 100%)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-20 w-[420px] h-[420px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, #D4AF37 0%, transparent 70%)', opacity: 0.3 }} />
        <div className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)', opacity: 0.25 }} />
        <div className="absolute top-1/3 left-10 w-2 h-2 rounded-full bg-[#FFD700] animate-pulse" />
        <div className="absolute top-1/2 right-12 w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3 relative">
            <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)', opacity: 0.5 }} />
            <MatkaLogo size="lg" />
          </div>
          <h1 className="font-['Unbounded'] text-2xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #FFD700 0%, #FDE047 30%, #D4AF37 65%, #B8860B 100%)' }}>
              वापस आपका स्वागत है
            </span>
          </h1>
          <p className="text-gray-300 text-sm mt-1">अकाउंट में login करें और खेलना शुरू करें</p>
        </div>

        <div className="flex justify-center gap-2 mb-4 text-[10px]">
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(52, 211, 153, 0.4)', color: '#34D399' }}>
            <Shield className="w-3 h-3" /> Secure Login
          </div>
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.45)', color: '#FFD700' }}>
            <Zap className="w-3 h-3" /> Instant Access
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-px rounded-2xl blur-sm" style={{ background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)', opacity: 0.4 }} />
          <div className="relative rounded-2xl p-6" style={{ background: 'linear-gradient(135deg, #14142B 0%, #1A1A2E 100%)', border: '1px solid rgba(212, 175, 55, 0.4)', boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212, 175, 55, 0.1)' }}>
            <h2 className="text-[#FFD700] text-xl font-black font-['Unbounded'] mb-1">लॉगिन</h2>
            <p className="text-gray-400 text-xs mb-5">मोबाइल नंबर और पासवर्ड डालें</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[#FFD700] text-xs font-bold">मोबाइल नंबर</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 h-11 rounded-md text-[#FFD700] text-sm font-bold" style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>+91</div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]" />
                    <Input
                      type="tel"
                      placeholder="10 अंकों का नंबर"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      maxLength={10}
                      data-testid="login-phone-input"
                      className="pl-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                      style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(212, 175, 55, 0.3)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[#FFD700] text-xs font-bold">पासवर्ड</Label>
                  <Link to="/forgot-password" className="text-[#FFD700] hover:text-[#FDE047] text-[11px] font-bold" data-testid="forgot-password-link">
                    पासवर्ड भूल गए?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]" />
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="आपका पासवर्ड"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="login-password-input"
                    className="pl-10 pr-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                    style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(212, 175, 55, 0.3)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D4AF37] hover:text-[#FDE047]"
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
                className="w-full h-11 font-black tracking-wide hover:opacity-95 transition-all border-0"
                style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FDE047 30%, #D4AF37 65%, #B8860B 100%)', color: '#1A1A2E', boxShadow: '0 8px 28px rgba(212, 175, 55, 0.45)' }}
              >
                {loading ? 'लॉगिन हो रहा है...' : 'लॉगिन करें →'}
              </Button>

              <p className="text-center text-gray-300 text-sm pt-1">
                नया अकाउंट बनाएं?{' '}
                <Link to="/signup" className="text-[#FFD700] hover:text-[#FDE047] font-bold">साइनअप करें</Link>
              </p>
            </form>
          </div>
        </div>

        <p className="text-center text-gray-500 text-[11px] mt-5">
          🔒 End-to-end encrypted · Trusted by thousands
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
