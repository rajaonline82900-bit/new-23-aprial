import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminSettingsTab = () => {
  const [telegramLink, setTelegramLink] = useState('');
  const [whatsappLink, setWhatsappLink] = useState('');
  const [withdrawalProofTelegram, setWithdrawalProofTelegram] = useState('');
  const [withdrawalStartTime, setWithdrawalStartTime] = useState('');
  const [withdrawalEndTime, setWithdrawalEndTime] = useState('');
  const [minBetJodi, setMinBetJodi] = useState(10);
  const [minBetHaruf, setMinBetHaruf] = useState(10);
  const [minBetCrossing, setMinBetCrossing] = useState(10);
  const [minDeposit, setMinDeposit] = useState(100);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/settings`, { withCredentials: true });
      setTelegramLink(data.telegram_link || ''); setWhatsappLink(data.whatsapp_link || '');
      setWithdrawalProofTelegram(data.withdrawal_proof_telegram || '');
      setWithdrawalStartTime(data.withdrawal_start_time || ''); setWithdrawalEndTime(data.withdrawal_end_time || '');
      setMinBetJodi(data.min_bet_jodi || 10); setMinBetHaruf(data.min_bet_haruf || 10); setMinBetCrossing(data.min_bet_crossing || 10);
      setMinDeposit(data.min_deposit || 100); setMinWithdrawal(data.min_withdrawal || 100);
    } catch (error) {}
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API_URL}/api/admin/settings`, {
        telegram_link: telegramLink, whatsapp_link: whatsappLink, withdrawal_proof_telegram: withdrawalProofTelegram,
        withdrawal_start_time: withdrawalStartTime, withdrawal_end_time: withdrawalEndTime,
        min_bet_jodi: parseInt(minBetJodi) || 10, min_bet_haruf: parseInt(minBetHaruf) || 10, min_bet_crossing: parseInt(minBetCrossing) || 10,
        min_deposit: parseInt(minDeposit) || 100, min_withdrawal: parseInt(minWithdrawal) || 100
      }, { withCredentials: true });
      toast.success('Settings saved!');
    } catch (error) { toast.error('Settings save नहीं हो पाई'); }
    finally { setSavingSettings(false); }
  };

  return (
    <Card className="bg-[#141418] border-white/10">
      <CardHeader>
        <CardTitle className="text-white font-['Unbounded']">ऐप सेटिंग्स</CardTitle>
        <CardDescription className="text-gray-400">Telegram और WhatsApp लिंक सेट करें</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-gray-300 mb-2 block">Telegram Channel/Group Link</Label>
          <Input type="url" placeholder="https://t.me/yourchannel" value={telegramLink} onChange={(e) => setTelegramLink(e.target.value)} data-testid="settings-telegram-link" className="bg-[#0A0A0C] border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-gray-300 mb-2 block">WhatsApp Group Link</Label>
          <Input type="url" placeholder="https://chat.whatsapp.com/..." value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} data-testid="settings-whatsapp-link" className="bg-[#0A0A0C] border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-gray-300 mb-2 block">Withdrawal Proof Telegram Link</Label>
          <Input type="url" placeholder="https://t.me/withdrawal_proofs" value={withdrawalProofTelegram} onChange={(e) => setWithdrawalProofTelegram(e.target.value)} data-testid="settings-withdrawal-proof" className="bg-[#0A0A0C] border-white/10 text-white" />
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-white font-bold mb-3">निकासी समय (Withdrawal Time)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 mb-2 block">शुरू (Start)</Label>
              <Input type="time" value={withdrawalStartTime} onChange={(e) => setWithdrawalStartTime(e.target.value)} data-testid="settings-withdrawal-start" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">खत्म (End)</Label>
              <Input type="time" value={withdrawalEndTime} onChange={(e) => setWithdrawalEndTime(e.target.value)} data-testid="settings-withdrawal-end" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-1">खाली छोड़ने पर 24 घंटे निकासी उपलब्ध रहेगी</p>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-white font-bold mb-3">न्यूनतम बेट राशि</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-300 mb-2 block">जोड़ी (₹)</Label>
              <Input type="number" value={minBetJodi} onChange={(e) => setMinBetJodi(e.target.value)} data-testid="settings-min-bet-jodi" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">हरूफ (₹)</Label>
              <Input type="number" value={minBetHaruf} onChange={(e) => setMinBetHaruf(e.target.value)} data-testid="settings-min-bet-haruf" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">क्रॉसिंग (₹)</Label>
              <Input type="number" value={minBetCrossing} onChange={(e) => setMinBetCrossing(e.target.value)} data-testid="settings-min-bet-crossing" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h3 className="text-white font-bold mb-3">न्यूनतम जमा / निकासी</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 mb-2 block">न्यूनतम जमा (₹)</Label>
              <Input type="number" value={minDeposit} onChange={(e) => setMinDeposit(e.target.value)} data-testid="settings-min-deposit" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-gray-300 mb-2 block">न्यूनतम निकासी (₹)</Label>
              <Input type="number" value={minWithdrawal} onChange={(e) => setMinWithdrawal(e.target.value)} data-testid="settings-min-withdrawal" className="bg-[#0A0A0C] border-white/10 text-white" />
            </div>
          </div>
        </div>

        <Button onClick={handleSaveSettings} disabled={savingSettings} data-testid="save-settings-button" className="bg-[#D4AF37] hover:bg-[#FDE047] text-black font-bold">
          {savingSettings ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> सेव हो रहा है...</span>
            : <span className="flex items-center gap-2"><Save className="w-4 h-4" /> सेव करें</span>}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminSettingsTab;
