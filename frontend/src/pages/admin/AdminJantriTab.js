import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminJantriTab = ({ games }) => {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [gameId, setGameId] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await axios.get(`${API_URL}/api/admin/jantri-report`, {
        params: { game_id: gameId, date },
        withCredentials: true
      });
      setData(res);
    } catch (error) { toast.error('Jantri report load नहीं हो पाया'); }
    finally { setLoading(false); }
  }, [date, gameId]);

  const handleReset = () => {
    setDate(today);
    setGameId('all');
    setData(null);
  };

  // Build jodi grid rows (10 rows x 10 cols)
  const jodiRows = [];
  for (let row = 0; row < 10; row++) {
    const cols = [];
    for (let col = 0; col < 10; col++) {
      const num = `${row}${col}`;
      cols.push(num);
    }
    jodiRows.push(cols);
  }

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <CardTitle className="text-white font-['Unbounded'] text-lg">Jantri Report (Bid History)</CardTitle>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-3">
          <div className="flex-1">
            <label className="text-gray-400 text-xs block mb-1">Select Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              data-testid="jantri-date-input"
              className="bg-[#0A0A0C] border-white/10 text-white" />
          </div>
          <div className="flex-1">
            <label className="text-gray-400 text-xs block mb-1">Market Name</label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger data-testid="jantri-game-select" className="bg-[#0A0A0C] border-white/10 text-white">
                <SelectValue placeholder="सभी गेम्स" />
              </SelectTrigger>
              <SelectContent className="bg-[#141418] border-white/10">
                <SelectItem value="all" className="text-white hover:bg-white/10">सभी गेम्स</SelectItem>
                {games.map((g) => (
                  <SelectItem key={g.game_id} value={g.game_id} className="text-white hover:bg-white/10">{g.name_hi}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={fetchReport} disabled={loading} data-testid="jantri-submit-btn"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-1" />Submit</>}
            </Button>
            <Button onClick={handleReset} variant="outline" data-testid="jantri-reset-btn"
              className="border-white/10 text-gray-300 hover:text-white">
              <RotateCcw className="w-4 h-4 mr-1" />Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!data ? (
          <p className="text-gray-400 text-center py-8">Date aur Game select karke Submit karein</p>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" /></div>
        ) : (
          <div className="space-y-6">
            {/* Jodi Grid (00-99) */}
            <div>
              <h3 className="text-white font-bold mb-3 text-base">Jodi (00-99)</h3>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {jodiRows.map((row, ri) => (
                    <div key={ri} className="grid grid-cols-10 gap-1 mb-1">
                      {row.map((num) => {
                        const amt = data.jodi?.[num] || 0;
                        return (
                          <div key={num} data-testid={`jodi-cell-${num}`}
                            className={`border rounded text-center py-1.5 px-1 transition-all ${
                              amt > 0
                                ? 'border-[#D4AF37]/60 bg-[#D4AF37]/10'
                                : 'border-white/10 bg-[#0A0A0C]'
                            }`}>
                            <p className="text-white font-bold text-sm leading-tight">{num}</p>
                            <p className={`text-xs font-medium leading-tight ${amt > 0 ? 'text-[#D4AF37]' : 'text-gray-500'}`}>{amt}</p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Andar Haruf (0-9) */}
            <div>
              <h3 className="text-white font-bold mb-3 text-base">Andar Haruf (0-9)</h3>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, i) => String(i)).map((num) => {
                  const amt = data.andar?.[num] || 0;
                  return (
                    <div key={num} data-testid={`andar-cell-${num}`}
                      className={`border rounded text-center py-2 transition-all ${
                        amt > 0 ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/10 bg-[#0A0A0C]'
                      }`}>
                      <p className="text-white font-bold text-sm">{num}</p>
                      <p className={`text-xs font-medium ${amt > 0 ? 'text-blue-400' : 'text-gray-500'}`}>{amt}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bahar Haruf (0-9) */}
            <div>
              <h3 className="text-white font-bold mb-3 text-base">Bahar Haruf (0-9)</h3>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, i) => String(i)).map((num) => {
                  const amt = data.bahar?.[num] || 0;
                  return (
                    <div key={num} data-testid={`bahar-cell-${num}`}
                      className={`border rounded text-center py-2 transition-all ${
                        amt > 0 ? 'border-orange-500/60 bg-orange-500/10' : 'border-white/10 bg-[#0A0A0C]'
                      }`}>
                      <p className="text-white font-bold text-sm">{num}</p>
                      <p className={`text-xs font-medium ${amt > 0 ? 'text-orange-400' : 'text-gray-500'}`}>{amt}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Crossing */}
            {data.crossing && Object.keys(data.crossing).length > 0 && (
              <div>
                <h3 className="text-white font-bold mb-3 text-base">Crossing</h3>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(data.crossing).map(([num, amt]) => (
                    <div key={num} className="border border-purple-500/60 bg-purple-500/10 rounded text-center py-2 px-3">
                      <p className="text-white font-bold text-sm">{num}</p>
                      <p className="text-purple-400 text-xs font-medium">{amt}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-[#0A0A0C] border border-white/10 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300 font-bold">Jantri (Jodi):</span>
                <span className="text-white font-bold">{data.summary?.jodi_total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 font-bold">Andar Haruf:</span>
                <span className="text-white font-bold">{data.summary?.andar_total || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 font-bold">Bahar Haruf:</span>
                <span className="text-white font-bold">{data.summary?.bahar_total || 0}</span>
              </div>
              {data.summary?.crossing_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-300 font-bold">Crossing:</span>
                  <span className="text-white font-bold">{data.summary.crossing_total}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-red-400 font-bold">Loss (Max Payout):</span>
                  <span className="text-red-400 font-bold">{data.summary?.max_loss || 0}</span>
                </div>
                {data.summary?.max_loss > 0 && (
                  <p className="text-gray-500 text-xs">Worst case jodi: {data.summary.worst_jodi}</p>
                )}
                <div className="flex justify-between mt-1">
                  <span className="text-emerald-400 font-bold">Profit:</span>
                  <span className={`font-bold ${(data.summary?.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data.summary?.profit || 0}</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-2">
                <div className="flex justify-between">
                  <span className="text-[#D4AF37] font-bold text-lg">Total:</span>
                  <span className="text-[#D4AF37] font-bold text-lg">{data.summary?.total || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminJantriTab;
