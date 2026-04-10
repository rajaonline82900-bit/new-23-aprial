import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { CalendarIcon, Loader2, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminBetsTab = ({ games }) => {
  const [betDistribution, setBetDistribution] = useState(null);
  const [betDistDate, setBetDistDate] = useState(new Date());
  const [betDistGame, setBetDistGame] = useState('all');
  const [loadingBetDist, setLoadingBetDist] = useState(false);

  const fetchBetDistribution = useCallback(async () => {
    setLoadingBetDist(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/bet-distribution`, {
        params: { game_id: betDistGame, date: format(betDistDate, 'yyyy-MM-dd') },
        withCredentials: true
      });
      setBetDistribution(data);
    } catch (error) { toast.error('Bet distribution load नहीं हो पाया'); }
    finally { setLoadingBetDist(false); }
  }, [betDistDate, betDistGame]);

  useEffect(() => { fetchBetDistribution(); }, [fetchBetDistribution]);

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#D4AF37]" />बेट रिपोर्ट - कौन सी जोड़ी पर कितना लगा
          </CardTitle>
          <div className="flex gap-2">
            <Select value={betDistGame} onValueChange={setBetDistGame}>
              <SelectTrigger className="w-40 bg-[#0A0A0C] border-white/10 text-white"><SelectValue placeholder="सभी गेम्स" /></SelectTrigger>
              <SelectContent className="bg-[#141418] border-white/10">
                <SelectItem value="all" className="text-white hover:bg-white/10">सभी गेम्स</SelectItem>
                {games.map((game) => (
                  <SelectItem key={game.game_id} value={game.game_id} className="text-white hover:bg-white/10">{game.name_hi}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-[#0A0A0C] border-white/10 text-white">
                  <CalendarIcon className="mr-2 h-4 w-4" />{format(betDistDate, 'dd MMM')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#141418] border-white/10">
                <Calendar mode="single" selected={betDistDate} onSelect={(date) => date && setBetDistDate(date)} className="bg-[#141418]" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingBetDist ? (
          <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" /></div>
        ) : !betDistribution || Object.keys(betDistribution.distribution).length === 0 ? (
          <div className="text-center py-12">
            <PieChart className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">इस तारीख पर कोई पेंडिंग बेट नहीं</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-[#0A0A0C] rounded-lg text-center">
                <p className="text-gray-400 text-sm">कुल बेट्स</p>
                <p className="text-2xl font-bold text-white">{betDistribution.summary.total_bets}</p>
              </div>
              <div className="p-4 bg-emerald-500/10 rounded-lg text-center border border-emerald-500/30">
                <p className="text-gray-400 text-sm">कुल राशि</p>
                <p className="text-2xl font-bold text-emerald-400">₹{betDistribution.summary.total_bet_amount}</p>
              </div>
            </div>

            {Object.entries(betDistribution.distribution).map(([gameId, gameData]) => (
              <div key={gameId} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{gameData.game_name}</h3>
                  <span className="text-emerald-400 text-sm">राशि: ₹{gameData.total_amount}</span>
                </div>

                {Object.keys(gameData.jodi).length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-sm mb-2">जोड़ी बेट्स:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {Object.entries(gameData.jodi).map(([number, data]) => (
                        <div key={number} className="p-3 bg-[#0A0A0C] rounded-lg border border-white/10 hover:border-[#D4AF37]/50 transition-all">
                          <div className="text-center">
                            <span className="text-2xl font-bold text-[#D4AF37]">{number}</span>
                            <div className="mt-1">
                              <p className="text-white font-semibold">₹{data.amount}</p>
                              <p className="text-gray-400 text-xs">{data.count} बेट</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(gameData.haruf_andar || {}).length > 0 && (
                  <div className="mt-4">
                    <p className="text-blue-400 text-sm mb-2 font-semibold">हरूफ अंदर:</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {Object.entries(gameData.haruf_andar).map(([number, data]) => (
                        <div key={number} className="p-2 bg-[#0A0A0C] rounded-lg border border-blue-500/20 text-center">
                          <span className="text-xl font-bold text-blue-400">{number}</span>
                          <p className="text-white text-sm">₹{data.amount}</p>
                          <p className="text-gray-400 text-xs">{data.count} बेट</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(gameData.haruf_bahar || {}).length > 0 && (
                  <div className="mt-4">
                    <p className="text-orange-400 text-sm mb-2 font-semibold">हरूफ बाहर:</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {Object.entries(gameData.haruf_bahar).map(([number, data]) => (
                        <div key={number} className="p-2 bg-[#0A0A0C] rounded-lg border border-orange-500/20 text-center">
                          <span className="text-xl font-bold text-orange-400">{number}</span>
                          <p className="text-white text-sm">₹{data.amount}</p>
                          <p className="text-gray-400 text-xs">{data.count} बेट</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminBetsTab;
