import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  ArrowLeft, 
  Trophy,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

import FooterNav from '../components/FooterNav';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ResultsPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/results`, { withCredentials: true });
      setResults(data.results);
    } catch (error) {
      toast.error('रिजल्ट्स लोड नहीं हो पाए');
    } finally {
      setLoading(false);
    }
  };

  // Group results by date
  const groupedResults = results.reduce((acc, result) => {
    const date = result.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(result);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <h1 className="text-xl font-bold text-white font-['Unbounded']">रिजल्ट्स</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : Object.keys(groupedResults).length === 0 ? (
          <Card className="bg-[#141418] border-white/10">
            <CardContent className="p-8 text-center">
              <Trophy className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">कोई रिजल्ट नहीं</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedResults).map(([date, dateResults]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="text-lg font-semibold text-white">{date}</h3>
                </div>
                
                <div className="grid gap-3">
                  {dateResults.map((result, index) => (
                    <Card 
                      key={index}
                      className="bg-[#141418] border-white/10"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] flex items-center justify-center border border-[#D4AF37]/30">
                              <Trophy className="w-6 h-6 text-[#D4AF37]" />
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-white">
                                {result.game_name_hi || result.game_id}
                              </h4>
                              <p className="text-gray-400 text-sm">
                                {result.game_name}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="text-gray-400 text-xs mb-1">जोड़ी</p>
                              <Badge className="bg-[#10B981]/20 text-[#10B981] text-xl px-3 py-1">
                                {result.jodi_result}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <FooterNav />
    </div>
  );
};

export default ResultsPage;
