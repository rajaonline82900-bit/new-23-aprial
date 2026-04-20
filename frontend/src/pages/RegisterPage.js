import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Eye, EyeOff, User, Mail, Phone, Lock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

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
    if (result.success) { toast.success('रजिस्ट्रेशन सफल!'); navigate('/dashboard'); }
    else { toast.error(result.error); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-[#D4AF37]/8 to-transparent" />
      <div className="absolute top-20 right-[-50px] w-40 h-40 bg-[#D4AF37]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-[-30px] w-32 h-32 bg-[#10B981]/10 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col items-center px-5 pt-12 pb-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#FDE047] to-[#D4AF37] flex items-center justify-center font-black font-['Unbounded'] text-black text-xl shadow-lg shadow-[#D4AF37]/30">
            M
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-black font-['Unbounded'] bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] bg-clip-text text-transparent">MATKA</span>
            <span className="text-3xl font-black font-['Unbounded'] text-white">11</span>
          </div>
        </div>
        <p className="text-gray-500 text-xs mb-8">India's Trusted Matka Platform</p>

        {/* Heading */}
        <h1 className="text-white text-2xl font-black font-['Unbounded'] mb-1">नया अकाउंट</h1>
        <p className="text-gray-400 text-sm mb-6">MATKA 11 में आपका स्वागत है</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input type="text" placeholder="आपका नाम" value={name} onChange={(e) => setName(e.target.value)} required
              data-testid="register-name-input"
              className="pl-10 h-12 bg-[#141418] border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-[#D4AF37] focus:ring-[#D4AF37]" />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required
              data-testid="register-email-input"
              className="pl-10 h-12 bg-[#141418] border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-[#D4AF37] focus:ring-[#D4AF37]" />
          </div>

          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <div className="flex">
              <span className="flex items-center px-3 bg-[#141418] border border-white/10 border-r-0 rounded-l-xl text-gray-400 text-sm">+91</span>
              <Input type="tel" placeholder="मोबाइल नंबर" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                data-testid="register-phone-input" maxLength={10}
                className="h-12 bg-[#141418] border-white/10 text-white placeholder:text-gray-500 rounded-l-none rounded-r-xl focus:border-[#D4AF37] focus:ring-[#D4AF37] flex-1" />
            </div>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input type={showPassword ? 'text' : 'password'} placeholder="पासवर्ड बनाएं" value={password} onChange={(e) => setPassword(e.target.value)} required
              data-testid="register-password-input"
              className="pl-10 pr-10 h-12 bg-[#141418] border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-[#D4AF37] focus:ring-[#D4AF37]" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input type="password" placeholder="पासवर्ड पुष्टि करें" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
              data-testid="register-confirm-password-input"
              className="pl-10 h-12 bg-[#141418] border-white/10 text-white placeholder:text-gray-500 rounded-xl focus:border-[#D4AF37] focus:ring-[#D4AF37]" />
          </div>

          <Button type="submit" disabled={loading} data-testid="register-submit-button"
            className="w-full h-12 bg-gradient-to-r from-[#D4AF37] to-[#FDE047] hover:from-[#FDE047] hover:to-[#D4AF37] text-black font-black text-base rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all">
            {loading ? 'रजिस्टर हो रहा है...' : <><span>अकाउंट बनाएं</span><ChevronRight className="w-5 h-5 ml-1 inline" /></>}
          </Button>
        </form>

        <p className="mt-6 text-gray-400 text-sm">
          पहले से अकाउंट है?{' '}
          <Link to="/login" className="text-[#D4AF37] hover:text-[#FDE047] font-bold">लॉगिन करें</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
