import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Coins, Wallet, Gift, User } from 'lucide-react';
import { useLang } from '../context/LanguageContext';

const FooterNav = () => {
  const location = useLocation();
  const path = location.pathname;
  const { t } = useLang();

  const items = [
    { to: '/coin', icon: Coins, label: t('home') || 'Play', match: '/coin' },
    { to: '/wallet', icon: Wallet, label: 'Wallet', match: '/wallet' },
    { to: '/refer', icon: Gift, label: t('refer') || 'Refer', match: '/refer' },
    { to: '/profile', icon: User, label: 'Profile', match: '/profile' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'linear-gradient(180deg, #14142B 0%, #0A0A14 100%)',
        borderTop: '1px solid rgba(255, 215, 0, 0.35)',
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.6)',
      }}
      data-testid="footer-nav"
    >
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
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-all"
                  style={
                    isActive
                      ? {
                          background:
                            'linear-gradient(135deg, #FFD700 0%, #FDE047 40%, #14A94C 100%)',
                          boxShadow: '0 4px 14px rgba(255, 215, 0, 0.55)',
                        }
                      : { background: 'transparent' }
                  }
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: isActive ? '#1A1A2E' : '#9CA3AF' }}
                  />
                </div>
                <span
                  className="text-[10px] font-bold tracking-wide"
                  style={{ color: isActive ? '#FFD700' : '#9CA3AF' }}
                >
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
