import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Power, Loader2 } from 'lucide-react';
import { Switch } from '../../components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  {
    id: 'gali_disawar',
    label: 'Gali Disawar',
    hi: 'गली दिसावर',
    accent: '#D4AF37',
    desc: 'Delhi Bazaar, Gali, Disawar, Faridabad, Ghaziabad, etc.',
  },
  {
    id: 'kalyan',
    label: 'Kalyan',
    hi: 'कल्याण',
    accent: '#DC2626',
    desc: 'Milan Day/Night, Rajdhani, Kalyan, Time Bazaar, etc.',
  },
  {
    id: 'aviator',
    label: 'Aviator',
    hi: 'एविएटर',
    accent: '#0EA5E9',
    desc: 'Live crash-multiplier game with weighted RNG.',
  },
  {
    id: 'ludo',
    label: 'Ludo',
    hi: 'लूडो',
    accent: '#7C3AED',
    desc: 'Zupee-style 4-token Ludo with matchmaking + bots.',
  },
];

const AdminGameTogglesTab = () => {
  const [toggles, setToggles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  const fetchToggles = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/game-toggles`, { withCredentials: true });
      setToggles(data.toggles);
    } catch (e) {
      toast.error('Toggles load nahi hue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToggles();
  }, [fetchToggles]);

  const toggle = async (id, checked) => {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const nextToggles = { ...(toggles || {}), [id]: checked };
      const { data } = await axios.post(
        `${API_URL}/api/admin/game-toggles`,
        { toggles: nextToggles },
        { withCredentials: true }
      );
      setToggles(data.toggles);
      const cat = CATEGORIES.find((c) => c.id === id);
      toast.success(`${cat?.label || id} ${checked ? 'ON kar diya' : 'BAND kar diya'}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save nahi hua');
      // Refresh to actual server state on error
      fetchToggles();
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-game-toggles">
      <div className="rounded-xl p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30">
        <h3 className="text-yellow-300 font-black text-sm uppercase tracking-wider mb-1">
          Game On/Off Controls
        </h3>
        <p className="text-xs text-yellow-200/80 leading-snug">
          Kisi bhi game category ko yahan se turant ON/OFF kar sakte ho.
          Band karne par users us game me new bet ya table create nahi kar
          payenge — homepage pe icon click karne par bhi block ho jaayega.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {CATEGORIES.map((cat) => {
          const isOn = toggles?.[cat.id] ?? true;
          const isSaving = !!saving[cat.id];
          return (
            <div
              key={cat.id}
              data-testid={`game-toggle-row-${cat.id}`}
              className="rounded-2xl p-4 bg-[#141418] border transition-all"
              style={{
                borderColor: isOn ? `${cat.accent}55` : 'rgba(220,38,38,0.35)',
                boxShadow: isOn ? `0 4px 14px ${cat.accent}22` : '0 4px 14px rgba(220,38,38,0.10)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: `${cat.accent}22`, border: `1.5px solid ${cat.accent}` }}
                  >
                    <Power
                      className="w-5 h-5"
                      style={{ color: isOn ? cat.accent : '#DC2626' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-base">
                      {cat.label} <span className="text-xs text-gray-500 font-bold">• {cat.hi}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight">{cat.desc}</p>
                    <p className="text-[10px] font-black mt-0.5" style={{ color: isOn ? '#22C55E' : '#EF4444' }}>
                      {isOn ? '● LIVE — users play kar sakte hain' : '● BAND — users block ho jaayenge'}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  <Switch
                    checked={isOn}
                    onCheckedChange={(v) => toggle(cat.id, v)}
                    disabled={isSaving}
                    data-testid={`game-toggle-${cat.id}`}
                    className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminGameTogglesTab;
