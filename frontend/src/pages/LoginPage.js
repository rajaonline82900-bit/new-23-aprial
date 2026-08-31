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
      toast.success('Welcome back! 🎉');
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 lucky-bg-animated lucky-sparkles" data-testid="login-page">
      <div className="w-full max-w-md relative z-10">
        {/* Logo + Tagline */}
        <div className="text-center mb-6">
          <div className="inline-flex flex-col items-center mb-3">
            <MatkaLogo size="xl" showText={false} />
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-gold-text drop-shadow-2xl">SHIV</span>
              <span className="text-3xl font-black font-['Unbounded'] tracking-tight drop-shadow-2xl"
                style={{ backgroundImage: 'linear-gradient(135deg, #38BDF8 0%, #7DD3FC 50%, #38BDF8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                SHAKTI
              </span>
              <span className="text-2xl font-black font-['Unbounded'] tracking-tight lucky-gold-text drop-shadow-2xl">CLUB</span>
            </div>
            <p className="text-[10px] tracking-[0.28em] font-bold mt-1 uppercase" style={{ color: '#FFD700' }}>
              Play • Win • Prosper
            </p>
          </div>
          <h1 className="font-['Unbounded'] text-xl font-black tracking-tight mt-4">
            <span className="lucky-gold-text">वापस आपका स्वागत है</span>
          </h1>
          <p className="text-gray-300 text-sm mt-1">अकाउंट में login करें और खेलना शुरू करें</p>
        </div>

        <div className="flex justify-center gap-2 mb-4 text-[10px]">
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(20, 169, 76, 0.18)', border: '1px solid rgba(20, 169, 76, 0.5)', color: '#22C55E' }}>
            <Shield className="w-3 h-3" /> Secure Login
          </div>
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.5)', color: '#FFD700' }}>
            <Zap className="w-3 h-3" /> Instant Access
          </div>
        </div>

        {/* Glass Card */}
        <div className="lucky-glass-card p-6">
          <h2 className="lucky-gold-text text-xl font-black font-['Unbounded'] mb-1">लॉगिन</h2>
          <p className="text-gray-400 text-xs mb-5">मोबाइल नंबर और पासवर्ड डालें</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[#FFD700] text-xs font-bold">मोबाइल नंबर</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 h-11 rounded-md text-[#FFD700] text-sm font-bold" style={{ background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.4)' }}>+91</div>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
                  <Input
                    type="tel"
                    placeholder="10 अंकों का नंबर"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                    maxLength={10}
                    data-testid="login-phone-input"
                    className="pl-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                    style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[#FFD700] text-xs font-bold">पासवर्ड</Label>
                <Link to="/forgot-password" className="text-[#14A94C] hover:text-[#22C55E] text-[11px] font-bold" data-testid="forgot-password-link">
                  पासवर्ड भूल गए?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
                <Input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="आपका पासवर्ड"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="login-password-input"
                  className="pl-10 pr-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                  style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFD700] hover:text-[#FDE047]"
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
              className="lucky-cta w-full h-12 rounded-xl border-0 text-base"
            >
              {loading ? 'लॉगिन हो रहा है...' : 'PLAY & WIN →'}
            </Button>

            <p className="text-center text-gray-300 text-sm pt-1">
              नया अकाउंट बनाएं?{' '}
              <Link to="/signup" className="lucky-emerald-text font-black">Sign Up Free</Link>
            </p>
          </form>
        </div>

        <p className="text-center text-gray-500 text-[11px] mt-5">
          🔒 End-to-end encrypted · Trusted by thousands
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
