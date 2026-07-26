import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Phone, Lock, Eye, EyeOff, Sparkles, Gift, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SignupPage = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get('ref') || '';
  const [refCode, setRefCode] = useState(urlRefCode);

  const handleSignup = async (e) => {
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
      toast.success('अकाउंट बन गया! Lucky Bet में स्वागत है 🎉');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Signup में समस्या');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 lucky-bg-animated lucky-sparkles" data-testid="signup-page">
      <div className="w-full max-w-md relative z-10">
        {/* Hero Logo */}
        <div className="text-center mb-5">
          <div className="inline-flex flex-col items-center mb-3">
            <MatkaLogo size="xl" showText={false} />
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-gold-text drop-shadow-2xl">LUCKY</span>
              <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-emerald-text drop-shadow-2xl">BET</span>
            </div>
            <p className="text-[10px] tracking-[0.28em] font-bold mt-1 uppercase" style={{ color: '#FFD700' }}>
              More Bets • More Wins • More Luck
            </p>
          </div>
          <h1 className="font-['Unbounded'] text-xl font-black tracking-tight mt-4">
            <span className="lucky-gold-text">जुड़िए, खेलिए, </span>
            <span className="lucky-emerald-text">जीतिए</span>
          </h1>
          <p className="text-gray-300 text-sm mt-1">India&apos;s most trusted gaming platform</p>
        </div>

        {/* Perks pills */}
        <div className="flex justify-center gap-2 mb-4 text-[10px] flex-wrap">
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.5)', color: '#FFD700' }}>
            <Sparkles className="w-3 h-3" /> Instant Withdraw
          </div>
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(20, 169, 76, 0.18)', border: '1px solid rgba(20, 169, 76, 0.5)', color: '#22C55E' }}>
            <Gift className="w-3 h-3" /> 5% Refer Bonus
          </div>
          <div className="px-2.5 py-1 rounded-full flex items-center gap-1 font-bold" style={{ background: 'rgba(253, 224, 71, 0.15)', border: '1px solid rgba(253, 224, 71, 0.5)', color: '#FDE047' }}>
            <Trophy className="w-3 h-3" /> 24×7 Live
          </div>
        </div>

        {/* Glass Card */}
        <div className="lucky-glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="lucky-gold-text text-xl font-black font-['Unbounded']">नया अकाउंट</h2>
              <p className="text-gray-400 text-xs mt-0.5">कुछ ही सेकंड में रजिस्टर करें</p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-md text-white font-black border-0" style={{ background: 'linear-gradient(135deg, #0F9938 0%, #14A94C 100%)' }}>FREE</span>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-[#FFD700] text-xs font-bold">नाम</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
                <Input
                  type="text"
                  placeholder="आपका नाम"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="signup-name-input"
                  className="pl-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                  style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }}
                />
              </div>
            </div>

            {/* Phone */}
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
                    data-testid="signup-phone-input"
                    className="pl-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                    style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-[#FFD700] text-xs font-bold">पासवर्ड</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
                <Input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="कम से कम 6 अक्षर"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="signup-password-input"
                  className="pl-10 pr-10 h-11 text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                  style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFD700] hover:text-[#FDE047]"
                  data-testid="toggle-signup-password"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Referral */}
            <div className="space-y-1.5">
              <Label className="text-[#14A94C] text-xs font-bold">रेफरल कोड <span className="text-gray-500">(optional)</span></Label>
              <Input
                type="text"
                placeholder="दोस्त का रेफरल कोड"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                maxLength={10}
                data-testid="signup-referral-input"
                disabled={!!urlRefCode}
                className="h-11 text-white placeholder:text-gray-500 focus:border-[#14A94C] focus:ring-1 focus:ring-[#14A94C]/40 uppercase tracking-wide"
                style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(20, 169, 76, 0.4)' }}
              />
              {urlRefCode && (
                <p className="text-[#14A94C] text-[11px] font-bold">✓ लिंक से रेफरल कोड लागू है: {urlRefCode}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              data-testid="signup-submit-btn"
              className="lucky-cta w-full h-12 rounded-xl border-0 text-base"
            >
              {loading ? 'अकाउंट बन रहा है...' : 'CREATE ACCOUNT →'}
            </Button>

            <p className="text-center text-gray-300 text-sm pt-1">
              पहले से अकाउंट है?{' '}
              <Link to="/login" className="lucky-gold-text font-black">Log In</Link>
            </p>
          </form>
        </div>

        <p className="text-center text-gray-500 text-[11px] mt-5">
          🔒 आपका डेटा 100% सुरक्षित है · End-to-end encrypted
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
