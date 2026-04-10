import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Trophy, CalendarIcon, Loader2, RefreshCw, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminResultsTab = ({ games }) => {
  const [selectedGame, setSelectedGame] = useState('');
  const [resultDate, setResultDate] = useState(new Date());
  const [jodiResult, setJodiResult] = useState('');
  const [declaring, setDeclaring] = useState(false);
  const [todayResults, setTodayResults] = useState({ date: '', games: [] });
  const [reversingResult, setReversingResult] = useState(false);
  const [reversingBets, setReversingBets] = useState(false);
  const [reverseBetType, setReverseBetType] = useState('all');

  const fetchTodayResults = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/results/status`, { withCredentials: true });
      setTodayResults(data);
    } catch (error) {}
  }, []);

  useEffect(() => { fetchTodayResults(); }, [fetchTodayResults]);

  const handleDeclareResult = async () => {
    if (!selectedGame) { toast.error('कृपया गेम चुनें'); return; }
    if (!jodiResult || !jodiResult.match(/^[0-9]{2}$/)) { toast.error('जोड़ी रिजल्ट 00-99 होना चाहिए'); return; }
    setDeclaring(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/admin/results`, {
        game_id: selectedGame, date: format(resultDate, 'yyyy-MM-dd'), jodi_result: jodiResult
      }, { withCredentials: true });
      toast.success(`रिजल्ट घोषित! ${data.winners.jodi} जोड़ी विजेता`);
      setSelectedGame(''); setJodiResult(''); fetchTodayResults();
    } catch (error) { toast.error(error.response?.data?.detail || 'रिजल्ट घोषित नहीं हो पाया'); }
    finally { setDeclaring(false); }
  };

  const handleReverseResult = async () => {
    if (!selectedGame) { toast.error('गेम चुनें'); return; }
    if (!window.confirm(`क्या आप ${selectedGame} का ${format(resultDate, 'yyyy-MM-dd')} का रिजल्ट रिवर्स करना चाहते हैं?`)) return;
    setReversingResult(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/admin/results/reverse`, {
        game_id: selectedGame, date: format(resultDate, 'yyyy-MM-dd')
      }, { withCredentials: true });
      toast.success(`${data.message} | जीत कटी: ₹${data.winnings_deducted}`);
      fetchTodayResults();
    } catch (error) { toast.error(error.response?.data?.detail || 'रिजल्ट रिवर्स नहीं हो पाया'); }
    finally { setReversingResult(false); }
  };

  const handleReverseBets = async () => {
    if (!selectedGame) { toast.error('गेम चुनें'); return; }
    if (!window.confirm(`क्या आप ${selectedGame} की बेट्स रिवर्स करना चाहते हैं?`)) return;
    setReversingBets(true);
    try {
      const payload = { game_id: selectedGame, date: format(resultDate, 'yyyy-MM-dd') };
      if (reverseBetType !== 'all') payload.bet_type = reverseBetType;
      const { data } = await axios.post(`${API_URL}/api/admin/bets/reverse`, payload, { withCredentials: true });
      toast.success(`${data.message} | वापसी: ₹${data.amount_refunded}`);
      fetchTodayResults();
    } catch (error) { toast.error(error.response?.data?.detail || 'बेट्स रिवर्स नहीं हो पाईं'); }
    finally { setReversingBets(false); }
  };

  return (
    <>
      {todayResults.games.length > 0 && (
        <Card className="bg-[#141418] border-white/10 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-white font-['Unbounded'] text-base">आज के रिजल्ट ({todayResults.date})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayResults.games.map((g) => (
                <div key={g.game_id} className={`flex items-center justify-between p-3 rounded-lg border ${g.declared ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0A0A0C] border-white/5'}`} data-testid={`result-status-${g.game_id}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${g.declared ? 'bg-emerald-500' : 'bg-gray-600'}`}></div>
                    <div>
                      <p className="text-white font-medium text-sm">{g.name_hi}</p>
                      <p className="text-gray-500 text-xs">{g.start_time} - {g.end_time} | बेट्स: {g.total_bets}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {g.declared ? (
                      <span className="text-emerald-400 font-bold text-lg">{g.jodi_result}</span>
                    ) : (
                      <span className="text-gray-500 text-sm">{g.pending_bets > 0 ? `${g.pending_bets} pending` : 'कोई बेट नहीं'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#141418] border-[#D4AF37]/20 mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold">ऑटो रिजल्ट</h3>
              <p className="text-gray-400 text-sm">API से रिजल्ट ऑटो फेच होते हैं (हर 5 मिनट)</p>
            </div>
            <Button
              onClick={async () => {
                try {
                  const { data } = await axios.post(`${API_URL}/api/admin/results/auto-fetch`, {}, { withCredentials: true });
                  if (data.total > 0) { toast.success(`${data.total} नए रिजल्ट डिक्लेयर हुए!`); fetchTodayResults(); }
                  else { toast.info('कोई नया रिजल्ट नहीं मिला'); }
                } catch (error) { toast.error(error.response?.data?.detail || 'फेच विफल'); }
              }}
              data-testid="auto-fetch-btn"
              className="bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />अभी फेच करें
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#141418] border-white/10">
        <CardHeader><CardTitle className="text-white font-['Unbounded']">नया रिजल्ट घोषित करें</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 mb-2 block">गेम चुनें</Label>
              <Select value={selectedGame} onValueChange={setSelectedGame}>
                <SelectTrigger data-testid="admin-game-select" className="bg-[#0A0A0C] border-white/10 text-white"><SelectValue placeholder="गेम चुनें" /></SelectTrigger>
                <SelectContent className="bg-[#141418] border-white/10">
                  {games.filter(g => g.is_active !== false).map((game) => (
                    <SelectItem key={game.game_id} value={game.game_id} className="text-white hover:bg-white/10">{game.name_hi}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">तारीख</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="admin-date-picker" className="w-full justify-start text-left bg-[#0A0A0C] border-white/10 text-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(resultDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#141418] border-white/10">
                  <Calendar mode="single" selected={resultDate} onSelect={(date) => date && setResultDate(date)} className="bg-[#141418]" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label className="text-gray-300 mb-2 block">जोड़ी रिजल्ट (00-99)</Label>
            <Input type="text" maxLength={2} placeholder="00-99" value={jodiResult}
              onChange={(e) => setJodiResult(e.target.value.replace(/[^0-9]/g, ''))}
              data-testid="admin-jodi-result-input" className="bg-[#0A0A0C] border-white/10 text-white text-center text-4xl h-20 font-bold" />
            <p className="text-gray-400 text-sm mt-2">रिजल्ट जोड़ी नंबर (00-99) दर्ज करें</p>
          </div>

          <Button onClick={handleDeclareResult} disabled={declaring} data-testid="admin-declare-result-button" className="w-full h-12 bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
            {declaring ? <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />रिजल्ट घोषित हो रहा है...</span>
              : <span className="flex items-center gap-2"><Trophy className="w-5 h-5" />रिजल्ट घोषित करें</span>}
          </Button>

          <div className="border-t border-white/10 pt-4 mt-4">
            <p className="text-red-400 font-semibold mb-3">रिवर्स ऑप्शन</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Button onClick={handleReverseResult} disabled={reversingResult || !selectedGame} data-testid="admin-reverse-result-button" variant="outline" className="h-12 border-red-500/50 text-red-400 hover:bg-red-500/10">
                {reversingResult ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />रिवर्स हो रहा है...</span>
                  : <span className="flex items-center gap-2"><RotateCcw className="w-4 h-4" />रिजल्ट रिवर्स</span>}
              </Button>
              <Button onClick={handleReverseBets} disabled={reversingBets || !selectedGame} data-testid="admin-reverse-bets-button" variant="outline" className="h-12 border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                {reversingBets ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />रिवर्स हो रहा है...</span>
                  : <span className="flex items-center gap-2"><Undo2 className="w-4 h-4" />बेट रिवर्स</span>}
              </Button>
            </div>
            <div className="mt-3">
              <Label className="text-gray-400 text-sm mb-2 block">बेट रिवर्स फ़िल्टर (बेट टाइप)</Label>
              <div className="flex flex-wrap gap-2">
                {[{ value: 'all', label: 'सभी' }, { value: 'jodi', label: 'जोड़ी' }, { value: 'haruf_andar', label: 'हरूफ अंदर' }, { value: 'haruf_bahar', label: 'हरूफ बाहर' }].map((opt) => (
                  <button key={opt.value} onClick={() => setReverseBetType(opt.value)} data-testid={`reverse-filter-${opt.value}`}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${reverseBetType === opt.value ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400' : 'bg-[#0A0A0C] text-gray-400 border border-white/10 hover:border-orange-500/30'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-3">रिजल्ट रिवर्स: रिजल्ट हटाएगा, जीती राशि काटेगा, बेट्स pending करेगा। बेट रिवर्स: बेट राशि user को वापस करेगा।</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default AdminResultsTab;
