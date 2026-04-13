import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/card';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import MatkaLogo from '../components/MatkaLogo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // If already logged in as admin, redirect to admin panel
  if (user && user.role === 'admin') {
    navigate('/admin', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('कृपया सही ईमेल दर्ज करें'); return; }
    if (!password) { toast.error('कृपया पासवर्ड दर्ज करें'); return; }
    
    setLoading(true);
    try {
      const resp = await axios.post(`${API_URL}/api/auth/admin/login`, { email, password }, { withCredentials: true });
      if (resp.data?.token) localStorage.setItem('matka11_token', resp.data.token);
      toast.success('एडमिन लॉगिन सफल!');
      await refreshUser();
      navigate('/admin');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'गलत ईमेल या पासवर्ड');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0C]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-sm bg-[#141418] border-white/10 relative z-10">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <MatkaLogo size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-[#D4AF37]" />
            <CardDescription className="text-[#D4AF37] font-semibold text-base">
              एडमिन पैनल लॉगिन
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">ईमेल</Label>
              <Input
                type="email"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="admin-email-input"
                className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-300">पासवर्ड</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="पासवर्ड दर्ज करें"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="admin-password-input"
                  className="bg-[#0A0A0C] border-white/10 text-white placeholder:text-gray-400 focus:border-[#D4AF37] focus:ring-[#D4AF37] pr-10"
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
              data-testid="admin-login-button"
              className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold transition-all duration-200"
            >
              {loading ? 'लॉगिन हो रहा है...' : 'एडमिन लॉगिन'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLoginPage;
