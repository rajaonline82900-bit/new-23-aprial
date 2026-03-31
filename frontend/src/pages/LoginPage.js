import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Coins, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      toast.success('Login successful!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

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
              <Label htmlFor="email" className="text-gray-300">ईमेल</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">पासवर्ड</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-gray-500 text-sm">या</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google Login */}
          <button
            onClick={() => {
              const redirectUrl = window.location.origin + '/auth/callback';
              window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }}
            data-testid="google-login-button"
            className="w-full p-3 rounded-lg bg-[#0A0A0C] border border-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-white font-medium">Continue with Gmail</span>
          </button>
          
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
