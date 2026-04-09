import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Download, Shield, Zap, Trophy, Star, ChevronRight, Smartphone } from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (user) { navigate('/dashboard', { replace: true }); return; }

    // If opened as installed PWA, go directly to signup/login
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      navigate('/signup', { replace: true });
      return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capture install prompt (Android/Chrome)
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [user, navigate]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      // Fallback - show manual instructions
      setShowIOSGuide(true);
    }
  };

  const features = [
    { icon: Zap, title: 'Fast Results', desc: 'Results turant milte hain', color: '#D4AF37' },
    { icon: Shield, title: 'Secure', desc: '100% safe aur secure app', color: '#10B981' },
    { icon: Trophy, title: 'Daily Games', desc: '6 games har din available', color: '#8B5CF6' },
    { icon: Star, title: 'Best Rates', desc: 'Market ki sabse achi rates', color: '#F59E0B' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0C] relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[#D4AF37]/[0.06] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-900/[0.08] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-[-100px] w-[300px] h-[300px] bg-blue-900/[0.05] rounded-full blur-[80px]" />
      </div>

      <div className="max-w-[480px] mx-auto px-5 py-8">
        {/* Logo Section */}
        <div className="text-center mb-10 pt-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] shadow-2xl shadow-[#D4AF37]/30 mb-6">
            <span className="text-black text-4xl font-black font-['Unbounded']">M</span>
          </div>
          <h1 className="text-4xl font-black text-white font-['Unbounded'] mb-2" data-testid="landing-title">
            MATKA <span className="text-[#D4AF37]">11</span>
          </h1>
          <p className="text-gray-400 text-sm">India's Most Trusted Matka Platform</p>
          <div className="flex items-center justify-center gap-1 mt-3">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className="w-4 h-4 text-[#D4AF37] fill-[#D4AF37]" />
            ))}
            <span className="text-gray-400 text-xs ml-1">4.9/5 Rating</span>
          </div>
        </div>

        {/* Download Section */}
        <div className="mb-10">
          {isInstalled ? (
            <button
              onClick={() => navigate('/signup')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-[#10B981]/30 active:scale-[0.98] transition-transform"
              data-testid="landing-open-app"
            >
              <Smartphone className="w-6 h-6" />
              App Open Karein
            </button>
          ) : (
            <>
              <button
                onClick={handleInstall}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#FDE047] text-black font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-[#D4AF37]/30 hover:shadow-[#D4AF37]/50 active:scale-[0.98] transition-all"
                data-testid="landing-download-btn"
              >
                <Download className="w-6 h-6" />
                {isIOS ? 'iPhone me Install Karein' : 'Download App'}
              </button>
            </>
          )}
          <p className="text-center text-gray-500 text-xs mt-3">
            {isIOS ? 'Safari browser me kholein aur install karein' : 'Android & iPhone dono me chalega'}
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => navigate('/signup')}
              className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              data-testid="landing-signup-btn-top"
            >
              Sign Up
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-3 rounded-xl bg-[#141418] border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:border-[#D4AF37]/50 active:scale-[0.98] transition-all"
              data-testid="landing-login-btn-top"
            >
              Login
            </button>
          </div>
        </div>

        {/* iOS Install Guide Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-end" onClick={() => setShowIOSGuide(false)}>
            <div className="w-full max-w-[480px] mx-auto bg-[#141418] rounded-t-3xl p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full bg-gray-600 mx-auto mb-6" />
              <h3 className="text-white font-bold text-lg mb-5 text-center font-['Unbounded']">
                {isIOS ? 'iPhone me Install karein' : 'App Install karein'}
              </h3>
              <div className="space-y-5">
                {isIOS ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#D4AF37] font-bold text-sm">1</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">Safari me kholein</p>
                        <p className="text-gray-400 text-xs">www.matka11.online ko <span className="text-blue-400 font-bold">Safari</span> browser me kholein (Chrome nahi!)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#D4AF37] font-bold text-sm">2</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">Share button dabayein
                          <svg className="inline w-5 h-5 ml-1 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                        </p>
                        <p className="text-gray-400 text-xs">Neeche ke <span className="text-blue-400 font-bold">Share</span> icon pe tap karein</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#D4AF37] font-bold text-sm">3</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">"Add to Home Screen" pe tap karein</p>
                        <p className="text-gray-400 text-xs">List me scroll karke <span className="text-white font-bold">Add to Home Screen</span> select karein</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-400 font-bold text-sm">4</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">"Add" pe tap karein</p>
                        <p className="text-gray-400 text-xs">App Home Screen pe install ho jayegi!</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#D4AF37] font-bold text-sm">1</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">Chrome me kholein</p>
                        <p className="text-gray-400 text-xs">www.matka11.online Chrome browser me kholein</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#D4AF37] font-bold text-sm">2</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">3 dot menu dabayein</p>
                        <p className="text-gray-400 text-xs">Upar right me 3 dots pe click karein</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[#D4AF37] font-bold text-sm">3</span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-bold">"Install app" ya "Add to Home Screen" select karein</p>
                        <p className="text-gray-400 text-xs">App install ho jayegi home screen pe</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full mt-6 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-sm"
              >
                Samajh aa gaya
              </button>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {features.map((f, i) => (
            <div key={i} className="bg-[#141418] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${f.color}15` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <p className="text-white font-bold text-sm mb-0.5">{f.title}</p>
              <p className="text-gray-500 text-xs">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Games Preview */}
        <div className="mb-10">
          <h3 className="text-white font-bold text-base font-['Unbounded'] mb-4">Available Games</h3>
          <div className="space-y-2">
            {['Delhi Bazaar', 'Shri Ganesh', 'Faridabad', 'Ghaziabad', 'Gali', 'Disawar'].map((game, i) => (
              <div key={i} className="flex items-center justify-between bg-[#141418] border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <span className="text-white text-sm font-medium">{game}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            ))}
          </div>
        </div>

        {/* Login/Signup Buttons */}
        <div className="space-y-3 mb-8">
          <button
            onClick={() => navigate('/signup')}
            className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            data-testid="landing-signup-btn"
          >
            Account Banayein
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 rounded-xl bg-[#141418] border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 hover:border-[#D4AF37]/50 active:scale-[0.98] transition-all"
            data-testid="landing-login-btn"
          >
            Login Karein
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <a
            href="https://www.google.com/search?q=matka11.online"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-500 text-xs hover:text-gray-400 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            www.matka11.online
          </a>
          <p className="text-gray-600 text-[10px] mt-2">MATKA 11 &copy; 2026. All Rights Reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
