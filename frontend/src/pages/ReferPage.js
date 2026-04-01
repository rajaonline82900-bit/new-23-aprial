import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ArrowLeft, Gift, Copy, Users, IndianRupee, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ReferPage = () => {
  const [referralInfo, setReferralInfo] = useState(null);
  const [applyCode, setApplyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => { fetchReferralInfo(); }, []);

  const fetchReferralInfo = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/referral/info`, { withCredentials: true });
      setReferralInfo(data);
    } catch (e) {
      toast.error('रेफरल जानकारी लोड नहीं हो पाई');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (referralInfo?.code) {
      navigator.clipboard.writeText(referralInfo.code);
      toast.success('रेफरल कोड कॉपी हो गया!');
    }
  };

  const shareCode = () => {
    const referralLink = `${window.location.origin}/signup?ref=${referralInfo?.code}`;
    const text = `सट्टा मटका पर खेलें और जीतें!\n\nइस लिंक से साइनअप करें:\n${referralLink}\n\nपहली जमा पर आपको 5% बोनस मिलेगा!`;
    if (navigator.share) {
      navigator.share({ title: 'सट्टा मटका - Refer & Earn', text, url: referralLink });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('शेयर लिंक कॉपी हो गया!');
    }
  };

  const shareWhatsApp = () => {
    const referralLink = `${window.location.origin}/signup?ref=${referralInfo?.code}`;
    const text = `सट्टा मटका पर खेलें और जीतें! 🎯\n\nइस लिंक से साइनअप करें:\n${referralLink}\n\nपहली जमा पर आपको 5% बोनस मिलेगा! 💰`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleApply = async () => {
    if (!applyCode.trim()) { toast.error('रेफरल कोड दर्ज करें'); return; }
    setApplying(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/referral/apply`, { code: applyCode }, { withCredentials: true });
      toast.success(data.message);
      setApplyCode('');
      fetchReferralInfo();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'रेफरल कोड लागू नहीं हो पाया');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] pb-20">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-white font-['Unbounded']">Refer & Earn</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Hero Card */}
        <Card className="bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] border-[#D4AF37]/30">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <h2 className="text-white text-xl font-bold mb-2">दोस्तों को बुलाएं, कमाई करें!</h2>
            <p className="text-gray-400 text-sm">
              अपना रेफरल लिंक शेयर करें। जब आपका दोस्त लिंक से साइनअप करके पहली जमा करेगा, 
              आपको उसकी पहली जमा का <span className="text-[#D4AF37] font-bold">5% बोनस</span> मिलेगा!
            </p>
          </CardContent>
        </Card>

        {/* Your Referral Code */}
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-5">
            <p className="text-gray-400 text-sm mb-3">आपका रेफरल कोड</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0A0A0C] border border-dashed border-[#D4AF37]/50 rounded-lg p-3 text-center">
                <span className="text-[#D4AF37] text-2xl font-bold tracking-widest font-['Unbounded']" data-testid="referral-code">
                  {referralInfo?.code || '---'}
                </span>
              </div>
              <button
                onClick={copyCode}
                data-testid="copy-referral-code"
                className="p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                onClick={shareWhatsApp}
                data-testid="share-whatsapp"
                className="flex-1 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </Button>
              <Button
                onClick={shareCode}
                data-testid="share-referral"
                className="flex-1 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
              >
                <Share2 className="w-4 h-4 mr-2" />
                शेयर करें
              </Button>
            </div>
            
            {/* Referral Link Display */}
            <div className="mt-3 p-3 bg-[#0A0A0C] rounded-lg border border-white/5">
              <p className="text-gray-500 text-xs mb-1">आपका रेफरल लिंक</p>
              <p className="text-gray-300 text-xs break-all" data-testid="referral-link">
                {window.location.origin}/signup?ref={referralInfo?.code}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{referralInfo?.referred_count || 0}</p>
              <p className="text-gray-400 text-xs">दोस्त ज्वाइन किए</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-4 text-center">
              <IndianRupee className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">₹{referralInfo?.total_earned || 0}</p>
              <p className="text-gray-400 text-xs">कुल कमाई</p>
            </CardContent>
          </Card>
        </div>

        {/* Apply Referral Code */}
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-5">
            <p className="text-gray-400 text-sm mb-3">किसी का रेफरल कोड लगाएं</p>
            <div className="flex gap-2">
              <Input
                placeholder="रेफरल कोड दर्ज करें"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                data-testid="apply-referral-input"
                className="bg-[#0A0A0C] border-white/10 text-white uppercase tracking-wider"
              />
              <Button
                onClick={handleApply}
                disabled={applying}
                data-testid="apply-referral-btn"
                className="bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold px-6"
              >
                {applying ? '...' : 'लागू करें'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-5">
            <p className="text-white font-bold mb-3">कैसे काम करता है?</p>
            <div className="space-y-3">
              {[
                { step: '1', text: 'अपना रेफरल लिंक दोस्तों को शेयर करें' },
                { step: '2', text: 'दोस्त लिंक से साइनअप करे (कोड ऑटो लागू होगा)' },
                { step: '3', text: 'दोस्त की पहली जमा पर आपको 5% बोनस मिलेगा!' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                    <span className="text-[#D4AF37] font-bold text-sm">{s.step}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{s.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
      <FooterNav />
    </div>
  );
};

export default ReferPage;
