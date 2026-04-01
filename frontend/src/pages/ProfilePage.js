import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, 
  User,
  Mail,
  Phone,
  Shield,
  Pencil,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import FooterNav from '../components/FooterNav';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const startEditing = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditName('');
    setEditEmail('');
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error('नाम खाली नहीं हो सकता');
      return;
    }
    setSaving(true);
    try {
      const updates = {};
      if (editName.trim() !== user?.name) updates.name = editName.trim();
      if (editEmail.trim() !== user?.email) updates.email = editEmail.trim();

      if (Object.keys(updates).length === 0) {
        toast.info('कोई बदलाव नहीं');
        setEditing(false);
        return;
      }

      await axios.put(`${API_URL}/api/auth/profile`, updates, { withCredentials: true });
      toast.success('प्रोफ़ाइल अपडेट हो गई');
      await refreshUser();
      setEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'अपडेट विफल');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('वर्तमान पासवर्ड दर्ज करें');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('नया पासवर्ड कम से कम 6 अक्षर का होना चाहिए');
      return;
    }
    setChangingPw(true);
    try {
      await axios.post(`${API_URL}/api/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, { withCredentials: true });
      toast.success('पासवर्ड बदल दिया गया');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'पासवर्ड बदलने में विफल');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all" data-testid="profile-back-btn">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <h1 className="text-xl font-bold text-white font-['Unbounded']">प्रोफाइल</h1>
            </div>
            {!editing && (
              <button
                onClick={startEditing}
                data-testid="profile-edit-btn"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all text-sm font-medium"
              >
                <Pencil className="w-4 h-4" />
                संपादित करें
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Profile Avatar Card */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center mb-4">
                <span className="text-4xl font-bold text-black">
                  {(editing ? editName : user?.name)?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white font-['Unbounded']" data-testid="profile-display-name">
                {editing ? editName || '...' : user?.name}
              </h2>
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

        {/* Details / Edit Form */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded']">
              {editing ? 'जानकारी संपादित करें' : 'विवरण'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-sm">नाम</p>
                {editing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    data-testid="profile-edit-name"
                    className="bg-[#141418] border-white/10 text-white mt-1 h-9"
                    placeholder="अपना नाम दर्ज करें"
                  />
                ) : (
                  <p className="text-white font-medium" data-testid="profile-name">{user?.name}</p>
                )}
              </div>
            </div>
            
            {/* Email */}
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-sm">ईमेल</p>
                {editing ? (
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    data-testid="profile-edit-email"
                    className="bg-[#141418] border-white/10 text-white mt-1 h-9"
                    placeholder="example@gmail.com"
                  />
                ) : (
                  <p className="text-white font-medium" data-testid="profile-email">{user?.email || '-'}</p>
                )}
              </div>
            </div>
            
            {/* Phone (Read-only always) */}
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-sm">फोन</p>
                <p className="text-white font-medium" data-testid="profile-phone">{user?.phone || '-'}</p>
                {editing && (
                  <p className="text-gray-500 text-xs mt-1">फोन नंबर बदलने के लिए सहायता से संपर्क करें</p>
                )}
              </div>
            </div>
            
            {/* Role (Read-only always) */}
            <div className="flex items-center gap-4 p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-sm">भूमिका</p>
                <p className="text-white font-medium">{user?.role === 'admin' ? 'एडमिन' : 'यूजर'}</p>
              </div>
            </div>

            {/* Save / Cancel Buttons */}
            {editing && (
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  data-testid="profile-save-btn"
                  className="flex-1 h-11 bg-[#10B981] hover:bg-[#059669] text-white font-bold"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  {saving ? 'सेव हो रहा...' : 'सेव करें'}
                </Button>
                <Button
                  onClick={cancelEditing}
                  variant="outline"
                  data-testid="profile-cancel-btn"
                  className="h-11 border-white/20 text-gray-300 hover:bg-white/10"
                >
                  <X className="w-5 h-5 mr-1" />
                  रद्द
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Change Section */}
        <Card className="bg-[#141418] border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#D4AF37]" />
                पासवर्ड
              </CardTitle>
              {!showPasswordChange && (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  data-testid="change-password-btn"
                  className="px-4 py-2 rounded-lg bg-[#0A0A0C] border border-white/10 text-gray-300 hover:text-white hover:border-white/30 transition-all text-sm font-medium"
                >
                  पासवर्ड बदलें
                </button>
              )}
            </div>
          </CardHeader>
          {showPasswordChange && (
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300">वर्तमान पासवर्ड</Label>
                <div className="relative mt-1">
                  <Input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    data-testid="current-password-input"
                    className="bg-[#0A0A0C] border-white/10 text-white pr-10"
                    placeholder="वर्तमान पासवर्ड"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-gray-300">नया पासवर्ड</Label>
                <div className="relative mt-1">
                  <Input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="new-password-input"
                    className="bg-[#0A0A0C] border-white/10 text-white pr-10"
                    placeholder="नया पासवर्ड (कम से कम 6 अक्षर)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPw}
                  data-testid="save-password-btn"
                  className="flex-1 h-11 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
                >
                  {changingPw ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-5 h-5 mr-2" />
                  )}
                  {changingPw ? 'बदल रहा...' : 'पासवर्ड बदलें'}
                </Button>
                <Button
                  onClick={() => {
                    setShowPasswordChange(false);
                    setCurrentPassword('');
                    setNewPassword('');
                  }}
                  variant="outline"
                  data-testid="cancel-password-btn"
                  className="h-11 border-white/20 text-gray-300 hover:bg-white/10"
                >
                  <X className="w-5 h-5 mr-1" />
                  रद्द
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
      <FooterNav />
    </div>
  );
};

export default ProfilePage;
