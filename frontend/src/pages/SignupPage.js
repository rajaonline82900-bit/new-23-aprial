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
      toast.success('अकाउंट बन गया! स्वागत है 🎉');
      await refreshUser();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Signup में समस्या');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#06060A] flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full bg-[#D4AF37]/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-20 w-[420px] h-[420px] rounded-full bg-[#10B981]/15 blur-[120px]" />
        <div className="absolute top-1/3 right-10 w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
        <div className="absolute top-1/2 left-12 w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: '0.4s' }} />
        <div className="absolute bottom-20 right-1/3 w-1 h-1 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '0.8s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Hero Logo + Tagline */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3 relative">
            <div className="absolute inset-0 bg-[#D4AF37]/30 rounded-full blur-2xl" />
            <MatkaLogo size="lg" />
          </div>
          <h1 className="text-white font-['Unbounded'] text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-[#FDE047] via-[#D4AF37] to-[#FDE047] bg-clip-text text-transparent">
              जुड़िए, खेलिए, जीतिए
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">India's most trusted Matka platform</p>
        </div>

        {/* Perks pill row */}
        <div className="flex justify-center gap-2 mb-4 text-[10px]">
          <div className="px-2.5 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Instant Withdraw
          </div>
          <div className="px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] flex items-center gap-1">
            <Gift className="w-3 h-3" /> 5% Refer Bonus
          </div>
          <div className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center gap-1">
            <Trophy className="w-3 h-3" /> 24×7 Live
          </div>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#D4AF37]/40 via-transparent to-[#10B981]/30 blur-sm" />
          <div className="relative rounded-2xl bg-[#0F0F14]/95 border border-white/10 backdrop-blur-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white text-xl font-bold font-['Unbounded']">नया अकाउंट</h2>
                <p className="text-gray-500 text-xs mt-0.5">कुछ ही सेकंड में रजिस्टर करें</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] font-bold border border-[#D4AF37]/30">FREE</span>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">नाम</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="आपका नाम"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="signup-name-input"
                    className="pl-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                  />
                </div>
              </div>

              {/* Phone */}
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
                      data-testid="signup-phone-input"
                      className="pl-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">पासवर्ड</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="कम से कम 6 अक्षर"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="signup-password-input"
                    className="pl-10 pr-10 h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    data-testid="toggle-signup-password"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Referral */}
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">रेफरल कोड <span className="text-gray-500">(optional)</span></Label>
                <Input
                  type="text"
                  placeholder="दोस्त का रेफरल कोड"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  maxLength={10}
                  data-testid="signup-referral-input"
                  disabled={!!urlRefCode}
                  className="h-11 bg-[#06060A] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/40 uppercase tracking-wide"
                />
                {urlRefCode && (
                  <p className="text-[#D4AF37] text-[11px]">लिंक से रेफरल कोड लागू है: {urlRefCode}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                data-testid="signup-submit-btn"
                className="w-full h-11 bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] hover:opacity-95 text-black font-bold shadow-[0_8px_24px_rgba(212,175,55,0.35)] transition-all"
              >
                {loading ? 'अकाउंट बन रहा है...' : 'अकाउंट बनाएं →'}
              </Button>

              <p className="text-center text-gray-400 text-sm pt-1">
                पहले से अकाउंट है?{' '}
                <Link to="/login" className="text-[#D4AF37] hover:text-[#FDE047] font-semibold">लॉगिन करें</Link>
              </p>
            </form>
          </div>
        </div>

        {/* Footer micro-trust */}
        <p className="text-center text-gray-600 text-[11px] mt-5">
          🔒 आपका डेटा 100% सुरक्षित है · End-to-end encrypted
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
