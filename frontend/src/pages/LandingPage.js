import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Sparkles, Trophy, Shield, Zap, Clock, Star, ChevronRight, Coins } from 'lucide-react';

const LandingPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      await window.deferredPrompt.userChoice;
      window.deferredPrompt = null;
    } else {
      alert('ब्राउज़र मेनू में जाकर "Add to Home Screen" या "Install App" पर क्लिक करें।');
    }
  };

  const games = [
    { name: 'दिल्ली बाज़ार', time: '07:00 - 15:00' },
    { name: 'श्री गणेश', time: '07:00 - 16:20' },
    { name: 'फरीदाबाद', time: '07:00 - 18:00' },
    { name: 'गाजियाबाद', time: '07:00 - 20:50' },
    { name: 'गली', time: '07:00 - 23:00' },
    { name: 'दिसावर', time: '00:00 - 04:00' },
  ];

  const features = [
    { icon: Zap, title: 'तुरंत पेमेंट', desc: 'UPI से जमा करें, तुरंत बैलेंस अपडेट', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { icon: Trophy, title: '90x जीत', desc: 'जोड़ी पर 90 गुना, हरूफ पर 9 गुना', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Shield, title: '100% सुरक्षित', desc: 'आपका पैसा पूरी तरह सुरक्षित', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Clock, title: '24/7 सपोर्ट', desc: 'Telegram और WhatsApp पर सहायता', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  const steps = [
    { num: '01', title: 'अकाउंट बनाएं', desc: 'फ्री रजिस्टर करें' },
    { num: '02', title: 'पैसे जमा करें', desc: 'UPI से मिनिमम ₹100' },
    { num: '03', title: 'गेम चुनें', desc: 'अपना पसंदीदा गेम चुनें' },
    { num: '04', title: 'जीतें!', desc: '90x तक जीत का मौका' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0C] overflow-x-hidden">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(10,10,12,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center">
              <Coins className="w-5 h-5 text-black" />
            </div>
            <span className="text-xl font-bold text-white font-['Unbounded']">सट्टा मटका</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" data-testid="landing-login-btn">
              <button className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition-all">
                लॉगिन
              </button>
            </Link>
            <button
              onClick={handleInstall}
              data-testid="landing-install-nav"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-sm hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-[#D4AF37]/20"
            >
              <Download className="w-4 h-4" />
              App Install करें
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-28 pb-20 px-4">
        {/* Glow effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#D4AF37]/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[200px] h-[200px] bg-[#D4AF37]/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 mb-8">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[#D4AF37] text-sm font-medium">#1 Trusted Satta Matka Platform</span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight mb-6 font-['Unbounded']">
              अपना भाग्य
              <br />
              <span className="bg-gradient-to-r from-[#D4AF37] via-[#FDE047] to-[#D4AF37] bg-clip-text text-transparent">
                आज़माएं
              </span>
            </h1>

            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              दिल्ली बाज़ार, गली, दिसावर और अन्य गेम्स पर बेट लगाएं।
              <span className="text-white font-medium"> जोड़ी पर 90 गुना जीत!</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button
                onClick={handleInstall}
                data-testid="landing-install-hero"
                className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#D4AF37]/30"
              >
                <Download className="w-5 h-5 group-hover:animate-bounce" />
                App Install करें
                <ChevronRight className="w-5 h-5" />
              </button>

              <Link to="/signup" data-testid="landing-register-btn">
                <button className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 hover:border-white/40 transition-all">
                  फ्री अकाउंट बनाएं
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-[#D4AF37] font-['Unbounded']">6+</p>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">गेम्स</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-2xl sm:text-3xl font-black text-[#D4AF37] font-['Unbounded']">90x</p>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">अधिकतम जीत</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-[#D4AF37] font-['Unbounded']">24/7</p>
                <p className="text-gray-500 text-xs sm:text-sm mt-1">सपोर्ट</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Unbounded'] mb-3">हमारे गेम्स</h2>
            <p className="text-gray-500 text-base">रोज़ाना खेलें, रोज़ाना जीतें</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {games.map((game, i) => (
              <div
                key={i}
                className="group p-4 sm:p-5 rounded-xl bg-[#141418] border border-white/5 hover:border-[#D4AF37]/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center mb-3">
                  <Star className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <p className="text-white font-bold text-sm sm:text-base mb-1">{game.name}</p>
                <p className="text-gray-500 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {game.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Unbounded'] mb-3">क्यों चुनें हमें?</h2>
            <p className="text-gray-500 text-base">सबसे भरोसेमंद प्लेटफॉर्म</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="p-6 rounded-xl bg-[#141418] border border-white/5 hover:border-white/10 transition-all">
                  <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${f.color}`} />
                  </div>
                  <p className="text-white font-bold text-lg mb-2">{f.title}</p>
                  <p className="text-gray-500 text-sm">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to Play Section */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Unbounded'] mb-3">कैसे खेलें?</h2>
            <p className="text-gray-500 text-base">सिर्फ 4 आसान स्टेप्स</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <div key={i} className="relative p-6 rounded-xl bg-[#141418] border border-white/5">
                <span className="text-5xl font-black text-[#D4AF37]/10 font-['Unbounded'] absolute top-3 right-4">{step.num}</span>
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center mb-4">
                    <span className="text-[#D4AF37] font-bold text-sm">{step.num}</span>
                  </div>
                  <p className="text-white font-bold mb-1">{step.title}</p>
                  <p className="text-gray-500 text-sm">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rate List Section */}
      <section className="py-16 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Unbounded'] mb-3">रेट लिस्ट</h2>
            <p className="text-gray-500 text-base">जितना लगाओ, उतना गुना जीतो</p>
          </div>
          <div className="space-y-3">
            {[
              { type: 'जोड़ी (Jodi)', range: '00-99', multi: '90x', ex: '₹10 → ₹900' },
              { type: 'हरूफ अंदर', range: '0-9', multi: '9x', ex: '₹10 → ₹90' },
              { type: 'हरूफ बाहर', range: '0-9', multi: '9x', ex: '₹10 → ₹90' },
              { type: 'क्रॉस बेट', range: 'Auto Jodi', multi: '90x/jodi', ex: 'सभी जोड़ी combinations' },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[#141418] border border-white/5">
                <div>
                  <p className="text-white font-semibold">{r.type}</p>
                  <p className="text-gray-500 text-xs">{r.range} • {r.ex}</p>
                </div>
                <span className="px-4 py-1.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-bold text-sm">{r.multi}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-[#D4AF37]/5 to-transparent pointer-events-none" />
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-black text-white font-['Unbounded'] mb-4">
            आज ही शुरू करें!
          </h2>
          <p className="text-gray-400 text-base sm:text-lg mb-8">
            App इंस्टॉल करें और अपना पहला गेम खेलें
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleInstall}
              data-testid="landing-install-cta"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#D4AF37]/30"
            >
              <Download className="w-5 h-5 group-hover:animate-bounce" />
              App Install करें
            </button>
            <Link to="/signup">
              <button className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/5 transition-all">
                रजिस्टर करें
                <ChevronRight className="w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center">
              <Coins className="w-4 h-4 text-black" />
            </div>
            <span className="text-white font-bold font-['Unbounded']">सट्टा मटका</span>
          </div>
          <p className="text-gray-600 text-xs">Disclaimer: This platform is for entertainment purposes only.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
