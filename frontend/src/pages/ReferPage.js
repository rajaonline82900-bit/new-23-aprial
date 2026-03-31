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
    const text = `सट्टा मटका पर खेलें और जीतें! मेरा रेफरल कोड: ${referralInfo?.code}\n\nसाइनअप करें और ₹50 बोनस पाएं!\n${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'सट्टा मटका - Refer & Earn', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('शेयर लिंक कॉपी हो गया!');
    }
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
            <h2 className="text-white text-xl font-bold mb-2">दोस्तों को बुलाएं, ₹50 कमाएं!</h2>
            <p className="text-gray-400 text-sm">
              अपना रेफरल कोड शेयर करें। जब आपका दोस्त कोड लगाएगा, 
              आप दोनों को <span className="text-[#D4AF37] font-bold">₹50</span> बोनस मिलेगा!
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
            
            <Button
              onClick={shareCode}
              data-testid="share-referral"
              className="w-full mt-4 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
            >
              <Share2 className="w-4 h-4 mr-2" />
              कोड शेयर करें
            </Button>
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
                { step: '1', text: 'अपना रेफरल कोड दोस्तों को शेयर करें' },
                { step: '2', text: 'दोस्त साइनअप करके आपका कोड लगाए' },
                { step: '3', text: 'दोनों को ₹50 बोनस तुरंत मिलेगा!' },
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
