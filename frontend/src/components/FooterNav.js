import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, IndianRupee, History, BarChart3, Gift } from 'lucide-react';
import { toast } from 'sonner';

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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141418] border-t border-white/10" data-testid="footer-nav">
      <div className="container mx-auto max-w-screen-xl">
        <div className="grid grid-cols-5">
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
          <button
            className="flex flex-col items-center py-3 text-gray-400 hover:text-[#D4AF37] transition-all"
            data-testid="footer-refer"
            onClick={() => toast.info('Refer & Earn जल्द आ रहा है!')}
          >
            <Gift className="w-5 h-5 mb-1" />
            <span className="text-[10px]">Refer & Earn</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default FooterNav;
