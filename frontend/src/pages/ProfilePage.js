import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, 
  User,
  Mail,
  Phone,
  Shield,
  Calendar
} from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-xl font-bold text-white font-['Unbounded']">प्रोफाइल</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Profile Card */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center mb-4">
                <span className="text-4xl font-bold text-black">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white font-['Unbounded']">{user?.name}</h2>
              <Badge className={`mt-2 ${
                user?.role === 'admin' 
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37]' 
                  : 'bg-[#10B981]/20 text-[#10B981]'
              }`}>
                {user?.role === 'admin' ? 'एडमिन' : 'यूजर'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="bg-[#141418] border-white/10">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded']">विवरण</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">नाम</p>
                <p className="text-white font-medium">{user?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">ईमेल</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
            </div>
            
            {user?.phone && (
              <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">फोन</p>
                  <p className="text-white font-medium">{user?.phone}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">भूमिका</p>
                <p className="text-white font-medium">{user?.role === 'admin' ? 'एडमिन' : 'यूजर'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProfilePage;
