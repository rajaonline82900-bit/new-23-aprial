import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Clock, Users, Bot, Dice5, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL.replace(/^http/, 'ws');

// Dice face icon (Lucide) — indexed by value 1..6
const DiceFace = ({ value = 1, size = 44, spinning = false }) => (
  <div
    className="rounded-xl flex items-center justify-center relative select-none"
    style={{
      width: size,
      height: size,
      background: spinning
        ? 'linear-gradient(135deg, #F59E0B, #EF4444)'
        : 'linear-gradient(135deg, #FFFFFF, #E5E7EB)',
      boxShadow: spinning
        ? '0 4px 18px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.5)'
        : '0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)',
      transform: spinning ? 'rotate(20deg)' : 'rotate(0deg)',
      transition: 'transform 200ms ease, background 200ms ease',
    }}
  >
    <span className="text-2xl font-black" style={{ color: spinning ? '#FFF' : '#111827' }}>
      {value}
    </span>
  </div>
);

const LudoGamePage = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [countdown, setCountdown] = useState(0);       // seconds till turn deadline
  const [matchLeft, setMatchLeft] = useState(0);        // seconds left in match
  const [botFillLeft, setBotFillLeft] = useState(0);   // seconds till bot autofill
  const wsRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;

  const fetchState = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/ludo/tables/${tableId}`);
      setState(data.state);
      return data.state;
    } catch (e) {
      toast.error('Table load nahi hua');
      return null;
    }
  }, [tableId]);

  // WebSocket connect
  useEffect(() => {
    fetchState();
    const url = `${WS_URL}/api/ludo/ws/${tableId}`;
    let ws;
    let closed = false;
    try {
      ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.state) setState(msg.state);
          if (msg.type === 'game_over') {
            const iWon = (msg.winner_ids || []).includes(user?._id || user?.id);
            if (iWon) {
              toast.success(`🏆 Aap jeete! ₹${msg.per_winner}`);
              refreshUser();
            } else {
              toast.error('Match khatam! Better luck next time');
            }
          } else if (msg.type === 'dice_rolled') {
            setRolling(false);
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => { /* fallback polling below */ };
      ws.onclose = () => { closed = true; };
    } catch { /* ignore */ }

    // Fallback polling every 3s in case WS is dead
    const pollIv = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchState();
      }
    }, 3000);

    return () => {
      clearInterval(pollIv);
      if (ws && !closed) try { ws.close(); } catch { /* ignore */ }
    };
  }, [tableId]);

  // Ticker for countdowns
  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const now = Date.now() / 1000;
      if (s.status === 'waiting' && s.bot_fill_deadline) {
        setBotFillLeft(Math.max(0, Math.floor(s.bot_fill_deadline - now)));
      }
      if (s.status === 'playing') {
        if (s.current_turn_deadline) {
          setCountdown(Math.max(0, Math.floor(s.current_turn_deadline - now)));
        }
        if (s.match_ends_at) {
          setMatchLeft(Math.max(0, Math.floor(s.match_ends_at - now)));
        }
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    try {
      await axios.post(`${API_URL}/api/ludo/tables/${tableId}/roll`, {}, { withCredentials: true });
      // state updates via WS
    } catch (e) {
      setRolling(false);
      toast.error(e?.response?.data?.detail || 'Roll failed');
    }
  };

  const leaveTable = async () => {
    if (state?.status === 'playing') {
      toast.error('Game shuru ho chuka hai, ab leave nahi kar sakte');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/ludo/tables/${tableId}/leave`, {}, { withCredentials: true });
      await refreshUser();
      navigate('/ludo', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Leave failed');
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const myId = user?._id || user?.id;
  const myPlayer = state.players.find((p) => p.user_id === myId);
  const currentPlayer = state.players[state.current_turn_idx];
  const isMyTurn = state.status === 'playing' && currentPlayer && currentPlayer.user_id === myId;
  const trackLen = state.track_length || 30;

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white pb-4 app-shell">
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-[#0A0A0C]/85 border-b border-purple-500/25">
        <div className="px-3 py-3 flex items-center gap-2">
          <Link to="/ludo">
            <button data-testid="ludo-game-back" className="p-2 rounded-lg bg-[#141418] border border-white/10 text-gray-400">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black tracking-tight" style={{ background: 'linear-gradient(90deg,#C4B5FD,#7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LUDO • ₹{state.entry_fee}
            </h1>
            <p className="text-[10px] text-purple-300/70 font-bold uppercase tracking-wider">
              Prize ₹{Math.floor(state.prize_pool || state.entry_fee * state.max_players * 0.9)}
              {state.status === 'playing' && matchLeft > 0 && <> • <Clock className="inline w-3 h-3 -mt-0.5" /> {fmtTime(matchLeft)}</>}
            </p>
          </div>
          {state.status === 'waiting' && (
            <button
              onClick={leaveTable}
              data-testid="ludo-leave-btn"
              className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300"
              title="Leave & Refund"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="px-3 py-4 space-y-4">
        {/* Waiting Room */}
        {state.status === 'waiting' && (
          <div className="rounded-2xl p-5 border border-purple-500/30 text-center" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,7,100,0.25))' }}>
            <div className="text-4xl mb-2">⏳</div>
            <p className="text-lg font-black">Waiting for players...</p>
            <p className="text-sm text-purple-200/80 mt-1">
              {state.players.length}/{state.max_players} joined
            </p>
            {botFillLeft > 0 && (
              <p className="text-xs text-yellow-300 mt-2 font-bold">
                <Bot className="inline w-3.5 h-3.5 -mt-0.5" /> Auto-fill with bots in {botFillLeft}s
              </p>
            )}
          </div>
        )}

        {/* Players Grid */}
        <div className="grid grid-cols-2 gap-2">
          {state.players.map((p) => {
            const isTurn = state.status === 'playing' && p.seat === state.current_turn_idx;
            const isMe = p.user_id === myId;
            return (
              <div
                key={p.seat}
                data-testid={`ludo-player-${p.seat}`}
                className={`rounded-xl p-2.5 border-2 transition-all ${isTurn ? 'shadow-lg' : ''}`}
                style={{
                  borderColor: isTurn ? p.color : 'rgba(255,255,255,0.1)',
                  background: isTurn ? `${p.color}15` : '#141418',
                  boxShadow: isTurn ? `0 4px 18px ${p.color}55` : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm"
                    style={{ background: p.color, boxShadow: `0 0 8px ${p.color}88` }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate flex items-center gap-1">
                      {p.is_bot && <Bot className="w-3 h-3 text-purple-300" />}
                      {p.name} {isMe && <span className="text-[9px] text-emerald-400">(You)</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">Pos: {p.position}/{trackLen} • Cap: {p.captures || 0}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(p.position / trackLen) * 100}%`, background: p.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Board Track */}
        {state.status !== 'waiting' && (
          <div className="rounded-2xl p-3 bg-[#141418] border border-white/10">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Race Track</p>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: trackLen }, (_, i) => {
                const sq = i + 1;
                const on = state.players.filter((p) => p.position === sq);
                const isHome = sq === trackLen;
                const isSafe = sq % 5 === 0 && !isHome;
                return (
                  <div
                    key={sq}
                    data-testid={`ludo-sq-${sq}`}
                    className="aspect-square rounded-md flex items-center justify-center relative text-[9px] font-bold"
                    style={{
                      background: isHome ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : isSafe ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isHome ? '#F59E0B' : isSafe ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: isHome ? '#111' : '#6b7280',
                    }}
                  >
                    {isHome ? '🏁' : sq}
                    {on.length > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center gap-0.5">
                        {on.map((p) => (
                          <div
                            key={p.seat}
                            className="w-2.5 h-2.5 rounded-full border border-white"
                            style={{ background: p.color, boxShadow: `0 0 4px ${p.color}` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dice & Turn Panel */}
        {state.status === 'playing' && (
          <div className="rounded-2xl p-4 bg-[#141418] border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Turn</p>
                <p className="text-base font-black flex items-center gap-1.5" style={{ color: currentPlayer?.color }}>
                  {currentPlayer?.is_bot && <Bot className="w-4 h-4" />}
                  {currentPlayer?.name}
                  {isMyTurn && <span className="text-emerald-400 text-xs">(Your Turn!)</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase font-bold">Time</p>
                <p className={`text-lg font-black tabular-nums ${countdown <= 5 ? 'text-red-400' : 'text-white'}`}>
                  {countdown}s
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 py-3">
              <DiceFace value={state.last_dice?.value || '?'} size={60} spinning={rolling} />
              <button
                onClick={rollDice}
                disabled={!isMyTurn || rolling}
                data-testid="ludo-roll-btn"
                className="px-6 py-4 rounded-2xl font-black text-base disabled:opacity-40"
                style={{
                  background: isMyTurn ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg,#374151,#1F2937)',
                  color: '#FFF',
                  boxShadow: isMyTurn ? '0 6px 20px rgba(16,185,129,0.4)' : 'none',
                }}
              >
                <Dice5 className="inline w-5 h-5 -mt-0.5 mr-1" />
                {rolling ? 'Rolling...' : isMyTurn ? 'ROLL DICE' : 'Wait'}
              </button>
            </div>

            {state.last_dice && (
              <p className="text-center text-xs text-gray-400">
                Last roll: <span className="font-bold text-white">{state.last_dice.value}</span>
                {' '}by {state.players[state.last_dice.roller_seat]?.name}
              </p>
            )}
          </div>
        )}

        {/* Game Over Screen */}
        {state.status === 'completed' && (
          <div className="rounded-2xl p-6 border border-yellow-400/40 text-center" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(180,83,9,0.2))' }} data-testid="ludo-gameover">
            <Trophy className="w-14 h-14 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-black">
              {state.winner_ids.includes(myId) ? '🏆 आप जीते!' : 'Game Over'}
            </p>
            <p className="text-yellow-300 mt-2">
              Winner: {state.winner_ids.map((wid) => state.players.find((p) => p.user_id === wid)?.name).join(', ')}
            </p>
            <p className="text-lg text-white mt-1 font-black">
              ₹{state.per_winner || 0} {state.winner_ids.length > 1 && '(split)'}
            </p>
            <button
              onClick={() => navigate('/ludo', { replace: true })}
              data-testid="ludo-play-again"
              className="mt-4 px-6 py-3 rounded-xl font-black text-white"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
            >
              Play Again
            </button>
          </div>
        )}

        {/* Event Log */}
        {(state.log || []).length > 0 && (
          <div className="rounded-2xl p-3 bg-[#0F0F14] border border-white/5 max-h-40 overflow-y-auto">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Live Log</p>
            {(state.log || []).slice().reverse().map((e, i) => (
              <p key={i} className="text-[11px] text-gray-300 leading-tight py-0.5">{e.msg}</p>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default LudoGamePage;
