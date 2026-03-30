import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft, 
  Trophy,
  Calendar,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GAMES = [
  { id: 'delhi_bazaar', name: 'दिल्ली बाजार', color: 'text-red-400' },
  { id: 'shri_ganesh', name: 'श्री गणेश', color: 'text-orange-400' },
  { id: 'faridabad', name: 'फरीदाबाद', color: 'text-yellow-400' },
  { id: 'ghaziabad', name: 'गाजियाबाद', color: 'text-green-400' },
  { id: 'gali', name: 'गली', color: 'text-blue-400' },
  { id: 'disawar', name: 'दिसावर', color: 'text-purple-400' }
];

const JantriPage = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState('all');
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchResults();
  }, [selectedGame, days]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/results`, {
        params: { limit: days * 6 },
        withCredentials: true
      });
      
      // Group by date
      const grouped = {};
      data.results.forEach(result => {
        const date = result.date;
        if (!grouped[date]) {
          grouped[date] = {};
        }
        grouped[date][result.game_id] = {
          single: result.single_result,
          jodi: result.jodi_result
        };
      });
      
      // Convert to array
      const resultArray = Object.entries(grouped)
        .map(([date, games]) => ({ date, games }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, days);
      
      setResults(resultArray);
    } catch (error) {
      toast.error('जंत्री लोड नहीं हो पाई');
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = selectedGame === 'all' 
    ? GAMES 
    : GAMES.filter(g => g.id === selectedGame);

  return (
    <div className="min-h-screen bg-[#0A0A0C]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <button className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div className="flex items-center gap-2">
                <Calendar className="w-6 h-6 text-[#D4AF37]" />
                <h1 className="text-xl font-bold text-white font-['Unbounded']">जंत्री</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[150px]">
                <label className="text-gray-400 text-sm mb-2 block">गेम चुनें</label>
                <Select value={selectedGame} onValueChange={setSelectedGame}>
                  <SelectTrigger className="bg-[#0A0A0C] border-white/10 text-white">
                    <SelectValue placeholder="सभी गेम्स" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141418] border-white/10">
                    <SelectItem value="all" className="text-white hover:bg-white/10">सभी गेम्स</SelectItem>
                    {GAMES.map((game) => (
                      <SelectItem key={game.id} value={game.id} className="text-white hover:bg-white/10">
                        {game.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-gray-400 text-sm mb-2 block">समय अवधि</label>
                <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                  <SelectTrigger className="bg-[#0A0A0C] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141418] border-white/10">
                    <SelectItem value="7" className="text-white hover:bg-white/10">7 दिन</SelectItem>
                    <SelectItem value="15" className="text-white hover:bg-white/10">15 दिन</SelectItem>
                    <SelectItem value="30" className="text-white hover:bg-white/10">30 दिन</SelectItem>
                    <SelectItem value="60" className="text-white hover:bg-white/10">60 दिन</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jantri Table */}
        <Card className="bg-[#141418] border-white/10">
          <CardHeader>
            <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#D4AF37]" />
              रिजल्ट चार्ट
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">कोई रिजल्ट नहीं मिला</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-gray-400 font-medium sticky left-0 bg-[#141418]">
                        तारीख
                      </th>
                      {filteredGames.map((game) => (
                        <th key={game.id} className={`text-center p-3 font-medium min-w-[100px] ${game.color}`}>
                          {game.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, index) => (
                      <tr 
                        key={index} 
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-3 text-white font-medium sticky left-0 bg-[#141418]">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            {row.date}
                          </div>
                        </td>
                        {filteredGames.map((game) => (
                          <td key={game.id} className="text-center p-3">
                            {row.games[game.id] ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-3xl font-bold text-[#D4AF37] font-['Unbounded']">
                                  {row.games[game.id].jodi}
                                </span>
                                <Badge variant="outline" className="border-white/20 text-gray-400 text-xs">
                                  एकल: {row.games[game.id].single}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-gray-600 text-2xl">--</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Legend */}
        <Card className="bg-[#141418] border-white/10 mt-6">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm mb-3">गेम्स टाइमिंग:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="flex items-center gap-2 p-2 bg-[#0A0A0C] rounded-lg">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div>
                  <p className="text-white text-sm">दिल्ली बाजार</p>
                  <p className="text-gray-400 text-xs">3:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[#0A0A0C] rounded-lg">
                <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                <div>
                  <p className="text-white text-sm">श्री गणेश</p>
                  <p className="text-gray-400 text-xs">6:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[#0A0A0C] rounded-lg">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div>
                  <p className="text-white text-sm">फरीदाबाद</p>
                  <p className="text-gray-400 text-xs">6:15 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[#0A0A0C] rounded-lg">
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <div>
                  <p className="text-white text-sm">गाजियाबाद</p>
                  <p className="text-gray-400 text-xs">8:30 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[#0A0A0C] rounded-lg">
                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                <div>
                  <p className="text-white text-sm">गली</p>
                  <p className="text-gray-400 text-xs">11:30 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-[#0A0A0C] rounded-lg">
                <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                <div>
                  <p className="text-white text-sm">दिसावर</p>
                  <p className="text-gray-400 text-xs">5:00 AM</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default JantriPage;
