import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  X,
  Globe,
  HelpCircle,
  ArrowDownLeft,
  Trophy,
  Gift,
  Star,
  MessageCircle,
  Send,
  ShieldCheck,
  ChevronRight,
  Download,
  LogOut,
  User
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी' },
  { code: 'en', label: 'English' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'ta', label: 'தமிழ்' },
];

const SidebarMenu = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const { lang, changeLang, t } = useLang();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({});
  const [langOpen, setLangOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setSettings(data);
    } catch (e) {}
  };

  const handleLangSelect = (code) => {
    changeLang(code);
    setLangOpen(false);
  };

  if (!open) return null;

  const menuItems = [
    {
      type: 'action',
      icon: Globe,
      label: t('language'),
      labelKey: 'Language',
      sublabel: LANGUAGES.find(l => l.code === lang)?.label,
      onClick: () => setLangOpen(!langOpen),
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      hex: '#60A5FA',
    },
    {
      type: 'link',
      icon: HelpCircle,
      label: t('how_to_play'),
      to: '/how-to-play',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      hex: '#34D399',
    },
    {
      type: 'link',
      icon: ArrowDownLeft,
      label: t('deposit_hist'),
      to: '/wallet',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      hex: '#4ADE80',
    },
    {
      type: 'link',
      icon: Trophy,
      label: t('result_history'),
      to: '/results',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      hex: '#C084FC',
    },
    {
      type: 'link',
      icon: Gift,
      label: t('refer_earn'),
      to: '/refer',
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      hex: '#F472B6',
    },
    {
      type: 'link',
      icon: Star,
      label: t('rate_list'),
      to: '/rate-list',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      hex: '#FACC15',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={onClose}
        data-testid="sidebar-backdrop"
      />

      {/* Sidebar */}
      <div
        className="fixed top-0 left-0 h-full w-[280px] bg-[#0A0A0C] border-r border-white/10 z-[70] overflow-y-auto animate-slide-in"
        data-testid="sidebar-menu"
      >
        {/* Profile Section at Top */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
                <User className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="text-white font-bold text-sm" data-testid="sidebar-user-name">{user?.name || 'User'}</p>
                <p className="text-gray-400 text-xs" data-testid="sidebar-user-phone">{user?.phone || ''}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              data-testid="sidebar-close"
              className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;

            if (item.type === 'action') {
              return (
                <div key={item.label}>
                  <button
                    onClick={item.onClick}
                    data-testid={`sidebar-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25) 0%, transparent 45%), conic-gradient(from 180deg, ${item.hex}, ${item.hex}88, ${item.hex}, ${item.hex}88, ${item.hex})`,
                          border: `1.5px solid ${item.hex}`,
                          boxShadow: `0 0 0 2px rgba(0,0,0,0.6), 0 4px 10px ${item.hex}55`,
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%)' }}
                        >
                          <Icon className="w-4 h-4" style={{ color: item.hex }} strokeWidth={2.4} />
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-white text-sm font-bold">{item.label}</p>
                        {item.sublabel && <p className="text-gray-400 text-xs">{item.sublabel}</p>}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${langOpen ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Language Dropdown */}
                  {langOpen && item.labelKey === 'Language' && (
                    <div className="ml-12 mt-1 space-y-1">
                      {LANGUAGES.map((lng) => (
                        <button
                          key={lng.code}
                          onClick={() => handleLangSelect(lng.code)}
                          data-testid={`lang-${lng.code}`}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                            lang === lng.code
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-medium'
                              : 'text-gray-400 hover:bg-[#0A0A0C]/5 hover:text-white'
                          }`}
                        >
                          {lng.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onClose}
                data-testid={`sidebar-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25) 0%, transparent 45%), conic-gradient(from 180deg, ${item.hex}, ${item.hex}88, ${item.hex}, ${item.hex}88, ${item.hex})`,
                      border: `1.5px solid ${item.hex}`,
                      boxShadow: `0 0 0 2px rgba(0,0,0,0.6), 0 4px 10px ${item.hex}55`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%)' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: item.hex }} strokeWidth={2.4} />
                    </div>
                  </div>
                  <p className="text-white text-sm font-bold">{item.label}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-white/10 my-2" />

        {/* Customer Support Section */}
        <div className="p-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider px-3 mb-2">{t('customer_support')}</p>

          {settings.telegram_link && (
            <a
              href={settings.telegram_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              data-testid="sidebar-support-telegram"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25) 0%, transparent 45%), conic-gradient(from 180deg, #229ED9, #229ED988, #229ED9, #229ED988, #229ED9)',
                    border: '1.5px solid #229ED9',
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 4px 10px #229ED955',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%)' }}
                  >
                    <Send className="w-4 h-4 text-[#229ED9]" strokeWidth={2.4} />
                  </div>
                </div>
                <p className="text-white text-sm font-bold">Telegram</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </a>
          )}

          {/* Live Chat — always visible, routes to internal chat page linked to admin panel */}
          <Link
              to="/chat"
              onClick={onClose}
              data-testid="sidebar-support-whatsapp"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25) 0%, transparent 45%), conic-gradient(from 180deg, #25D366, #25D36688, #25D366, #25D36688, #25D366)',
                    border: '1.5px solid #25D366',
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 4px 10px #25D36655',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%)' }}
                  >
                    <MessageCircle className="w-4 h-4 text-[#25D366]" strokeWidth={2.4} />
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-bold">Live Chat</p>
                  <p className="text-emerald-400 text-[10px] font-bold">Admin से सीधे बात करें</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </Link>
        </div>

        {/* Withdrawal Proof */}
        {settings.withdrawal_proof_telegram && (
          <>
            <div className="mx-4 border-t border-white/10 my-2" />
            <div className="p-3">
              <a
                href={settings.withdrawal_proof_telegram}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                data-testid="sidebar-withdrawal-proof"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.03] transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25) 0%, transparent 45%), conic-gradient(from 180deg, #D4AF37, #FFD700, #D4AF37, #FFD700, #D4AF37)',
                      border: '1.5px solid #D4AF37',
                      boxShadow: '0 0 0 2px rgba(0,0,0,0.6), 0 4px 10px #D4AF3755',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.9) 100%)' }}
                    >
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" strokeWidth={2.4} />
                    </div>
                  </div>
                  <p className="text-white text-sm font-bold">Withdrawal Proof</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </a>
            </div>
          </>
        )}

        {/* Install App Button */}
        <div className="mx-4 border-t border-white/10 my-2" />
        <div className="p-3">
          <button
            onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                setDeferredPrompt(null);
              } else {
                alert('ब्राउज़र मेनू में जाकर "Add to Home Screen" या "Install App" पर क्लिक करें।');
              }
              onClose();
            }}
            data-testid="sidebar-install-app"
            className="w-full flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-[#D4AF37]/20 to-[#FDE047]/10 border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center">
                <Download className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="text-left">
                <p className="text-[#D4AF37] text-sm font-bold">{t('install_app')}</p>
                <p className="text-gray-400 text-[10px]">{t('install_app_desc')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
          </button>
        </div>

        {/* Logout Button at Bottom */}
        <div className="mx-4 border-t border-white/10 my-2" />
        <div className="p-3 pb-6">
          <button
            onClick={handleLogout}
            data-testid="sidebar-logout-btn"
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-red-400 text-sm font-bold">{t('logout')}</p>
          </button>
        </div>
      </div>
    </>
  );
};

export default SidebarMenu;
