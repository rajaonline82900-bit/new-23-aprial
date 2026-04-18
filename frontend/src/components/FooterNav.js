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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141418] border-t border-white/10" data-testid="footer-nav">
      <div className="max-w-[480px] mx-auto">
        <div className="grid grid-cols-4">
          {items.map(({ to, icon: Icon, label, match }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center py-3 transition-all ${
                path === match || path.startsWith(match + '/')
                  ? 'text-[#D4AF37]'
                  : 'text-gray-400 hover:text-[#D4AF37]'
              }`}
              data-testid={`footer-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px]">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default FooterNav;
