import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ArrowLeft, Gift, Copy, Users, IndianRupee, Share2, Smartphone, Globe, Crown } from 'lucide-react';
import { toast } from 'sonner';
import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ReferPage = () => {
  const { user } = useAuth();
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

  const copyToClipboard = (text) => {
    // Robust copy: clipboard API → execCommand fallback for Android WebView APK.
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false).then((ok) => ok || legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  };

  const legacyCopy = (text) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  };

  const copyCode = () => {
    if (referralInfo?.code) {
      copyToClipboard(referralInfo.code).then((ok) => {
        if (ok) toast.success('रेफरल कोड कॉपी हो गया!');
        else toast.error('कॉपी नहीं हुआ — manually copy karein');
      });
    }
  };

  const APK_LINK = 'https://matka11.online/matka11.apk';
  const WEB_LINK = 'www.matka11.online';

  const copyText = (text, label) => {
    copyToClipboard(text).then((ok) => {
      if (ok) toast.success(`${label} कॉपी हो गया!`);
      else toast.error('कॉपी नहीं हुआ');
    });
  };

  const shareCode = () => {
    const referralLink = `${window.location.origin}/signup?ref=${referralInfo?.code}`;
    const text = `Shiv Shakti Club पर खेलें और जीतें!\n\nइस लिंक से साइनअप करें:\n${referralLink}\n\n📱 App Download: ${APK_LINK}\n🌐 iPhone Website: ${WEB_LINK}\n\nपहली जमा पर आपको 5% बोनस मिलेगा!`;
    if (navigator.share) {
      navigator.share({ title: 'Shiv Shakti Club - Refer & Earn', text, url: referralLink }).catch(() => {
        copyToClipboard(text).then((ok) => toast[ok ? 'success' : 'error'](ok ? 'शेयर टेक्स्ट कॉपी हुआ!' : 'कॉपी नहीं हुआ'));
      });
    } else {
      copyToClipboard(text).then((ok) => toast[ok ? 'success' : 'error'](ok ? 'शेयर लिंक कॉपी हो गया!' : 'कॉपी नहीं हुआ'));
    }
  };

  const shareWhatsApp = () => {
    const referralLink = `${window.location.origin}/signup?ref=${referralInfo?.code}`;
    const text = `Shiv Shakti Club पर खेलें और जीतें! 🎯\n\nइस लिंक से साइनअप करें:\n${referralLink}\n\n📱 App Download: ${APK_LINK}\n🌐 iPhone Website: ${WEB_LINK}\n\nपहली जमा पर आपको 5% बोनस मिलेगा! 💰`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    // Try window.open first (works in browsers); fallback to navigation for WebView APK.
    const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      // window.open blocked (typical in Android WebView) — navigate the current page
      window.location.href = waUrl;
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
    <div
      className="min-h-screen pb-20 app-shell relative overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 60% 40% at 50% 8%, rgba(255,215,0,0.28) 0%, rgba(212,175,55,0.14) 40%, transparent 70%),' +
          'radial-gradient(ellipse 40% 30% at 95% 45%, rgba(255,215,0,0.18) 0%, transparent 70%),' +
          'radial-gradient(ellipse 50% 35% at 5% 95%, rgba(139,92,246,0.20) 0%, transparent 70%),' +
          'linear-gradient(160deg, #0F0420 0%, #1A0B3D 35%, #2A1058 60%, #1A0B3D 85%, #0B0420 100%)',
        backgroundSize: '200% 200%, 200% 200%, 200% 200%, 100% 100%',
        animation: 'bgGoldDrift 22s ease-in-out infinite alternate',
      }}
    >
      <header className="sticky top-0 z-50 border-b border-[#D4AF37]/30" style={{ background: 'rgba(15, 4, 32, 0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="px-3 py-3 flex items-center gap-3">
          <Link to="/dashboard">
            <button className="p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#FFD700] hover:bg-[#D4AF37]/20 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-black font-['Unbounded']" style={{ backgroundImage: 'linear-gradient(135deg, #FFD700 0%, #FDE047 50%, #D4AF37 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Refer & Earn</h1>
        </div>
      </header>

      <main className="px-3 py-4 space-y-4 relative">
        {(() => {
          const refCount = referralInfo?.referred_count || 0;
          const earned = referralInfo?.total_earned || 0;
          // Determine tier by referral count
          const tiers = [
            { name: 'BRONZE',   min: 0,   next: 5,   color: '#CD7F32', accent: '#F4A261', icon: '🥉' },
            { name: 'SILVER',   min: 5,   next: 15,  color: '#C0C0C0', accent: '#E5E7EB', icon: '🥈' },
            { name: 'GOLD',     min: 15,  next: 30,  color: '#FFD700', accent: '#FDE047', icon: '🥇' },
            { name: 'PLATINUM', min: 30,  next: 60,  color: '#00CFFF', accent: '#7DD3FC', icon: '💎' },
            { name: 'DIAMOND',  min: 60,  next: 999, color: '#A78BFA', accent: '#DDD6FE', icon: '👑' },
          ];
          const tier = [...tiers].reverse().find(t => refCount >= t.min) || tiers[0];
          const idx = tiers.indexOf(tier);
          const nextTier = tiers[idx + 1] || tier;
          const progressPct = tier.next === 999 ? 100 : Math.min(100, Math.round(((refCount - tier.min) / (tier.next - tier.min)) * 100));
          const untilNext = Math.max(0, tier.next - refCount);
          // Circular ring math (SVG)
          const radius = 42;
          const circ = 2 * Math.PI * radius;
          const dashOffset = circ - (progressPct / 100) * circ;

          return (
        <Card
          className="border-0 overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, #1F1638 0%, #14102A 100%)',
            border: `2px solid ${tier.color}55`,
            boxShadow: `0 10px 30px ${tier.color}22, inset 0 1px 0 ${tier.color}22`,
          }}
        >
          <CardContent className="p-5 relative">
            {/* Ambient glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none opacity-40"
                 style={{ background: `radial-gradient(circle, ${tier.color}77 0%, transparent 65%)`, filter: 'blur(6px)' }} />

            {/* Player header — Avatar in progress ring + rank chip */}
            <div className="flex items-center gap-4 mb-4 relative">
              {/* Circular level ring */}
              <div className="relative" style={{ width: 96, height: 96 }}>
                <svg width="96" height="96" viewBox="0 0 96 96" className="absolute inset-0 -rotate-90">
                  <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                  <circle cx="48" cy="48" r={radius} fill="none" stroke={tier.color} strokeWidth="5"
                          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset}
                          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${tier.color})` }} />
                </svg>
                <div className="absolute inset-2 rounded-full flex items-center justify-center text-2xl font-black text-[#1A0F00]"
                     style={{
                       background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 45%), linear-gradient(135deg, ${tier.color} 0%, ${tier.accent} 100%)`,
                       boxShadow: `inset 0 1px 3px rgba(255,255,255,0.4), inset 0 -3px 5px rgba(0,0,0,0.3)`,
                     }}>
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                {/* Tier badge floating at bottom */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-black tracking-widest shadow-lg"
                     style={{ background: `linear-gradient(135deg, ${tier.color} 0%, ${tier.accent} 100%)`, color: '#0A0A14', border: '1.5px solid rgba(0,0,0,0.4)' }}>
                  {tier.icon} {tier.name}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-black flex items-center gap-1" style={{ color: tier.color }}>
                  <Crown className="w-3 h-3" /> Rank
                </p>
                <h2 className="text-white text-lg font-black truncate" data-testid="refer-user-name">{user?.name || 'Player'}</h2>
                <p className="text-gray-400 text-[11px]">{user?.phone || ''}</p>
                {untilNext > 0 && untilNext < 999 && (
                  <p className="mt-1 text-[10px] font-bold" style={{ color: nextTier.color }}>
                    {untilNext} more → {nextTier.name}
                  </p>
                )}
              </div>
            </div>

            {/* XP-style progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1 text-[10px] uppercase tracking-widest font-black">
                <span style={{ color: tier.color }}>Level Progress</span>
                <span className="text-white tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden relative"
                   style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)' }}>
                <div className="h-full rounded-full relative overflow-hidden"
                     style={{
                       width: `${progressPct}%`,
                       background: `linear-gradient(90deg, ${tier.color} 0%, ${tier.accent} 50%, ${tier.color} 100%)`,
                       backgroundSize: '200% 100%',
                       animation: 'bgGoldDrift 2s linear infinite',
                       boxShadow: `0 0 8px ${tier.color}`,
                     }}
                />
              </div>
            </div>

            {/* Gamified Stat tiles */}
            <div className="grid grid-cols-2 gap-3">
              {/* Referrals */}
              <div className="relative rounded-xl p-3 overflow-hidden text-center"
                   style={{
                     background: 'linear-gradient(160deg, rgba(20, 169, 76, 0.25) 0%, rgba(0,0,0,0.5) 100%)',
                     border: '1.5px solid rgba(34, 197, 94, 0.55)',
                     boxShadow: 'inset 0 1px 0 rgba(34,197,94,0.3), 0 4px 12px rgba(20,169,76,0.15)',
                   }}>
                <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-1"
                     style={{ background: 'conic-gradient(from 180deg, #14A94C, #22C55E, #14A94C)', border: '2px solid #22C55E', boxShadow: '0 0 8px #22C55E88' }}>
                  <Users className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <p className="text-2xl font-black text-white tabular-nums leading-none" data-testid="refer-total-count">{refCount}</p>
                <p className="text-[9px] uppercase tracking-widest text-emerald-300 font-black mt-1">Team Size</p>
              </div>

              {/* Earnings */}
              <div className="relative rounded-xl p-3 overflow-hidden text-center"
                   style={{
                     background: 'linear-gradient(160deg, rgba(255, 215, 0, 0.25) 0%, rgba(0,0,0,0.5) 100%)',
                     border: '1.5px solid rgba(255, 215, 0, 0.55)',
                     boxShadow: 'inset 0 1px 0 rgba(255,215,0,0.3), 0 4px 12px rgba(255,215,0,0.15)',
                   }}>
                <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-1"
                     style={{ background: 'conic-gradient(from 180deg, #B8860B, #FFD700, #B8860B)', border: '2px solid #FFD700', boxShadow: '0 0 8px #FFD70088' }}>
                  <IndianRupee className="w-4 h-4 text-white" strokeWidth={2.8} />
                </div>
                <p className="text-2xl font-black tabular-nums leading-none"
                   style={{ backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #FDE047 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                   data-testid="refer-total-income">
                  ₹{earned.toFixed(0)}
                </p>
                <p className="text-[9px] uppercase tracking-widest text-yellow-300 font-black mt-1">Total Earned</p>
              </div>
            </div>

            {/* Achievement badges row */}
            <div className="mt-4 flex items-center justify-between px-1">
              {tiers.map((t, i) => {
                const unlocked = refCount >= t.min;
                return (
                  <div key={t.name} className="flex flex-col items-center gap-1" title={`${t.name} (${t.min}+)`}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                      style={{
                        background: unlocked
                          ? `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 45%), linear-gradient(135deg, ${t.color} 0%, ${t.accent} 100%)`
                          : 'rgba(255,255,255,0.05)',
                        border: unlocked ? `1.5px solid ${t.color}` : '1.5px solid rgba(255,255,255,0.1)',
                        boxShadow: unlocked ? `0 0 8px ${t.color}` : 'none',
                        filter: unlocked ? 'none' : 'grayscale(1) opacity(0.4)',
                      }}
                    >
                      {t.icon}
                    </div>
                    <span className="text-[8px] font-black tracking-wider uppercase" style={{ color: unlocked ? t.color : '#6B7280' }}>
                      {t.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Earn-rate banner */}
            <div className="mt-4 rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px dashed rgba(212, 175, 55, 0.5)' }}>
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-[#FFD700]" />
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">हर friend की पहली जमा पर <span className="text-[#FFD700]">5% बोनस</span></p>
                <p className="text-gray-400 text-[11px] mt-0.5">Lifetime — कोई limit नहीं!</p>
              </div>
            </div>
          </CardContent>
        </Card>
          );
        })()}

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

        {/* App Download & Website Links */}
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-5 space-y-3">
            <p className="text-white font-bold text-sm mb-1">App & Website Links</p>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-[#10B981]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-[11px]">Android App Download</p>
                <a
                  href="https://matka11.online/matka11.apk"
                  className="text-[#10B981] text-xs font-medium break-all hover:underline"
                  data-testid="refer-apk-link"
                >
                  https://matka11.online/matka11.apk
                </a>
              </div>
              <button
                onClick={() => copyText('https://matka11.online/matka11.apk', 'App link')}
                data-testid="copy-apk-link"
                className="p-2 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/20 transition-all shrink-0"
                aria-label="copy apk link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-[11px]">iPhone Website Link</p>
                <a
                  href="https://www.matka11.online"
                  className="text-[#D4AF37] text-xs font-medium break-all hover:underline"
                  data-testid="refer-web-link"
                >
                  www.matka11.online
                </a>
              </div>
              <button
                onClick={() => copyText('www.matka11.online', 'Website link')}
                data-testid="copy-web-link"
                className="p-2 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all shrink-0"
                aria-label="copy web link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 hidden">
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
