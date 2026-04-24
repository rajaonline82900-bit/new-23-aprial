import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Settings, Plus, Clock, Edit, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminGamesTab = () => {
  const [games, setGames] = useState([]);
  const [editingGame, setEditingGame] = useState(null);
  const [gameFormOpen, setGameFormOpen] = useState(false);
  const [gameForm, setGameForm] = useState({ game_id: '', name: '', name_hi: '', category: 'gali_disawar', start_time: '', end_time: '', display_time: '', is_active: true });
  const [savingGame, setSavingGame] = useState(false);
  const [seedingKalyan, setSeedingKalyan] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/games`, { withCredentials: true });
      setGames(data.games);
    } catch (error) { toast.error('Games load नहीं हो पाए'); }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const openGameForm = (game = null) => {
    if (game) {
      setEditingGame(game.game_id);
      setGameForm({ game_id: game.game_id, name: game.name, name_hi: game.name_hi, category: game.category || 'gali_disawar', start_time: game.start_time || '', end_time: game.end_time || game.time || '', display_time: game.display_time, is_active: game.is_active !== false });
    } else {
      setEditingGame(null);
      setGameForm({ game_id: '', name: '', name_hi: '', category: 'gali_disawar', start_time: '', end_time: '', display_time: '', is_active: true });
    }
    setGameFormOpen(true);
  };

  const handleSaveGame = async () => {
    if (!gameForm.name || !gameForm.name_hi || !gameForm.start_time || !gameForm.end_time) { toast.error('सभी required fields भरें'); return; }
    setSavingGame(true);
    try {
      const payload = {
        name: gameForm.name, name_hi: gameForm.name_hi, category: gameForm.category,
        start_time: gameForm.start_time, end_time: gameForm.end_time,
        display_time: gameForm.display_time, is_active: gameForm.is_active
      };
      if (editingGame) {
        await axios.put(`${API_URL}/api/admin/games/${editingGame}`, payload, { withCredentials: true });
        toast.success('Game updated successfully');
      } else {
        await axios.post(`${API_URL}/api/admin/games`, { game_id: gameForm.game_id, ...payload }, { withCredentials: true });
        toast.success('Game created successfully');
      }
      setGameFormOpen(false); fetchGames();
    } catch (error) { toast.error(error.response?.data?.detail || 'Save failed'); }
    finally { setSavingGame(false); }
  };

  const handleSeedKalyan = async () => {
    if (!window.confirm('Default Kalyan games (7 games) add karein? Already present games skip ho jayenge.')) return;
    setSeedingKalyan(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/admin/games/seed-kalyan`, {}, { withCredentials: true });
      toast.success(data.message || 'Kalyan games seeded');
      fetchGames();
    } catch (error) { toast.error(error.response?.data?.detail || 'Seed failed'); }
    finally { setSeedingKalyan(false); }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('क्या आप वाकई इस game को delete करना चाहते हैं?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/games/${gameId}`, { withCredentials: true });
      toast.success('Game deleted'); fetchGames();
    } catch (error) { toast.error('Delete failed'); }
  };

  return (
    <>
      <Card className="bg-[#141418] border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-['Unbounded'] flex items-center gap-2"><Settings className="w-5 h-5 text-[#D4AF37]" />गेम सेटिंग्स</CardTitle>
            <Button onClick={() => openGameForm()} className="bg-[#D4AF37] hover:bg-[#FDE047] text-black" data-testid="add-game-btn"><Plus className="w-4 h-4 mr-2" />नया गेम</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {games.map((game, index) => (
              <div key={index} className={`flex items-center justify-between p-4 bg-[#0A0A0C] rounded-lg border ${game.is_active !== false ? 'border-white/10' : 'border-red-500/30 opacity-60'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#141418] flex items-center justify-center border border-[#D4AF37]/30">
                    <Clock className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-white">{game.name_hi}</h4>
                      {game.is_active === false && <Badge className="bg-red-500/20 text-red-400">बंद</Badge>}
                    </div>
                    <p className="text-gray-400 text-sm">{game.name}</p>
                    <p className="text-gray-400 text-xs">ID: {game.game_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[#D4AF37] font-bold text-lg">{game.display_time}</p>
                    <p className="text-gray-400 text-sm">{game.start_time || '--:--'} - {game.end_time || game.time || '--:--'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openGameForm(game)} className="border-white/10 text-gray-300 hover:bg-white/10"><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteGame(game.game_id)} className="border-red-500/50 text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={gameFormOpen} onOpenChange={setGameFormOpen}>
        <DialogContent className="bg-[#141418] border-white/10 text-white max-w-md">
          <DialogHeader><DialogTitle className="font-['Unbounded']">{editingGame ? 'गेम एडिट करें' : 'नया गेम बनाएं'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editingGame && (
              <div>
                <Label className="text-gray-300 mb-2 block">Game ID (unique)</Label>
                <Input type="text" placeholder="जैसे: mumbai_night" value={gameForm.game_id}
                  onChange={(e) => setGameForm({...gameForm, game_id: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                  className="bg-[#0A0A0C] border-white/10 text-white" />
              </div>
            )}
            <div>
              <Label className="text-gray-300 mb-2 block">Category</Label>
              <select
                value={gameForm.category}
                onChange={(e) => setGameForm({...gameForm, category: e.target.value})}
                data-testid="game-category-select"
                className="w-full bg-[#0A0A0C] border border-white/10 rounded-md text-white h-10 px-3"
              >
                <option value="gali_disawar">Gali / Disawar</option>
                <option value="kalyan">Kalyan</option>
              </select>
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">Game Name (English)</Label>
              <Input type="text" placeholder="Mumbai Night" value={gameForm.name} onChange={(e) => setGameForm({...gameForm, name: e.target.value})} className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">Game Name (Hindi)</Label>
              <Input type="text" placeholder="मुंबई नाइट" value={gameForm.name_hi} onChange={(e) => setGameForm({...gameForm, name_hi: e.target.value})} className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300 mb-2 block">Start Time (24hr)</Label>
                <Input type="time" value={gameForm.start_time} onChange={(e) => setGameForm({...gameForm, start_time: e.target.value})} data-testid="game-start-time-input" className="bg-[#0A0A0C] border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">End Time (24hr)</Label>
                <Input type="time" value={gameForm.end_time} onChange={(e) => setGameForm({...gameForm, end_time: e.target.value})} data-testid="game-end-time-input" className="bg-[#0A0A0C] border-white/10 text-white" />
              </div>
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">Display Time</Label>
              <Input type="text" placeholder="3:00 PM" value={gameForm.display_time} onChange={(e) => setGameForm({...gameForm, display_time: e.target.value})} data-testid="game-display-time-input" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div className="flex items-center gap-3 p-3 bg-[#0A0A0C] rounded-lg">
              <input type="checkbox" id="is_active" checked={gameForm.is_active} onChange={(e) => setGameForm({...gameForm, is_active: e.target.checked})} className="w-5 h-5 rounded border-white/10 bg-[#0A0A0C]" />
              <Label htmlFor="is_active" className="text-gray-300">Game Active है</Label>
            </div>
            <Button onClick={handleSaveGame} disabled={savingGame} className="w-full bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
              {savingGame ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />{editingGame ? 'Update करें' : 'बनाएं'}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminGamesTab;
