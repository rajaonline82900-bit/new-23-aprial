import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, IndianRupee, History, BarChart3, RefreshCw } from 'lucide-react';

const FooterNav = () => {
  const location = useLocation();
  const path = location.pathname;

  const items = [
    { to: '/dashboard', icon: Home, label: 'Home', match: '/dashboard' },
    { to: '/wallet', icon: IndianRupee, label: 'Fund', match: '/wallet' },
    { to: '/bets', icon: History, label: 'Bid History', match: '/bets' },
    { to: '/jantri', icon: BarChart3, label: 'Result Chart', match: '/jantri' },
  ];

  return (
    <>
      {/* Floating Refresh Button - Bottom Right */}
      <button
        onClick={() => window.location.reload()}
        data-testid="floating-refresh-btn"
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FDE047] shadow-lg shadow-[#D4AF37]/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <RefreshCw className="w-6 h-6 text-black" />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141418] border-t border-white/10" data-testid="footer-nav">
        <div className="container mx-auto max-w-screen-xl">
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
    </>
  );
};

export default FooterNav;
