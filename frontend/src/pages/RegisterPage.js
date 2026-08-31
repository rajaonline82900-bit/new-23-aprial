import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Eye, EyeOff, User, Mail, Phone, Lock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import MatkaLogo from '../components/MatkaLogo';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('पासवर्ड मेल नहीं खाते'); return; }
    if (password.length < 6) { toast.error('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए'); return; }
    setLoading(true);
    const result = await register(name, email, password, phone);
    if (result.success) { toast.success('Welcome to Shiv Shakti Club! 🎉'); navigate('/dashboard'); }
    else { toast.error(result.error); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden lucky-bg-animated lucky-sparkles flex items-center justify-center px-5 py-8" data-testid="register-page">
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <MatkaLogo size="xl" showText={false} />
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-gold-text">LUCKY</span>
            <span className="text-3xl font-black font-['Unbounded'] tracking-tight lucky-emerald-text">BET</span>
          </div>
          <p className="text-[10px] tracking-[0.28em] font-bold mt-1 uppercase text-[#FFD700]">
            More Bets • More Wins • More Luck
          </p>
        </div>

        {/* Glass Card */}
        <div className="lucky-glass-card p-6">
          <h1 className="lucky-gold-text text-2xl font-black font-['Unbounded'] mb-1">नया अकाउंट</h1>
          <p className="text-gray-400 text-sm mb-5">Shiv Shakti Club में आपका स्वागत है</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
              <Input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(e.target.value)} required
                data-testid="register-name-input"
                className="pl-10 h-12 text-white placeholder:text-gray-500 rounded-xl focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }} />
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
              <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="register-email-input"
                className="pl-10 h-12 text-white placeholder:text-gray-500 rounded-xl focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }} />
            </div>

            <div className="flex">
              <span className="flex items-center px-3 rounded-l-xl text-[#FFD700] text-sm font-bold"
                    style={{ background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.4)', borderRight: 'none' }}>+91</span>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
                <Input type="tel" placeholder="मोबाइल नंबर" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  data-testid="register-phone-input" maxLength={10}
                  className="pl-10 h-12 text-white placeholder:text-gray-500 rounded-l-none rounded-r-xl focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40 flex-1"
                  style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }} />
              </div>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFD700]" />
              <Input type={showPassword ? 'text' : 'password'} placeholder="पासवर्ड बनाएं" value={password} onChange={(e) => setPassword(e.target.value)} required
                data-testid="register-password-input"
                className="pl-10 pr-10 h-12 text-white placeholder:text-gray-500 rounded-xl focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700]/40"
                style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(255, 215, 0, 0.35)' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFD700] hover:text-[#FDE047]">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#14A94C]" />
              <Input type="password" placeholder="पासवर्ड पुष्टि करें" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                data-testid="register-confirm-password-input"
                className="pl-10 h-12 text-white placeholder:text-gray-500 rounded-xl focus:border-[#14A94C] focus:ring-1 focus:ring-[#14A94C]/40"
                style={{ background: 'rgba(10, 10, 20, 0.6)', borderColor: 'rgba(20, 169, 76, 0.35)' }} />
            </div>

            <Button type="submit" disabled={loading} data-testid="register-submit-button"
              className="lucky-cta w-full h-12 rounded-xl border-0 text-base">
              {loading ? 'रजिस्टर हो रहा है...' : <><span>CREATE ACCOUNT</span><ChevronRight className="w-5 h-5 ml-1 inline" /></>}
            </Button>
          </form>

          <p className="mt-5 text-center text-gray-300 text-sm">
            पहले से अकाउंट है?{' '}
            <Link to="/login" className="lucky-gold-text font-black">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
