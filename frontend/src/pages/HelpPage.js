import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { HelpCircle, MessageSquare, Clock } from 'lucide-react';
import FooterNav from '../components/FooterNav';

const API = process.env.REACT_APP_BACKEND_URL;

const HelpPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const token = document.cookie.match(/access_token=([^;]+)/)?.[1] || localStorage.getItem('matka11_token');
      const res = await axios.get(`${API}/api/help/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] app-shell relative overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0A0A0C]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#D4AF37]/[0.04] rounded-full blur-[120px]" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0C] border-b border-white/10" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="px-4 py-3 flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-[#D4AF37]" />
          <h1 className="text-lg font-bold text-white font-['Unbounded']">Help</h1>
        </div>
      </header>

      <main className="px-3 pt-16 pb-24" data-testid="help-page">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-[#141418] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">कोई मैसेज नहीं है</p>
            <p className="text-gray-600 text-xs mt-1">Admin जब मैसेज भेजेगा, यहाँ दिखेगा</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <Card key={msg.id} className="bg-[#141418] border-white/10" data-testid={`help-msg-${msg.id}`}>
                <CardContent className="p-4">
                  <h3 className="text-[#D4AF37] font-bold text-sm mb-1">{msg.title}</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{msg.message}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-gray-600" />
                    <p className="text-gray-600 text-[10px]">{formatDate(msg.created_at)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <FooterNav />
    </div>
  );
};

export default HelpPage;
