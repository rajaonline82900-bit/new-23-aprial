import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Wallet as WalletIcon, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;
const CHIPS = [20, 50, 100, 500];
const MAX_STEP = 25;
const MULTIPLIERS = [
  1.00, 1.01, 1.10, 1.24, 1.40, 1.58, 1.79,
  2.02, 2.28, 2.58, 2.92, 3.30, 3.73,
  4.21, 4.76, 5.38, 6.08, 6.87, 7.77,
  8.79, 9.93, 11.22, 12.68, 14.33, 16.19,
  18.29, 20.67,
];

const DIFFICULTY = ['Easy', 'Medium', 'Hard'];
const VISIBLE_ZONES = 5; // manholes shown ahead

// Cartoon chicken SVG — round white body, red comb, yellow beak, big eyes
const ChickenSVG = ({ dying = false }) => (
  <svg viewBox="0 0 120 130" width="100%" height="100%" style={{ overflow: 'visible' }}>
    <defs>
      <radialGradient id="chBody" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="70%" stopColor="#F3F4F6" />
        <stop offset="100%" stopColor="#D1D5DB" />
      </radialGradient>
      <radialGradient id="chEye" cx="35%" cy="30%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#FEF3C7" />
      </radialGradient>
    </defs>
    <g style={dying ? { transformOrigin: '60px 100px' } : {}}>
      {/* Body — big round white */}
      <ellipse cx="60" cy="85" rx="45" ry="42" fill="url(#chBody)" stroke="#0F172A" strokeWidth="2.5" />
      {/* Wing */}
      <path d="M35 80 Q30 75 32 90 Q35 105 45 100 Q42 90 35 80 Z" fill="#E5E7EB" stroke="#0F172A" strokeWidth="2" />
      {/* Head */}
      <circle cx="60" cy="42" r="30" fill="url(#chBody)" stroke="#0F172A" strokeWidth="2.5" />
      {/* Red comb (3-bumps crest) */}
      <path d="M42 22 Q46 10 52 20 Q56 8 62 20 Q68 8 74 20 Q78 12 78 26 L48 26 Z"
            fill="#DC2626" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Wattle under beak */}
      <path d="M56 58 Q58 68 62 62 Q60 68 66 62 Z" fill="#DC2626" stroke="#0F172A" strokeWidth="1.5" />
      {/* Big eyes */}
      <circle cx="48" cy="42" r="9" fill="url(#chEye)" stroke="#0F172A" strokeWidth="2" />
      <circle cx="72" cy="42" r="9" fill="url(#chEye)" stroke="#0F172A" strokeWidth="2" />
      {/* Pupils */}
      <circle cx="49" cy="43" r="4" fill="#0F172A" />
      <circle cx="73" cy="43" r="4" fill="#0F172A" />
      <circle cx="50.5" cy="41.5" r="1.2" fill="#FFF" />
      <circle cx="74.5" cy="41.5" r="1.2" fill="#FFF" />
      {/* Beak (yellow triangle) */}
      <path d="M55 52 L65 52 L60 60 Z" fill="#FBBF24" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Legs */}
      <g>
        <line x1="52" y1="122" x2="52" y2="128" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
        <line x1="68" y1="122" x2="68" y2="128" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
        {/* Feet */}
        <path d="M46 128 L52 128 L58 128" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M62 128 L68 128 L74 128" stroke="#F59E0B" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </g>
  </svg>
);

// Manhole cover with multiplier text
const Manhole = ({ multiplier, size = 96, highlighted = false }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <radialGradient id={`mhBg-${multiplier}`} cx="50%" cy="45%">
          <stop offset="0%" stopColor={highlighted ? '#78716C' : '#57534E'} />
          <stop offset="70%" stopColor={highlighted ? '#57534E' : '#3F3F46'} />
          <stop offset="100%" stopColor="#27272A" />
        </radialGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="50" cy="94" rx="42" ry="4" fill="rgba(0,0,0,0.4)" />
      {/* Outer ring */}
      <circle cx="50" cy="50" r="46" fill={`url(#mhBg-${multiplier})`} stroke="#18181B" strokeWidth="2.5" />
      {/* Inner ring */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="#18181B" strokeWidth="1.5" opacity="0.7" />
      {/* Ridges */}
      {[...Array(14)].map((_, i) => {
        const angle = (i * 360) / 14;
        const rad = (angle * Math.PI) / 180;
        const x1 = 50 + 30 * Math.cos(rad);
        const y1 = 50 + 30 * Math.sin(rad);
        const x2 = 50 + 42 * Math.cos(rad);
        const y2 = 50 + 42 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#18181B" strokeWidth="2" opacity="0.6" />;
      })}
      {/* Vertical bars center pattern */}
      {[...Array(5)].map((_, i) => (
        <rect key={i} x={35 + i * 6} y="34" width="3" height="32" fill="#18181B" opacity="0.55" rx="1" />
      ))}
    </svg>
    {/* Multiplier text overlay */}
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="font-black tabular-nums" style={{
        fontSize: size * 0.28,
        color: highlighted ? '#FDE047' : '#FFFFFF',
        textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6)',
        fontFamily: 'Outfit, sans-serif',
      }}>{multiplier.toFixed(2)}x</span>
    </div>
  </div>
);

// Red fire truck (top-down view)
const FireTruck = ({ size = 88 }) => (
  <svg viewBox="0 0 100 200" width={size} height={size * 2} style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))' }}>
    {/* Truck bed (red body) */}
    <rect x="10" y="10" width="80" height="180" rx="8" fill="#DC2626" stroke="#7F1D1D" strokeWidth="2.5" />
    {/* Cab (front, blue windshield) */}
    <rect x="14" y="140" width="72" height="42" rx="6" fill="#1E3A8A" stroke="#0F172A" strokeWidth="2" opacity="0.9" />
    {/* Windshield split lines */}
    <line x1="50" y1="140" x2="50" y2="182" stroke="#FEF3C7" strokeWidth="2" opacity="0.4" />
    {/* Ladder (silver segments) */}
    <rect x="30" y="20" width="40" height="110" rx="2" fill="#D1D5DB" stroke="#4B5563" strokeWidth="1.5" />
    {[...Array(9)].map((_, i) => (
      <line key={i} x1="30" y1={25 + i * 12} x2="70" y2={25 + i * 12} stroke="#4B5563" strokeWidth="2" />
    ))}
    <line x1="46" y1="20" x2="46" y2="130" stroke="#9CA3AF" strokeWidth="1" />
    <line x1="54" y1="20" x2="54" y2="130" stroke="#9CA3AF" strokeWidth="1" />
    {/* Headlights (front, bottom) */}
    <circle cx="24" cy="186" r="4" fill="#FDE047" stroke="#0F172A" strokeWidth="1" />
    <circle cx="76" cy="186" r="4" fill="#FDE047" stroke="#0F172A" strokeWidth="1" />
    <rect x="46" y="184" width="8" height="6" fill="#F3F4F6" stroke="#0F172A" strokeWidth="1" />
    {/* Rear lights */}
    <circle cx="24" cy="14" r="3" fill="#F97316" stroke="#0F172A" strokeWidth="0.8" />
    <circle cx="76" cy="14" r="3" fill="#F97316" stroke="#0F172A" strokeWidth="0.8" />
    {/* Side stripe */}
    <rect x="10" y="94" width="80" height="6" fill="#FEF3C7" opacity="0.35" />
  </svg>
);

// Streetlight (top-down)
const StreetLight = () => (
  <svg viewBox="0 0 60 100" width="46" height="80" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.5))' }}>
    <rect x="26" y="30" width="8" height="60" fill="#525252" stroke="#18181B" strokeWidth="1.5" rx="1" />
    <rect x="8" y="20" width="44" height="18" rx="4" fill="#404040" stroke="#18181B" strokeWidth="2" />
    <ellipse cx="30" cy="92" rx="14" ry="4" fill="#27272A" />
    <circle cx="30" cy="14" r="8" fill="#FDE047" opacity="0.8" />
  </svg>
);

const ChickenRoadPage = () => {
  const { user, refreshUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [betAmount, setBetAmount] = useState(100);
  const [difficulty, setDifficulty] = useState('Easy');
  const [showDiff, setShowDiff] = useState(false);
  const [game, setGame] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [liveFeed, setLiveFeed] = useState([]);
  const [crashFlash, setCrashFlash] = useState(null);

  const token = localStorage.getItem('matka11_token') || '';
  const authH = { headers: { Authorization: `Bearer ${token}` } };

  const fetchConfig = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/chicken-road/config`); setConfig(r.data); } catch (e) { /* noop */ }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/chicken-road/active`, authH);
      if (r.data.active) setGame(r.data.active);
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/chicken-road/history?limit=20`, authH);
      setHistory(r.data.games || []);
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchFeed = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/chicken-road/live-feed?limit=6`); setLiveFeed(r.data.feed || []); } catch (e) { /* noop */ }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchActive();
    fetchHistory();
    fetchFeed();
    const iv = setInterval(fetchFeed, 4000);
    return () => clearInterval(iv);
  }, [fetchConfig, fetchActive, fetchHistory, fetchFeed]);

  const startGame = async () => {
    if (busy || game) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/chicken-road/start`, { amount: betAmount }, authH);
      setGame(r.data);
      setCrashFlash(null);
      refreshUser();
      toast.success(`🐔 ₹${betAmount} — cross karo!`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Start failed');
    }
    setBusy(false);
  };

  const stepGame = async () => {
    if (busy || !game) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/chicken-road/step`, {}, authH);
      if (r.data.crashed) {
        setCrashFlash({ step: r.data.step });
        toast.error(`💥 CRASH! ₹${game.bet} lost`);
        setGame(null);
        fetchHistory(); fetchFeed();
        setTimeout(() => setCrashFlash(null), 2400);
      } else {
        setGame((g) => ({ ...g, current_step: r.data.step, multiplier: r.data.multiplier }));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Step failed');
    }
    setBusy(false);
  };

  const cashout = async () => {
    if (busy || !game) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/chicken-road/cashout`, {}, authH);
      toast.success(`🏆 ${r.data.multiplier.toFixed(2)}x = ₹${Math.floor(r.data.payout)}!`);
      setGame(null);
      refreshUser();
      fetchHistory(); fetchFeed();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cashout failed');
    }
    setBusy(false);
  };

  const isActive = !!game;
  const step = game?.current_step || 0;
  const currentMult = MULTIPLIERS[step] || 1.0;
  const nextMult = MULTIPLIERS[step + 1] || MULTIPLIERS[MAX_STEP];
  const minBet = config?.min_bet || 50;
  const balance = Math.floor(user?.balance || 0);

  const setMin = () => setBetAmount(minBet);
  const setMax = () => setBetAmount(Math.max(minBet, balance));

  return (
    <div className="min-h-screen" style={{ background: '#0F0F1A' }} data-testid="chicken-road-page">
      <style>{`
        @keyframes cr-chicken-hop { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) rotate(-2deg) } }
        @keyframes cr-chicken-die { 0% { transform: rotate(0deg) scale(1); opacity:1 } 40% { transform: rotate(120deg) scale(1.3); opacity:1 } 100% { transform: rotate(360deg) scale(0.5); opacity:0.2 } }
        @keyframes cr-truck-drive { 0% { transform: translateY(-140%) } 45% { transform: translateY(0%) } 100% { transform: translateY(140%) } }
        @keyframes cr-flash { 0%,100% { background: transparent } 30%,60% { background: rgba(220,38,38,0.4) } }
        @keyframes cr-mh-glow { 0%,100% { filter: drop-shadow(0 0 4px rgba(253,224,71,0.4)) } 50% { filter: drop-shadow(0 0 14px rgba(253,224,71,0.9)) } }
        @keyframes cr-ticker { 0% { transform: translateX(100%) } 100% { transform: translateX(-100%) } }
        .cr-chicken-idle { animation: cr-chicken-hop 1.4s ease-in-out infinite; transform-origin: center bottom }
        .cr-chicken-dead { animation: cr-chicken-die 0.9s ease-out forwards }
        .cr-truck-crash { animation: cr-truck-drive 0.9s ease-in-out forwards }
        .cr-flash-overlay { animation: cr-flash 1.0s ease-in-out 2 }
        .cr-mh-active { animation: cr-mh-glow 1.6s ease-in-out infinite }
        .cr-ticker { animation: cr-ticker 18s linear infinite }
      `}</style>

      {/* Top bar — matches reference exactly */}
      <header className="sticky top-0 z-40" style={{ background: '#000', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/dashboard">
            <button className="p-2 active:scale-90" style={{ color: '#FFF' }}>
              <ArrowLeft className="w-6 h-6" />
            </button>
          </Link>
          <div className="flex-1" />
          {/* Coin + balance */}
          <div className="relative flex items-center rounded-full px-3 py-1.5" style={{
            background: 'linear-gradient(90deg, #1E3A8A 0%, #1E40AF 100%)',
            border: '1.5px solid #3B82F6',
          }}>
            <div className="absolute -left-2 w-9 h-9 rounded-full flex items-center justify-center" style={{
              background: 'radial-gradient(circle at 35% 30%, #FEF3C7 0%, #FBBF24 55%, #B45309 100%)',
              border: '2px solid #FEF3C7',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}>
              <span className="font-black text-lg text-yellow-900">$</span>
            </div>
            <span className="ml-8 font-black text-sm text-white tabular-nums">₹{balance.toFixed(2)}</span>
            <div className="ml-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ border: '1.5px solid #3B82F6', color: '#3B82F6' }}>
              <span className="text-lg leading-none pb-1">+</span>
            </div>
          </div>
          {/* Profile globe */}
          <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{
            background: 'radial-gradient(circle at 35% 30%, #38BDF8 0%, #0369A1 100%)',
            border: '1.5px solid #7DD3FC',
          }}>
            <span className="text-lg">🌐</span>
          </button>
        </div>
      </header>

      {/* Game logo bar + live wins */}
      <div className="relative overflow-hidden" style={{ background: '#0F0F1A', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div className="flex items-center gap-1">
            <span className="text-white font-black tracking-tight" style={{ fontSize: 18, fontFamily: 'Outfit, sans-serif' }}>CHICKEN</span>
            <span className="font-black" style={{ fontSize: 22, color: '#DC2626', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>2</span>
            <span className="text-white font-black tracking-tight" style={{ fontSize: 18, fontFamily: 'Outfit, sans-serif' }}>ROAD</span>
            <span className="text-lg">🐔</span>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-1 px-3 py-1 rounded-full" style={{ background: 'rgba(31,41,55,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-[11px] text-gray-300 font-bold tabular-nums">{balance}</span>
              <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                <span className="text-[10px] font-black text-gray-600">₹</span>
              </div>
            </div>
          </div>
          <button className="p-1 text-white active:scale-90">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        {/* Live wins ticker */}
        <div className="px-3 pb-2 flex items-center gap-3" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-gray-400 font-bold">Live wins:</span>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] text-gray-400 font-bold">Online: <span className="text-white">{9640 + Math.floor(Math.random() * 30)}</span></span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="cr-ticker flex items-center gap-2 whitespace-nowrap">
              {(liveFeed.length ? liveFeed : [{ name: '420***', payout: 890777.72, status: 'won' }]).map((f, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px] font-bold">
                  <span className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px]">🇮🇳</span>
                  <span className="text-white">{f.name}</span>
                  {f.status === 'won'
                    ? <span className="text-green-400">+₹{(f.payout || 0).toFixed(2)}</span>
                    : <span className="text-red-400">💥</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main road scene — top-down view */}
      <div className={`relative overflow-hidden ${crashFlash ? 'cr-flash-overlay' : ''}`} style={{
        maxWidth: '480px', margin: '0 auto',
        height: 380,
        background: '#3F3F46',
      }} data-testid="road-scene">
        {/* Left sidewalk with brick pattern */}
        <div className="absolute top-0 bottom-0 left-0" style={{
          width: '32%',
          background: `
            repeating-linear-gradient(0deg, transparent 0 22px, rgba(0,0,0,0.25) 22px 24px),
            repeating-linear-gradient(90deg, transparent 0 44px, rgba(0,0,0,0.2) 44px 46px),
            linear-gradient(180deg, #A8A29E 0%, #78716C 100%)
          `,
          borderRight: '3px solid #292524',
        }}>
          {/* Grass at top */}
          <div className="absolute top-0 left-0 w-14 h-20" style={{
            background: 'radial-gradient(ellipse at 40% 50%, #16A34A 0%, #14532D 70%, transparent 100%)',
            borderRadius: '0 0 60% 0',
          }} />
          {/* Streetlight */}
          <div className="absolute top-6 right-2">
            <StreetLight />
          </div>
          {/* Chicken (bottom-left of sidewalk) */}
          <div className="absolute" style={{ bottom: 70, left: '15%', width: 100, height: 120 }}>
            <div className={crashFlash ? 'cr-chicken-dead' : 'cr-chicken-idle'} style={{ width: '100%', height: '100%' }}>
              <ChickenSVG dying={!!crashFlash} />
            </div>
          </div>
        </div>

        {/* Road area (right 68%) */}
        <div className="absolute top-0 bottom-0 right-0" style={{ width: '68%' }}>
          {/* Dashed center line vertical */}
          <div className="absolute top-0 bottom-0" style={{
            left: '50%',
            width: 4,
            transform: 'translateX(-50%)',
            background: 'repeating-linear-gradient(180deg, #FEF3C7 0 22px, transparent 22px 42px)',
          }} />

          {/* Manhole covers with multipliers — stacked vertically */}
          <div className="absolute inset-x-0 top-4 flex flex-col items-center gap-1">
            {Array.from({ length: VISIBLE_ZONES }).map((_, i) => {
              // i=0 is current, i=1..VISIBLE_ZONES-1 are upcoming
              const stepIdx = step + i;
              const mult = MULTIPLIERS[stepIdx];
              if (!mult) return <div key={i} style={{ height: 74 }} />;
              const isCurrent = i === 0;
              return (
                <div key={i} className={isCurrent ? 'cr-mh-active' : ''}>
                  <Manhole multiplier={mult} size={isCurrent ? 90 : 70} highlighted={isCurrent} />
                </div>
              );
            })}
          </div>

          {/* Red fire truck on right lane */}
          <div className="absolute" style={{
            right: '4%', top: crashFlash ? '15%' : '20%',
            transition: 'top 0.3s ease-out',
          }}>
            <div className={crashFlash ? 'cr-truck-crash' : ''}>
              <FireTruck size={70} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom control panel */}
      <div className="mx-3 my-3 rounded-2xl p-3 space-y-3" style={{
        maxWidth: '480px', margin: '12px auto',
        background: '#1F1F2E',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* MIN / bet input / MAX */}
        <div className="flex items-center gap-2 rounded-xl p-1" style={{ background: '#2A2A3D' }}>
          <button onClick={setMin} disabled={isActive}
            className="px-4 py-2 rounded-lg font-black text-sm text-gray-200 active:scale-95 disabled:opacity-50"
            style={{ background: '#3A3A50' }}>MIN</button>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
            disabled={isActive}
            data-testid="bet-input"
            className="flex-1 text-center font-black text-xl text-white bg-transparent outline-none tabular-nums disabled:opacity-70"
          />
          <button onClick={setMax} disabled={isActive}
            className="px-4 py-2 rounded-lg font-black text-sm text-gray-200 active:scale-95 disabled:opacity-50"
            style={{ background: '#3A3A50' }}>MAX</button>
        </div>

        {/* Quick chips */}
        <div className="grid grid-cols-4 gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setBetAmount(c)}
              disabled={isActive}
              data-testid={`chip-${c}`}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl font-black text-sm active:scale-95 disabled:opacity-50 ${
                betAmount === c ? 'text-yellow-300' : 'text-white'
              }`}
              style={{
                background: '#2A2A3D',
                border: betAmount === c ? '1.5px solid #FDE047' : '1.5px solid transparent',
              }}>
              <span>{c}</span>
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                <span className="text-[10px] font-black text-gray-600">₹</span>
              </div>
            </button>
          ))}
        </div>

        {/* Difficulty dropdown */}
        <div className="relative">
          <button
            onClick={() => !isActive && setShowDiff((s) => !s)}
            disabled={isActive}
            data-testid="difficulty-select"
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-black text-white active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#2A2A3D' }}>
            <span>{difficulty}</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${showDiff ? 'rotate-180' : ''}`} />
          </button>
          {showDiff && !isActive && (
            <div className="absolute inset-x-0 top-full mt-1 rounded-xl overflow-hidden z-20" style={{ background: '#2A2A3D', border: '1px solid rgba(255,255,255,0.1)' }}>
              {DIFFICULTY.map((d) => (
                <button key={d} onClick={() => { setDifficulty(d); setShowDiff(false); }}
                  className={`w-full text-left px-4 py-3 font-bold text-sm ${d === difficulty ? 'text-yellow-300' : 'text-white'} hover:bg-white/5`}
                  data-testid={`diff-${d.toLowerCase()}`}>{d}</button>
              ))}
            </div>
          )}
        </div>

        {/* Big Play / Step / Cashout button */}
        {!isActive ? (
          <button onClick={startGame} disabled={busy || betAmount < minBet} data-testid="play-btn"
            className="w-full py-4 rounded-xl font-black text-2xl text-white active:scale-95 disabled:opacity-50"
            style={{
              background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
              boxShadow: '0 4px 0 #14532D, 0 8px 16px rgba(22,163,74,0.4)',
            }}>Play</button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={stepGame} disabled={busy || step >= MAX_STEP} data-testid="step-btn"
              className="py-4 rounded-xl font-black text-lg text-white active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)',
                boxShadow: '0 4px 0 #14532D, 0 8px 16px rgba(22,163,74,0.4)',
              }}>
              <span>STEP</span>
              <div className="text-[10px] font-bold text-yellow-100 opacity-90 mt-0.5">Next {nextMult.toFixed(2)}x</div>
            </button>
            <button onClick={cashout} disabled={busy || step === 0} data-testid="cashout-btn"
              className="py-4 rounded-xl font-black text-lg text-black active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(180deg, #FBBF24 0%, #B45309 100%)',
                boxShadow: '0 4px 0 #78350F, 0 8px 16px rgba(251,191,36,0.5)',
              }}>
              <span>CASHOUT</span>
              <div className="text-[10px] font-bold opacity-90 mt-0.5">₹{Math.floor(game.bet * currentMult)}</div>
            </button>
          </div>
        )}
      </div>

      {/* History (compact) */}
      {history.length > 0 && (
        <div className="mx-3 mb-6" style={{ maxWidth: '480px', margin: '0 auto 24px' }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-2 px-1">Your Rides ({history.length})</p>
          <div className="space-y-2">
            {history.slice(0, 5).map((g, i) => {
              const isWin = g.status === 'won';
              const statusColor = isWin ? '#22C55E' : '#F87171';
              return (
                <div key={i} className="rounded-xl p-2.5 flex items-center gap-2" style={{
                  background: `linear-gradient(90deg, rgba(0,0,0,0.4) 0%, ${statusColor}22 100%)`,
                  border: `1px solid ${statusColor}55`,
                }} data-testid={`cr-ticket-${i}`}>
                  <span className="text-xl">🐔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 tracking-wider">LB-CR-{String(g.game_id).slice(-6).toUpperCase()}</p>
                    <p className="text-xs font-black" style={{ color: statusColor }}>{isWin ? 'CASHED' : 'CRASHED'} · {(g.multiplier || 0).toFixed(2)}x</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400">Bet ₹{Math.floor(g.bet)}</p>
                    {isWin
                      ? <p className="text-sm font-black text-emerald-400">+₹{Math.floor(g.payout)}</p>
                      : <p className="text-sm font-black text-red-400">-₹{Math.floor(g.bet)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChickenRoadPage;
