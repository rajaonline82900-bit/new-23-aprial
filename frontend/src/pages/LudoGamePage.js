import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Clock, Bot, Dice5, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL.replace(/^http/, 'ws');

// ============ Board geometry (Zupee-style classic Ludo) ============
// 15x15 grid. Home yards in corners, cross-shaped track, center home.
// Player seat -> color:
//   0=Red (top-left), 1=Green (top-right), 2=Yellow (bottom-right), 3=Blue (bottom-left)

// Main track (52 squares) — clockwise starting from Red's exit
const MAIN_TRACK = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],                    // 0-4 (Red row)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],            // 5-10 (going up)
  [0, 7],                                                     // 11 (top)
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],            // 12-17 (Green col)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],       // 18-23 (right row)
  [7, 14],                                                    // 24 (right edge)
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],       // 25-30 (Yellow row)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],       // 31-36 (going down)
  [14, 7],                                                    // 37 (bottom)
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],       // 38-43 (Blue col)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],            // 44-49 (bottom-left row)
  [7, 0], [6, 0],                                             // 50-51 (left edge back to red)
];

// Home columns (6 squares each) — final square = center home
const HOME_COLUMNS = {
  red:    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green:  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue:   [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

const HOME_CENTER = [7, 7];

// Yard dock coords (where tokens sit before release) — 4 per color
const YARD_DOCKS = {
  red:    [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green:  [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue:   [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
};

const COLOR_MAP = {
  red: { main: '#DC2626', dark: '#7F1D1D', light: '#FCA5A5' },
  green: { main: '#16A34A', dark: '#14532D', light: '#86EFAC' },
  yellow: { main: '#EAB308', dark: '#713F12', light: '#FDE68A' },
  blue: { main: '#2563EB', dark: '#1E3A8A', light: '#93C5FD' },
};

// Which grid cells belong to which color's home column path (for coloring the arrow lane)
const HOME_LANE_CELLS = new Set([
  ...HOME_COLUMNS.red.map((c) => `${c[0]},${c[1]}`),
  ...HOME_COLUMNS.green.map((c) => `${c[0]},${c[1]}`),
  ...HOME_COLUMNS.yellow.map((c) => `${c[0]},${c[1]}`),
  ...HOME_COLUMNS.blue.map((c) => `${c[0]},${c[1]}`),
]);
const HOME_LANE_COLOR = {}; // "r,c" -> "red"|"green"|"yellow"|"blue"
Object.entries(HOME_COLUMNS).forEach(([col, cells]) => {
  cells.forEach(([r, c]) => (HOME_LANE_COLOR[`${r},${c}`] = col));
});

// Which cells are on the main track (for showing as path cells)
const MAIN_TRACK_SET = new Set(MAIN_TRACK.map(([r, c]) => `${r},${c}`));

// Get (row, col) for a token given (colorName, progress)
function tokenGridPos(colorName, startPos, progress, tokenId) {
  if (progress === 0) {
    // yard dock
    return YARD_DOCKS[colorName][tokenId];
  }
  if (progress >= 1 && progress <= 51) {
    const absPos = (startPos + progress - 1) % 52;
    return MAIN_TRACK[absPos];
  }
  if (progress >= 52 && progress <= 57) {
    const idx = progress - 52; // 0..5
    if (idx < 6) return HOME_COLUMNS[colorName][idx];
    return HOME_CENTER;
  }
  return HOME_CENTER;
}

// ============ Board Component ============
const LudoBoard = ({ state, myId, onTokenClick, movableSet, dice }) => {
  const CELL = 22; // px per cell
  const BOARD_PX = CELL * 15;

  const cells = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const key = `${r},${c}`;
      const isMainTrack = MAIN_TRACK_SET.has(key);
      const isHomeLane = HOME_LANE_CELLS.has(key);
      const isCenter = r === 7 && c === 7;
      const isYardTL = r < 6 && c < 6;
      const isYardTR = r < 6 && c > 8;
      const isYardBL = r > 8 && c < 6;
      const isYardBR = r > 8 && c > 8;

      let bg = 'transparent';
      let border = 'rgba(255,255,255,0.05)';
      if (isCenter) {
        bg = 'transparent';
      } else if (isHomeLane) {
        bg = COLOR_MAP[HOME_LANE_COLOR[key]].light;
        border = COLOR_MAP[HOME_LANE_COLOR[key]].dark;
      } else if (isMainTrack) {
        // Color the color-start squares
        const trackIdx = MAIN_TRACK.findIndex(([mr, mc]) => mr === r && mc === c);
        if (trackIdx === 0) { bg = COLOR_MAP.red.light; }
        else if (trackIdx === 13) { bg = COLOR_MAP.green.light; }
        else if (trackIdx === 26) { bg = COLOR_MAP.yellow.light; }
        else if (trackIdx === 39) { bg = COLOR_MAP.blue.light; }
        else { bg = '#F8FAFC'; }
        border = '#94A3B8';
      } else if (isYardTL || isYardTR || isYardBL || isYardBR) {
        // Yard body: colored quadrant
        continue; // We render yards as one big block separately
      } else {
        continue; // outside path — hide
      }

      // Star icon for safe squares (8, 21, 34, 47)
      const trackIdx = MAIN_TRACK.findIndex(([mr, mc]) => mr === r && mc === c);
      const isStar = [8, 21, 34, 47].includes(trackIdx);

      cells.push(
        <div
          key={key}
          style={{
            position: 'absolute',
            top: r * CELL,
            left: c * CELL,
            width: CELL,
            height: CELL,
            background: bg,
            border: `1px solid ${border}`,
            boxSizing: 'border-box',
          }}
        >
          {isStar && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#334155', fontWeight: 900,
            }}>★</div>
          )}
        </div>
      );
    }
  }

  // Yard corner blocks (6x6) — colored
  const yardCorners = [
    { color: 'red', top: 0, left: 0 },
    { color: 'green', top: 0, left: 9 * CELL },
    { color: 'yellow', top: 9 * CELL, left: 9 * CELL },
    { color: 'blue', top: 9 * CELL, left: 0 },
  ];

  return (
    <div
      className="relative mx-auto"
      style={{ width: BOARD_PX, height: BOARD_PX, background: '#0F172A', borderRadius: 8, boxShadow: '0 6px 22px rgba(0,0,0,0.6)' }}
      data-testid="ludo-board"
    >
      {/* Yard corner blocks with inner white pocket */}
      {yardCorners.map((y) => (
        <React.Fragment key={y.color}>
          <div style={{
            position: 'absolute', top: y.top, left: y.left,
            width: 6 * CELL, height: 6 * CELL,
            background: COLOR_MAP[y.color].main,
            border: `2px solid ${COLOR_MAP[y.color].dark}`,
            boxSizing: 'border-box',
          }} />
          <div style={{
            position: 'absolute', top: y.top + CELL, left: y.left + CELL,
            width: 4 * CELL, height: 4 * CELL,
            background: '#F1F5F9',
            borderRadius: 4,
          }} />
        </React.Fragment>
      ))}

      {/* Center home (triangle-style split into 4) */}
      <div style={{
        position: 'absolute', top: 6 * CELL, left: 6 * CELL,
        width: 3 * CELL, height: 3 * CELL,
        background: '#F1F5F9',
        border: '2px solid #334155',
        boxSizing: 'border-box',
        clipPath: 'none',
      }}>
        <svg viewBox="0 0 60 60" width={3 * CELL} height={3 * CELL} style={{ position: 'absolute', top: 0, left: 0 }}>
          <polygon points="0,0 60,0 30,30" fill={COLOR_MAP.green.main} />
          <polygon points="60,0 60,60 30,30" fill={COLOR_MAP.yellow.main} />
          <polygon points="60,60 0,60 30,30" fill={COLOR_MAP.blue.main} />
          <polygon points="0,60 0,0 30,30" fill={COLOR_MAP.red.main} />
        </svg>
      </div>

      {/* Path cells */}
      {cells}

      {/* Tokens */}
      {state.players.map((p) =>
        p.tokens.map((tok) => {
          const [gr, gc] = tokenGridPos(p.color_name, p.start_pos, tok.progress, tok.id);
          const isMine = p.user_id === myId;
          const key = `${p.seat}-${tok.id}`;
          const movable = isMine && movableSet.has(tok.id);
          // Stack tokens on same square: offset by index if multiple
          const sameCellCount = state.players
            .flatMap((pp) => pp.tokens.map((tt) => ({ p: pp, t: tt })))
            .filter(({ p: pp, t: tt }) => {
              const [tr, tc] = tokenGridPos(pp.color_name, pp.start_pos, tt.progress, tt.id);
              return tr === gr && tc === gc;
            });
          const myIdxInStack = sameCellCount.findIndex(
            ({ p: pp, t: tt }) => pp.seat === p.seat && tt.id === tok.id
          );
          const stackOffset = sameCellCount.length > 1 ? (myIdxInStack - (sameCellCount.length - 1) / 2) * 3 : 0;
          const TOKEN_SIZE = 16;
          const yardMode = tok.progress === 0;
          return (
            <button
              key={key}
              data-testid={`ludo-token-${p.seat}-${tok.id}`}
              onClick={() => movable && onTokenClick(tok.id)}
              disabled={!movable}
              style={{
                position: 'absolute',
                top: gr * CELL + (CELL - TOKEN_SIZE) / 2 + stackOffset,
                left: gc * CELL + (CELL - TOKEN_SIZE) / 2 + stackOffset,
                width: TOKEN_SIZE,
                height: TOKEN_SIZE,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, ${COLOR_MAP[p.color_name].light}, ${COLOR_MAP[p.color_name].main} 60%, ${COLOR_MAP[p.color_name].dark})`,
                border: `2px solid ${movable ? '#FFF' : COLOR_MAP[p.color_name].dark}`,
                boxShadow: movable
                  ? `0 0 0 3px ${COLOR_MAP[p.color_name].main}, 0 0 10px 4px ${COLOR_MAP[p.color_name].light}`
                  : `0 2px 3px rgba(0,0,0,0.35)`,
                cursor: movable ? 'pointer' : 'default',
                animation: movable ? 'ludoPulse 1.2s ease-in-out infinite' : 'none',
                padding: 0,
                zIndex: yardMode ? 3 : 5 + tok.progress,
                transition: 'top 300ms ease, left 300ms ease',
              }}
            />
          );
        })
      )}

      <style>{`
        @keyframes ludoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
};

// ============ Dice ============
const DiceFace = ({ value = 1, size = 46, spinning = false }) => (
  <div
    className="rounded-xl flex items-center justify-center relative select-none"
    style={{
      width: size,
      height: size,
      background: spinning
        ? 'linear-gradient(135deg, #F59E0B, #EF4444)'
        : 'linear-gradient(135deg, #FFFFFF, #E5E7EB)',
      boxShadow: spinning
        ? '0 4px 18px rgba(245,158,11,0.55)'
        : '0 3px 10px rgba(0,0,0,0.4)',
      transform: spinning ? 'rotate(20deg)' : 'rotate(0deg)',
      transition: 'transform 200ms ease, background 200ms ease',
    }}
  >
    <span className="text-2xl font-black" style={{ color: spinning ? '#FFF' : '#111827' }}>{value}</span>
  </div>
);

// ============ Main Page ============
const LudoGamePage = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [movable, setMovable] = useState([]);   // token IDs the user can move
  const [countdown, setCountdown] = useState(0);
  const [matchLeft, setMatchLeft] = useState(0);
  const [botFillLeft, setBotFillLeft] = useState(0);
  const wsRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;

  const myId = user?._id || user?.id;

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

  // WS
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
          if (msg.type === 'dice_rolled') {
            setRolling(false);
            if (msg.movable !== undefined) setMovable(msg.movable || []);
            if (msg.no_move) setMovable([]);
          }
          if (msg.type === 'token_moved') {
            setMovable([]);
          }
          if (msg.type === 'game_over') {
            const iWon = (msg.winner_ids || []).includes(myId);
            if (iWon) {
              toast.success(`🏆 Aap jeete! ₹${msg.per_winner}`);
              refreshUser();
            } else {
              toast.error('Match khatam! Better luck next time');
            }
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { closed = true; };
    } catch { /* ignore */ }

    const pollIv = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchState();
      }
    }, 3000);

    return () => {
      clearInterval(pollIv);
      if (ws && !closed) try { ws.close(); } catch { /* ignore */ }
    };
  }, [tableId, fetchState, myId, refreshUser]);

  // Countdowns
  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const now = Date.now() / 1000;
      if (s.status === 'waiting' && s.bot_fill_deadline) {
        setBotFillLeft(Math.max(0, Math.floor(s.bot_fill_deadline - now)));
      }
      if (s.status === 'playing') {
        if (s.current_turn_deadline) setCountdown(Math.max(0, Math.floor(s.current_turn_deadline - now)));
        if (s.match_ends_at) setMatchLeft(Math.max(0, Math.floor(s.match_ends_at - now)));
      }
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // Re-derive movable when pending_dice / current_turn changes
  useEffect(() => {
    if (!state) return;
    if (state.status !== 'playing') { setMovable([]); return; }
    const cp = state.players[state.current_turn_idx];
    if (!cp || cp.user_id !== myId || cp.is_bot) { setMovable([]); return; }
    const pending = state.pending_dice;
    if (!pending) { setMovable([]); return; }
    // Compute movable locally (matches backend logic)
    const dice = pending.value;
    const ids = [];
    for (const t of cp.tokens) {
      const p = t.progress;
      if (p === 0) { if (dice === 6) ids.push(t.id); continue; }
      if (p >= 57) continue;
      if (p + dice > 57) continue;
      ids.push(t.id);
    }
    setMovable(ids);
  }, [state, myId]);

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    try {
      await axios.post(`${API_URL}/api/ludo/tables/${tableId}/roll`, {}, { withCredentials: true });
    } catch (e) {
      setRolling(false);
      toast.error(e?.response?.data?.detail || 'Roll failed');
    }
  };

  const moveToken = async (tokenId) => {
    try {
      await axios.post(
        `${API_URL}/api/ludo/tables/${tableId}/move`,
        { token_id: tokenId },
        { withCredentials: true }
      );
      setMovable([]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Move failed');
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

  const movableSet = useMemo(() => new Set(movable), [movable]);

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlayer = state.players[state.current_turn_idx];
  const isMyTurn = state.status === 'playing' && currentPlayer && currentPlayer.user_id === myId;
  const hasPending = !!state.pending_dice;

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white pb-6 app-shell">
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
            <button onClick={leaveTable} data-testid="ludo-leave-btn"
              className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="px-3 py-4 space-y-3">
        {/* Waiting */}
        {state.status === 'waiting' && (
          <div className="rounded-2xl p-5 border border-purple-500/30 text-center" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,7,100,0.25))' }}>
            <div className="text-4xl mb-2">⏳</div>
            <p className="text-lg font-black">Waiting for players...</p>
            <p className="text-sm text-purple-200/80 mt-1">{state.players.length}/{state.max_players} joined</p>
            {botFillLeft > 0 && (
              <p className="text-xs text-yellow-300 mt-2 font-bold">
                <Bot className="inline w-3.5 h-3.5 -mt-0.5" /> Auto-fill with bots in {botFillLeft}s
              </p>
            )}
          </div>
        )}

        {/* Player HUD */}
        {state.status !== 'waiting' && (
          <div className="grid grid-cols-2 gap-1.5">
            {state.players.map((p) => {
              const isTurn = p.seat === state.current_turn_idx;
              const isMe = p.user_id === myId;
              const homeCount = p.tokens.filter((t) => t.progress >= 57).length;
              return (
                <div
                  key={p.seat}
                  data-testid={`ludo-player-${p.seat}`}
                  className="rounded-lg p-2 border-2 transition-all"
                  style={{
                    borderColor: isTurn ? p.color : 'rgba(255,255,255,0.1)',
                    background: isTurn ? `${p.color}20` : '#141418',
                    boxShadow: isTurn ? `0 4px 14px ${p.color}55` : 'none',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0"
                      style={{ background: p.color }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold truncate flex items-center gap-0.5">
                        {p.is_bot && <Bot className="w-2.5 h-2.5" />}
                        {p.name} {isMe && <span className="text-[9px] text-emerald-400">(You)</span>}
                      </p>
                      <p className="text-[9px] text-gray-400 leading-tight">
                        Score <span className="font-bold text-white">{p.score}</span> • Home {homeCount}/4
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Board */}
        {state.status !== 'waiting' && (
          <div className="rounded-xl p-2 bg-[#0F172A]/50 border border-white/5">
            <LudoBoard
              state={state}
              myId={myId}
              onTokenClick={moveToken}
              movableSet={movableSet}
              dice={state.pending_dice?.value || state.last_dice?.value}
            />
          </div>
        )}

        {/* Dice control */}
        {state.status === 'playing' && (
          <div className="rounded-2xl p-3 bg-[#141418] border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[9px] text-gray-400 uppercase font-bold">Turn</p>
                <p className="text-sm font-black flex items-center gap-1" style={{ color: currentPlayer?.color }}>
                  {currentPlayer?.is_bot && <Bot className="w-3.5 h-3.5" />}
                  {currentPlayer?.name}
                  {isMyTurn && <span className="text-emerald-400 text-[10px]">(Your Turn!)</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-gray-400 uppercase font-bold">Time</p>
                <p className={`text-base font-black tabular-nums ${countdown <= 5 ? 'text-red-400' : 'text-white'}`}>{countdown}s</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 py-2">
              <DiceFace value={state.pending_dice?.value || state.last_dice?.value || '?'} size={54} spinning={rolling} />
              <button
                onClick={rollDice}
                disabled={!isMyTurn || rolling || hasPending}
                data-testid="ludo-roll-btn"
                className="px-5 py-3 rounded-xl font-black text-sm disabled:opacity-40"
                style={{
                  background: isMyTurn && !hasPending ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg,#374151,#1F2937)',
                  color: '#FFF',
                  boxShadow: isMyTurn && !hasPending ? '0 4px 14px rgba(16,185,129,0.4)' : 'none',
                }}
              >
                <Dice5 className="inline w-4 h-4 -mt-0.5 mr-1" />
                {rolling ? 'Rolling...' : hasPending ? 'Pick Token' : isMyTurn ? 'ROLL' : 'Wait'}
              </button>
            </div>
            {hasPending && movable.length > 0 && (
              <p className="text-center text-[10px] text-yellow-300 font-bold">
                Choose a glowing token to move ({movable.length} available)
              </p>
            )}
          </div>
        )}

        {/* Game Over */}
        {state.status === 'completed' && (
          <div className="rounded-2xl p-6 border border-yellow-400/40 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(180,83,9,0.2))' }}
            data-testid="ludo-gameover">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-black">
              {state.winner_ids.includes(myId) ? '🏆 आप जीते!' : 'Game Over'}
            </p>
            <p className="text-yellow-300 mt-2 text-sm">
              Winner: {state.winner_ids.map((wid) => state.players.find((p) => p.user_id === wid)?.name).join(', ')}
            </p>
            <p className="text-lg text-white mt-1 font-black">
              ₹{state.per_winner || 0} {state.winner_ids.length > 1 && '(split)'}
            </p>
            <button
              onClick={() => navigate('/ludo', { replace: true })}
              data-testid="ludo-play-again"
              className="mt-4 px-6 py-2.5 rounded-xl font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
              Play Again
            </button>
          </div>
        )}

        {/* Log */}
        {(state.log || []).length > 0 && (
          <div className="rounded-xl p-2 bg-[#0F0F14] border border-white/5 max-h-32 overflow-y-auto">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-1">Live Log</p>
            {(state.log || []).slice().reverse().map((e, i) => (
              <p key={i} className="text-[10px] text-gray-300 leading-tight py-0.5">{e.msg}</p>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default LudoGamePage;
