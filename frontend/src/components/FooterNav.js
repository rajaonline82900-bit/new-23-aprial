import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, History, BarChart3, Gift } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const FooterNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const { t } = useLang();

  const items = [
    { to: '/dashboard', icon: Home, label: t('home'), match: '/dashboard' },
    { to: '/refer', icon: Gift, label: t('refer'), match: '/refer' },
    { to: '/bets', icon: History, label: t('bid_history'), match: '/bets' },
    { to: '/jantri', icon: BarChart3, label: t('result_chart'), match: '/jantri' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#A855F7]/30 shadow-[0_-4px_20px_rgba(168,85,247,0.12)]" data-testid="footer-nav">
      <div className="max-w-[480px] mx-auto">
        <div className="grid grid-cols-4">
          {items.map(({ to, icon: Icon, label, match }) => {
            const isActive = path === match || path.startsWith(match + '/');
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center py-3 transition-all active:scale-95"
                data-testid={`footer-${label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-all ${
                  isActive ? 'shadow-md' : ''
                }`} style={isActive ? { background: 'linear-gradient(135deg, #7E22CE 0%, #EC4899 100%)' } : { background: 'transparent' }}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-transparent bg-clip-text' : 'text-gray-600'}`}
                  style={isActive ? { backgroundImage: 'linear-gradient(135deg, #7E22CE 0%, #EC4899 100%)' } : {}}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default FooterNav;
