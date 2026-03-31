import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
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
  ChevronRight
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
  const [settings, setSettings] = useState({});
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('hi');

  useEffect(() => {
    if (open) {
      fetchSettings();
      const saved = localStorage.getItem('app_lang');
      if (saved) setSelectedLang(saved);
    }
  }, [open]);

  const fetchSettings = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`, { withCredentials: true });
      setSettings(data);
    } catch (e) {}
  };

  const handleLangSelect = (code) => {
    setSelectedLang(code);
    localStorage.setItem('app_lang', code);
    setLangOpen(false);
  };

  if (!open) return null;

  const menuItems = [
    {
      type: 'action',
      icon: Globe,
      label: 'Language',
      sublabel: LANGUAGES.find(l => l.code === selectedLang)?.label,
      onClick: () => setLangOpen(!langOpen),
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      type: 'link',
      icon: HelpCircle,
      label: 'How to Play',
      to: '/how-to-play',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      type: 'link',
      icon: ArrowDownLeft,
      label: 'Deposit History',
      to: '/wallet',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      type: 'link',
      icon: Trophy,
      label: 'Result History',
      to: '/results',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      type: 'link',
      icon: Gift,
      label: 'Refer & Earn',
      to: '/refer',
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
    },
    {
      type: 'link',
      icon: Star,
      label: 'Rate List',
      to: '/rate-list',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
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
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white font-['Unbounded']">मेनू</h2>
          <button
            onClick={onClose}
            data-testid="sidebar-close"
            className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
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
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${item.color}`} />
                      </div>
                      <div className="text-left">
                        <p className="text-white text-sm font-medium">{item.label}</p>
                        {item.sublabel && <p className="text-gray-500 text-xs">{item.sublabel}</p>}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${langOpen ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Language Dropdown */}
                  {langOpen && item.label === 'Language' && (
                    <div className="ml-12 mt-1 space-y-1">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => handleLangSelect(lang.code)}
                          data-testid={`lang-${lang.code}`}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                            selectedLang === lang.code
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-medium'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {lang.label}
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
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <p className="text-white text-sm font-medium">{item.label}</p>
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
          <p className="text-gray-500 text-xs uppercase tracking-wider px-3 mb-2">Customer Support</p>

          {settings.telegram_link && (
            <a
              href={settings.telegram_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              data-testid="sidebar-support-telegram"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#229ED9]/10 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#229ED9]" />
                </div>
                <p className="text-white text-sm font-medium">Telegram</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </a>
          )}

          {settings.whatsapp_link && (
            <a
              href={settings.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              data-testid="sidebar-support-whatsapp"
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                </div>
                <p className="text-white text-sm font-medium">WhatsApp</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </a>
          )}
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
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <p className="text-white text-sm font-medium">Withdrawal Proof</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SidebarMenu;
