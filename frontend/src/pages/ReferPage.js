import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gift } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import FooterNav from '../components/FooterNav';

const ReferPage = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0C] pb-20">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-white font-['Unbounded']">Refer & Earn</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <p className="text-white text-xl font-bold mb-2">जल्द आ रहा है!</p>
            <p className="text-gray-400">Refer & Earn फीचर जल्द ही उपलब्ध होगा।</p>
          </CardContent>
        </Card>
      </main>
      <FooterNav />
    </div>
  );
};

export default ReferPage;
