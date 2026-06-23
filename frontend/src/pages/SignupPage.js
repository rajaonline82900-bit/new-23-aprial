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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #F5F0FF 0%, #FCE7F3 50%, #FDF2F8 100%)' }}>
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)', opacity: 0.35 }} />
        <div className="absolute -bottom-32 -right-20 w-[420px] h-[420px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)', opacity: 0.3 }} />
        <div className="absolute top-1/3 right-10 w-2 h-2 rounded-full bg-[#7E22CE] animate-pulse" />
        <div className="absolute top-1/2 left-12 w-1.5 h-1.5 rounded-full bg-[#EC4899] animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Hero Logo + Tagline */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3 relative">
            <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)', opacity: 0.4 }} />
            <MatkaLogo size="lg" />
          </div>
          <h1 className="font-['Unbounded'] text-2xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #4C1D95 0%, #7E22CE 30%, #C026D3 65%, #EC4899 100%)' }}>
              जुड़िए, खेलिए, जीतिए
            </span>
          </h1>
          <p className="text-gray-600 text-sm mt-1">India's most trusted Matka platform</p>
        </div>

        {/* Perks pill row */}
        <div className="flex justify-center gap-2 mb-4 text-[10px]">
          <div className="px-2.5 py-1 rounded-full bg-[#EC4899]/10 border border-[#EC4899]/40 text-[#DB2777] flex items-center gap-1 font-bold">
            <Sparkles className="w-3 h-3" /> Instant Withdraw
          </div>
          <div className="px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/40 text-[#059669] flex items-center gap-1 font-bold">
            <Gift className="w-3 h-3" /> 5% Refer Bonus
          </div>
          <div className="px-2.5 py-1 rounded-full bg-[#7E22CE]/10 border border-[#7E22CE]/40 text-[#7E22CE] flex items-center gap-1 font-bold">
            <Trophy className="w-3 h-3" /> 24×7 Live
          </div>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-2xl blur-sm" style={{ background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)', opacity: 0.5 }} />
          <div className="relative rounded-2xl bg-white border border-[#A855F7]/20 p-6 shadow-[0_20px_60px_rgba(168,85,247,0.2)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[#1F0E3D] text-xl font-black font-['Unbounded']">नया अकाउंट</h2>
                <p className="text-gray-500 text-xs mt-0.5">कुछ ही सेकंड में रजिस्टर करें</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-md text-white font-black border-0" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>FREE</span>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-[#1F0E3D] text-xs font-bold">नाम</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A855F7]" />
                  <Input
                    type="text"
                    placeholder="आपका नाम"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="signup-name-input"
                    className="pl-10 h-11 bg-[#F5F0FF] border-[#A855F7]/30 text-[#1F0E3D] placeholder:text-gray-500 focus:border-[#7E22CE] focus:ring-1 focus:ring-[#7E22CE]/40"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-[#1F0E3D] text-xs font-bold">मोबाइल नंबर</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 h-11 bg-[#F5F0FF] border border-[#A855F7]/30 rounded-md text-[#7E22CE] text-sm font-bold">+91</div>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A855F7]" />
                    <Input
                      type="tel"
                      placeholder="10 अंकों का नंबर"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      maxLength={10}
                      data-testid="signup-phone-input"
                      className="pl-10 h-11 bg-[#F5F0FF] border-[#A855F7]/30 text-[#1F0E3D] placeholder:text-gray-500 focus:border-[#7E22CE] focus:ring-1 focus:ring-[#7E22CE]/40"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-[#1F0E3D] text-xs font-bold">पासवर्ड</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A855F7]" />
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="कम से कम 6 अक्षर"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="signup-password-input"
                    className="pl-10 pr-10 h-11 bg-[#F5F0FF] border-[#A855F7]/30 text-[#1F0E3D] placeholder:text-gray-500 focus:border-[#7E22CE] focus:ring-1 focus:ring-[#7E22CE]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7E22CE] hover:text-[#EC4899]"
                    data-testid="toggle-signup-password"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Referral */}
              <div className="space-y-1.5">
                <Label className="text-[#1F0E3D] text-xs font-bold">रेफरल कोड <span className="text-gray-500">(optional)</span></Label>
                <Input
                  type="text"
                  placeholder="दोस्त का रेफरल कोड"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  maxLength={10}
                  data-testid="signup-referral-input"
                  disabled={!!urlRefCode}
                  className="h-11 bg-[#F5F0FF] border-[#A855F7]/30 text-[#1F0E3D] placeholder:text-gray-500 focus:border-[#7E22CE] focus:ring-1 focus:ring-[#7E22CE]/40 uppercase tracking-wide"
                />
                {urlRefCode && (
                  <p className="text-[#7E22CE] text-[11px] font-bold">लिंक से रेफरल कोड लागू है: {urlRefCode}</p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                data-testid="signup-submit-btn"
                className="w-full h-11 text-white font-black tracking-wide hover:opacity-95 transition-all border-0"
                style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7E22CE 30%, #C026D3 65%, #EC4899 100%)', boxShadow: '0 8px 28px rgba(168, 85, 247, 0.45)' }}
              >
                {loading ? 'अकाउंट बन रहा है...' : 'अकाउंट बनाएं →'}
              </Button>

              <p className="text-center text-gray-600 text-sm pt-1">
                पहले से अकाउंट है?{' '}
                <Link to="/login" className="text-[#7E22CE] hover:text-[#EC4899] font-bold">लॉगिन करें</Link>
              </p>
            </form>
          </div>
        </div>

        {/* Footer micro-trust */}
        <p className="text-center text-gray-500 text-[11px] mt-5">
          🔒 आपका डेटा 100% सुरक्षित है · End-to-end encrypted
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
