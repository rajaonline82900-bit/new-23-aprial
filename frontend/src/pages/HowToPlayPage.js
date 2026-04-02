import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import FooterNav from '../components/FooterNav';

const HowToPlayPage = () => {
  const steps = [
    { title: 'रजिस्टर करें', desc: 'अपना अकाउंट बनाएं और लॉगिन करें' },
    { title: 'पैसे जमा करें', desc: 'वॉलेट में UPI से पैसे जमा करें (न्यूनतम ₹100)' },
    { title: 'गेम चुनें', desc: 'होम पेज से कोई भी गेम चुनें जिसमें "Play" दिख रहा हो' },
    { title: 'बेट लगाएं', desc: 'जंत्री (00-99 जोड़ी), हरूफ अंदर/बाहर (0-9), या क्रॉस बेट लगाएं' },
    { title: 'रिजल्ट देखें', desc: 'गेम टाइम के बाद रिजल्ट ऑटो अपडेट होगा' },
    { title: 'जीत की राशि', desc: 'जीतने पर पैसे ऑटो वॉलेट में आ जाएंगे' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0C] pb-20 app-shell">
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="px-3 py-3 flex items-center gap-3">
          <Link to="/dashboard">
            <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-white font-['Unbounded']">कैसे खेलें</h1>
        </div>
      </header>
      <main className="px-3 py-4 space-y-4">
        {steps.map((step, i) => (
          <Card key={i} className="bg-[#141418] border-white/10">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shrink-0">
                <span className="text-[#D4AF37] font-bold">{i + 1}</span>
              </div>
              <div>
                <p className="text-white font-semibold">{step.title}</p>
                <p className="text-gray-400 text-sm mt-1">{step.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
      <FooterNav />
    </div>
  );
};

export default HowToPlayPage;
