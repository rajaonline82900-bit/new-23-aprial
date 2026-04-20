import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Search, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const utcDate = (d) => { if (!d) return new Date(); const s = String(d); return new Date(s.endsWith('Z') ? s : s + 'Z'); };

const AdminWinnersTab = ({ games }) => {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [gameId, setGameId] = useState('all');
  const [winners, setWinners] = useState([]);
  const [totalWon, setTotalWon] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchWinners = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/winners`, {
        params: { date, game_id: gameId }, withCredentials: true
      });
      setWinners(data.winners || []);
      setTotalWon(data.total_won || 0);
    } catch (e) { toast.error('Load failed'); }
    finally { setLoading(false); }
  }, [date, gameId]);

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <CardTitle className="text-white font-['Unbounded'] text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#D4AF37]" /> Winners
        </CardTitle>
        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="winners-date"
            className="bg-[#0A0A0C] border-white/10 text-white flex-1" />
          <Select value={gameId} onValueChange={setGameId}>
            <SelectTrigger data-testid="winners-game-select" className="bg-[#0A0A0C] border-white/10 text-white flex-1">
              <SelectValue placeholder="सभी गेम्स" />
            </SelectTrigger>
            <SelectContent className="bg-[#141418] border-white/10">
              <SelectItem value="all" className="text-white">सभी गेम्स</SelectItem>
              {games.map((g) => (
                <SelectItem key={g.game_id} value={g.game_id} className="text-white">{g.name_hi}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={fetchWinners} disabled={loading} data-testid="winners-search-btn"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-1" /> Search</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {winners.length === 0 && !loading ? (
          <p className="text-gray-400 text-center py-8">Date select karke Search karein</p>
        ) : loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg">
              <span className="text-[#D4AF37] font-bold">Total Winners: {winners.length}</span>
              <span className="text-[#D4AF37] font-bold">Total Won: ₹{totalWon}</span>
            </div>
            <div className="space-y-2">
              {winners.map((w, i) => (
                <div key={i} className="p-3 bg-[#0A0A0C] rounded-lg border border-white/10 flex items-center justify-between"
                  data-testid={`winner-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{w.user_name}</p>
                      <p className="text-gray-400 text-xs">{w.user_phone}</p>
                      <p className="text-gray-500 text-xs">{w.game_id} | {w.bet_type} | No: {w.number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#D4AF37] font-bold">+₹{w.won_amount}</p>
                    <p className="text-gray-500 text-xs">Bet: ₹{w.amount}</p>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">WON</Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminWinnersTab;
