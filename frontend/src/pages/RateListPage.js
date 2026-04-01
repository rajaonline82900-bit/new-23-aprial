import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import FooterNav from '../components/FooterNav';

const RateListPage = () => {
  const rates = [
    { type: 'जोड़ी (Jodi)', range: '00-99', multiplier: '100x', example: '₹10 लगाओ → ₹1000 जीतो' },
    { type: 'हरूफ अंदर (Haruf Andar)', range: '0-9', multiplier: '10x', example: '₹10 लगाओ → ₹100 जीतो' },
    { type: 'हरूफ बाहर (Haruf Bahar)', range: '0-9', multiplier: '10x', example: '₹10 लगाओ → ₹100 जीतो' },
    { type: 'क्रॉस बेट (Crossing)', range: 'Auto Jodi', multiplier: '100x per jodi', example: '₹10 लगाओ → ₹1000 प्रति जोड़ी जीतो' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0C] pb-20">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/dashboard">
            <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-white font-['Unbounded']">Rate List</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 space-y-4">
        {rates.map((rate, i) => (
          <Card key={i} className="bg-[#141418] border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-semibold">{rate.type}</p>
                <span className="px-3 py-1 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-sm font-bold">{rate.multiplier}</span>
              </div>
              <p className="text-gray-400 text-sm">Range: {rate.range}</p>
              <p className="text-emerald-400 text-sm mt-1">{rate.example}</p>
            </CardContent>
          </Card>
        ))}
      </main>
      <FooterNav />
    </div>
  );
};

export default RateListPage;
