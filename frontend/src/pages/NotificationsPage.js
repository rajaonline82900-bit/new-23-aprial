import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { 
  ArrowLeft, 
  Bell,
  MessageCircle,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NotificationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [telegramId, setTelegramId] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [instructions, setInstructions] = useState(null);

  useEffect(() => {
    fetchStatus();
    fetchInstructions();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/notifications/status`, { withCredentials: true });
      setStatus(data);
      if (data.subscription) {
        setTelegramId(data.subscription.telegram_chat_id || '');
        setWhatsappNumber(data.subscription.whatsapp_number || '');
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstructions = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/notifications/telegram-instructions`);
      setInstructions(data);
    } catch (error) {
      console.error('Error fetching instructions:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!telegramId && !whatsappNumber) {
      toast.error('कम से कम एक notification method चुनें');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/notifications/subscribe`, {
        telegram_chat_id: telegramId || null,
        whatsapp_number: whatsappNumber || null
      }, { withCredentials: true });
      
      toast.success('Notifications subscribed successfully!');
      await fetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Subscription failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    setSaving(true);
    try {
      await axios.delete(`${API_URL}/api/notifications/unsubscribe`, { withCredentials: true });
      toast.success('Unsubscribed from notifications');
      setStatus(prev => ({ ...prev, subscribed: false, subscription: null }));
      setTelegramId('');
      setWhatsappNumber('');
    } catch (error) {
      toast.error('Unsubscribe failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6 text-[#D4AF37]" />
              <h1 className="text-xl font-bold text-white font-['Unbounded']">Notifications</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Status Card */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D4AF37]" />
              Notification Status
            </CardTitle>
            <CardDescription className="text-gray-400">
              रिजल्ट घोषित होते ही आपको notification मिलेगी
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                {status?.subscribed ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-gray-500" />
                )}
                <div>
                  <p className="text-white font-medium">
                    {status?.subscribed ? 'Subscribed' : 'Not Subscribed'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {status?.subscribed 
                      ? 'आप रिजल्ट notifications प्राप्त करेंगे' 
                      : 'नीचे से subscribe करें'}
                  </p>
                </div>
              </div>
              <Badge className={status?.subscribed 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-gray-500/20 text-gray-400'
              }>
                {status?.subscribed ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {/* Service Status */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-5 h-5 text-blue-400" />
                  <span className="text-white font-medium">Telegram</span>
                </div>
                <Badge className={status?.service_status?.telegram_enabled 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-yellow-500/20 text-yellow-400'
                }>
                  {status?.service_status?.telegram_enabled ? 'Available' : 'Setup Required'}
                </Badge>
              </div>
              
              <div className="p-4 bg-[#0A0A0C] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-green-400" />
                  <span className="text-white font-medium">WhatsApp</span>
                </div>
                <Badge className={status?.service_status?.whatsapp_enabled 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-yellow-500/20 text-yellow-400'
                }>
                  {status?.service_status?.whatsapp_enabled ? 'Available' : 'Setup Required'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Setup */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-400" />
              Telegram Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {instructions && (
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                  <p className="text-blue-300 font-medium">Setup Instructions</p>
                </div>
                <ol className="text-gray-300 text-sm space-y-2 ml-7">
                  {instructions.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div>
              <Label className="text-gray-300 mb-2 block">Telegram Chat ID</Label>
              <Input
                type="text"
                placeholder="जैसे: 123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                data-testid="telegram-chat-id-input"
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Setup */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-400" />
              WhatsApp Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-gray-300 mb-2 block">WhatsApp Number</Label>
              <Input
                type="tel"
                placeholder="+91 XXXXXXXXXX"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                data-testid="whatsapp-number-input"
                className="bg-[#0A0A0C] border-white/10 text-white"
              />
              <p className="text-gray-400 text-sm mt-2">
                Note: WhatsApp notifications require admin setup
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleSubscribe}
            disabled={saving}
            data-testid="subscribe-notifications-button"
            className="flex-1 h-12 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {status?.subscribed ? 'Update Subscription' : 'Subscribe'}
              </span>
            )}
          </Button>
          
          {status?.subscribed && (
            <Button
              onClick={handleUnsubscribe}
              disabled={saving}
              variant="outline"
              data-testid="unsubscribe-notifications-button"
              className="h-12 border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Unsubscribe
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;
