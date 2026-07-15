import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { ArrowLeft, Trophy, Clock, Dice5, LogOut, Volume2, VolumeX, AlertTriangle, Smile, X, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  playDiceRoll, playTokenMove, playCapture, playTokenHome,
  playWin, playLose, startMusic, stopMusic, setMuted, isMuted as audioIsMuted,
} from '../utils/ludoAudio';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API_URL.replace(/^http/, 'ws');

/* ═══════════ Premium Blue Gaming Theme ═══════════ */
const THEME = {
  bg: '#050B1F',
  bgSoft: '#0A1330',
  cardBg: 'linear-gradient(160deg, #0F1A38 0%, #0A1224 100%)',
  glassBg: 'linear-gradient(135deg, rgba(37, 99, 235, 0.10) 0%, rgba(15, 23, 42, 0.55) 100%)',
  glassBorder: 'rgba(96, 165, 250, 0.28)',
  neon: '#3B82F6',
  neonBright: '#60A5FA',
  neonSoft: '#93C5FD',
  cyan: '#22D3EE',
  gold: '#FBBF24',
};

const EMOJI_LIST = ['🔥', '😂', '😭', '👍', '💩', '🎉', '😎', '😡'];

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
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiFloats, setEmojiFloats] = useState([]);   // [{id, seat, emoji, name}]
  const [emojiCooldown, setEmojiCooldown] = useState(0);
  const [matchStartCountdown, setMatchStartCountdown] = useState(0); // 3,2,1 overlay
  const [showResultModal, setShowResultModal] = useState(false);
  const confettiFiredRef = useRef(false);
  const prevStatusRef = useRef(null);
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
          if (msg.type === 'match_started') {
            startMusic();
            // Kick off 3-2-1 GO countdown overlay
            setMatchStartCountdown(3);
          }
          if (msg.type === 'emoji') {
            // Ephemeral floating emoji reaction
            const id = `${msg.ts}-${msg.seat}-${Math.random()}`;
            setEmojiFloats((f) => [...f, { id, seat: msg.seat, name: msg.name, emoji: msg.emoji }]);
            setTimeout(() => {
              setEmojiFloats((f) => f.filter((e) => e.id !== id));
            }, 2600);
          }
          if (msg.type === 'dice_rolled') {
            setRolling(false);
            if (msg.movable !== undefined) setMovable(msg.movable || []);
            if (msg.no_move) setMovable([]);
          }
          if (msg.type === 'token_moved') {
            setMovable([]);
            // Detect capture/home from log tail
            try {
              const last = (msg.state?.log || []).slice(-1)[0]?.msg || '';
              if (last.includes('captured')) playCapture();
              else if (last.includes('HOME')) playTokenHome();
              else playTokenMove();
            } catch { playTokenMove(); }
          }
          if (msg.type === 'player_forfeited') {
            const forfeitedIsMe = msg.state?.players?.[msg.seat]?.user_id === myId;
            if (forfeitedIsMe) {
              toast.error('Aap disqualified ho gaye — game se bahar ho gaye');
              playLose();
            }
          }
          if (msg.type === 'game_over') {
            stopMusic();
            const iWon = (msg.winner_ids || []).includes(myId);
            setShowResultModal(true);
            if (iWon) {
              playWin();
              refreshUser();
              // Fire confetti burst (guard against double fire)
              if (!confettiFiredRef.current) {
                confettiFiredRef.current = true;
                try {
                  const fire = (particleRatio, opts) => {
                    confetti({
                      origin: { y: 0.7 },
                      spread: 90,
                      startVelocity: 45,
                      colors: ['#60A5FA', '#22D3EE', '#FBBF24', '#F97316', '#EC4899'],
                      particleCount: Math.floor(180 * particleRatio),
                      ...opts,
                    });
                  };
                  fire(0.25, { spread: 26, startVelocity: 55 });
                  fire(0.20, { spread: 60 });
                  fire(0.35, { spread: 100, decay: 0.91 });
                  fire(0.10, { spread: 120, startVelocity: 25, decay: 0.92 });
                  fire(0.10, { spread: 120, startVelocity: 45 });
                } catch (_) { /* confetti unavailable */ }
              }
            } else {
              playLose();
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
    if (!cp || cp.user_id !== myId) { setMovable([]); return; }
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

  // Auto-start music when match becomes 'playing' and stop on unmount
  useEffect(() => {
    if (state?.status === 'playing') {
      startMusic();
    } else if (state?.status === 'completed' || state?.status === 'cancelled') {
      stopMusic();
    }
    return () => { /* keep music running on re-render */ };
  }, [state?.status]);

  useEffect(() => () => { stopMusic(); }, []);

  // 3-2-1 GO countdown ticker
  useEffect(() => {
    if (matchStartCountdown <= 0) return;
    const t = setTimeout(() => setMatchStartCountdown((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [matchStartCountdown]);

  // Emoji cooldown ticker (2 second cooldown between sends)
  useEffect(() => {
    if (emojiCooldown <= 0) return;
    const t = setTimeout(() => setEmojiCooldown((c) => Math.max(0, c - 100)), 100);
    return () => clearTimeout(t);
  }, [emojiCooldown]);

  // Fallback: detect status transition waiting → playing (in case match_started WS msg missed)
  useEffect(() => {
    const prev = prevStatusRef.current;
    const cur = state?.status;
    if (prev === 'waiting' && cur === 'playing') {
      setMatchStartCountdown(3);
      startMusic();
    }
    // Fallback: show result modal on status transition into 'completed'
    if (prev && prev !== 'completed' && cur === 'completed') {
      setShowResultModal(true);
      const iWon = (state.winner_ids || []).includes(myId);
      if (iWon && !confettiFiredRef.current) {
        confettiFiredRef.current = true;
        try {
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#60A5FA', '#22D3EE', '#FBBF24', '#F97316', '#EC4899'],
          });
        } catch (_) { /* confetti unavailable */ }
      }
    }
    prevStatusRef.current = cur;
  }, [state?.status, state?.winner_ids, myId]);

  const toggleMute = () => {
    const newMuted = !muted;
    setMutedState(newMuted);
    setMuted(newMuted);
    if (!newMuted && state?.status === 'playing') startMusic();
  };

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    playDiceRoll();
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

  const requestLeave = () => {
    if (state?.status === 'playing') {
      // Show confirm modal — leaving = forfeit + lose
      setShowLeaveModal(true);
      return;
    }
    doLeave();
  };

  const doLeave = async () => {
    setShowLeaveModal(false);
    try {
      await axios.post(`${API_URL}/api/ludo/tables/${tableId}/leave`, {}, { withCredentials: true });
      await refreshUser();
      navigate('/ludo', { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Leave failed');
    }
  };

  const sendEmoji = async (emoji) => {
    if (emojiCooldown > 0) return;
    try {
      await axios.post(
        `${API_URL}/api/ludo/tables/${tableId}/emoji`,
        { emoji },
        { withCredentials: true }
      );
      setEmojiCooldown(2000);
      setEmojiOpen(false);
    } catch (e) {
      // silent — likely rate limit or disconnect
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
    <div
      className="min-h-screen text-white pb-6 app-shell relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59, 130, 246, 0.28) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34, 211, 238, 0.14) 0%, transparent 60%),
          ${THEME.bg}
        `,
      }}
    >
      {/* Gaming grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 90%)',
        }}
      />
      <header
        className="sticky top-0 z-40 backdrop-blur-xl relative"
        style={{
          background: 'rgba(5, 11, 31, 0.75)',
          borderBottom: `1px solid ${THEME.glassBorder}`,
        }}
      >
        <div className="px-3 py-3 flex items-center gap-2" style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Link to="/ludo">
            <button data-testid="ludo-game-back" className="p-2 rounded-xl active:scale-90 transition"
              style={{ background: 'rgba(59, 130, 246, 0.12)', border: `1px solid ${THEME.glassBorder}`, color: THEME.neonBright }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black tracking-tight leading-none flex items-center gap-1.5"
              style={{
                background: `linear-gradient(90deg, ${THEME.neonBright} 0%, ${THEME.cyan} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 12px ${THEME.neon}66)`,
              }}>
              LUDO • ₹{state.entry_fee}
              <Zap className="w-3.5 h-3.5" style={{ color: THEME.cyan, filter: `drop-shadow(0 0 4px ${THEME.cyan})` }} />
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: THEME.neonSoft, opacity: 0.75 }}>
              <Trophy className="inline w-2.5 h-2.5 -mt-0.5" fill={THEME.gold} style={{ color: THEME.gold }} /> Prize ₹{Math.floor(state.prize_pool || state.entry_fee * state.max_players * 0.9)}
              {state.status === 'playing' && matchLeft > 0 && <> • <Clock className="inline w-2.5 h-2.5 -mt-0.5" /> {fmtTime(matchLeft)}</>}
            </p>
          </div>
          {state.status === 'playing' && (
            <>
              {/* Emoji quick-open button */}
              <button
                onClick={() => setEmojiOpen((v) => !v)}
                data-testid="ludo-emoji-btn"
                className="p-2 rounded-xl active:scale-90 transition"
                style={{
                  background: emojiOpen ? `${THEME.neon}30` : 'rgba(59, 130, 246, 0.12)',
                  border: `1px solid ${THEME.glassBorder}`,
                  color: THEME.neonBright,
                }}
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                onClick={toggleMute}
                data-testid="ludo-mute-btn"
                className="p-2 rounded-xl active:scale-90 transition"
                style={{ background: 'rgba(59, 130, 246, 0.12)', border: `1px solid ${THEME.glassBorder}`, color: THEME.neonSoft }}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </>
          )}
          {(state.status === 'waiting' || state.status === 'playing') && (
            <button onClick={requestLeave} data-testid="ludo-leave-btn"
              className="p-2 rounded-xl active:scale-90 transition"
              style={{ background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.45)', color: '#FCA5A5' }}>
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <main className="px-3 py-4 space-y-3 relative" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* Waiting */}
        {state.status === 'waiting' && (
          <div className="rounded-2xl p-5 text-center relative overflow-hidden"
            style={{
              background: THEME.glassBg,
              border: `1px solid ${THEME.glassBorder}`,
              backdropFilter: 'blur(16px)',
              boxShadow: `0 8px 32px rgba(59, 130, 246, 0.18), inset 0 1px 0 rgba(147,197,253,0.12)`,
            }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse"
              style={{
                background: `radial-gradient(circle, ${THEME.neon}55, transparent 70%)`,
                border: `1px solid ${THEME.neonBright}`,
                boxShadow: `0 0 24px ${THEME.neon}`,
              }}>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-lg font-black" style={{ color: THEME.neonBright }}>Waiting for players...</p>
            <p className="text-sm mt-1 font-bold" style={{ color: THEME.neonSoft, opacity: 0.85 }}>{state.players.length}/{state.max_players} joined</p>
            {botFillLeft > 0 && (
              <p className="text-xs mt-2 font-black" style={{ color: THEME.gold }}>
                Auto-start in {botFillLeft}s
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
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-white text-xs shrink-0 relative"
                      style={{ background: p.color, opacity: p.forfeited ? 0.4 : 1 }}>
                      {p.name.charAt(0).toUpperCase()}
                      {p.forfeited && (
                        <span className="absolute inset-0 flex items-center justify-center text-red-500 text-base font-black">✕</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-bold truncate flex items-center gap-0.5 ${p.forfeited ? 'line-through opacity-60' : ''}`}>
                        {p.name} {isMe && <span className="text-[9px] text-emerald-400">(You)</span>}
                      </p>
                      <p className="text-[9px] text-gray-400 leading-tight">
                        {p.forfeited ? (
                          <span className="text-red-400 font-bold">Disqualified</span>
                        ) : (
                          <>Score <span className="font-bold text-white">{p.score}</span> • Home {homeCount}/4</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-skip warning banner — show when user's own skips accumulate */}
        {state.status === 'playing' && (() => {
          const me = state.players.find((p) => p.user_id === myId);
          if (!me || me.forfeited) return null;
          const skips = me.auto_skips || 0;
          if (skips === 0) return null;
          const remaining = 3 - skips;
          const isCritical = skips >= 3;
          return (
            <div
              data-testid="ludo-autoskip-warning"
              className={`rounded-xl p-2.5 border flex items-center gap-2 ${
                isCritical ? 'border-red-500/60 bg-red-500/10' : 'border-yellow-500/50 bg-yellow-500/10'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 shrink-0 ${isCritical ? 'text-red-400' : 'text-yellow-400'}`} />
              <p className={`text-[11px] font-bold ${isCritical ? 'text-red-300' : 'text-yellow-200'}`}>
                {isCritical
                  ? `⚠️ Agli baar timeout hua to aap DISQUALIFY ho jaayenge! Turant chal chalein.`
                  : `${skips}/3 auto-play used • ${remaining} aur miss allowed, uske baad aap LOSE ho jaayenge`}
              </p>
            </div>
          );
        })()}

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
          <div className="rounded-2xl p-3 relative overflow-hidden"
            style={{
              background: THEME.cardBg,
              border: `1px solid ${THEME.glassBorder}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 ${THEME.neonBright}22`,
            }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[9px] uppercase font-black tracking-widest" style={{ color: THEME.neonSoft, opacity: 0.7 }}>Turn</p>
                <p className="text-sm font-black flex items-center gap-1" style={{ color: currentPlayer?.color }}>
                  {currentPlayer?.name}
                  {isMyTurn && <span className="text-[10px] font-black" style={{ color: '#34D399' }}>(Your Turn!)</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase font-black tracking-widest" style={{ color: THEME.neonSoft, opacity: 0.7 }}>Time</p>
                <p className={`text-base font-black tabular-nums ${countdown <= 5 ? 'text-red-400' : 'text-white'}`}
                  style={countdown <= 5 ? { textShadow: '0 0 8px #EF4444' } : {}}>{countdown}s</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 py-2">
              <DiceFace value={state.pending_dice?.value || state.last_dice?.value || '?'} size={54} spinning={rolling} />
              <button
                onClick={rollDice}
                disabled={!isMyTurn || rolling || hasPending}
                data-testid="ludo-roll-btn"
                className="px-5 py-3 rounded-xl font-black text-sm disabled:opacity-40 active:scale-[0.97] transition relative overflow-hidden"
                style={{
                  background: isMyTurn && !hasPending
                    ? 'linear-gradient(135deg, #10B981, #047857)'
                    : `linear-gradient(135deg, ${THEME.bgSoft}, #050B1F)`,
                  color: '#FFF',
                  border: isMyTurn && !hasPending ? '1px solid #34D399' : `1px solid ${THEME.glassBorder}`,
                  boxShadow: isMyTurn && !hasPending
                    ? '0 6px 20px rgba(16,185,129,0.55), 0 0 12px rgba(52,211,153,0.4)'
                    : 'none',
                }}
              >
                <Dice5 className="inline w-4 h-4 -mt-0.5 mr-1" />
                {rolling ? 'Rolling...' : hasPending ? 'Pick Token' : isMyTurn ? 'ROLL' : 'Wait'}
              </button>
            </div>
            {hasPending && movable.length > 0 && (
              <p className="text-center text-[10px] font-black tracking-wider" style={{ color: THEME.gold }}>
                Choose a glowing token to move ({movable.length} available)
              </p>
            )}
          </div>
        )}

        {/* Log */}
        {(state.log || []).length > 0 && (
          <div className="rounded-xl p-2 max-h-32 overflow-y-auto"
            style={{ background: 'rgba(10, 19, 48, 0.6)', border: `1px solid ${THEME.glassBorder}` }}>
            <p className="text-[9px] uppercase tracking-widest font-black mb-1" style={{ color: THEME.neonSoft, opacity: 0.6 }}>Live Log</p>
            {(state.log || []).slice().reverse().map((e, i) => (
              <p key={i} className="text-[10px] leading-tight py-0.5" style={{ color: THEME.neonSoft, opacity: 0.85 }}>{e.msg}</p>
            ))}
          </div>
        )}
      </main>

      {/* ═══════════ 3-2-1 GO Match Start Overlay ═══════════ */}
      {matchStartCountdown > 0 && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(5, 11, 31, 0.75)', backdropFilter: 'blur(8px)' }}
          data-testid="ludo-start-countdown"
        >
          <div
            key={matchStartCountdown}
            className="ludo-countdown-pulse font-black tabular-nums"
            style={{
              fontSize: '9rem',
              lineHeight: 1,
              background: `linear-gradient(180deg, ${THEME.neonBright} 0%, ${THEME.cyan} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 30px ${THEME.neon}) drop-shadow(0 0 60px ${THEME.cyan})`,
            }}
          >
            {matchStartCountdown}
          </div>
        </div>
      )}

      {/* ═══════════ Floating Emoji Reactions ═══════════ */}
      {emojiFloats.length > 0 && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center pointer-events-none" data-testid="ludo-emoji-floats">
          <div className="flex flex-col-reverse gap-1.5 items-center">
            {emojiFloats.slice(-4).map((e) => (
              <div
                key={e.id}
                className="ludo-emoji-float flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(5, 11, 31, 0.85)',
                  border: `1px solid ${THEME.glassBorder}`,
                  backdropFilter: 'blur(8px)',
                  boxShadow: `0 4px 14px rgba(0,0,0,0.4)`,
                }}
              >
                <span className="text-lg leading-none">{e.emoji}</span>
                <span className="text-[11px] font-black" style={{ color: THEME.neonBright }}>{e.name?.split(' ')[0] || 'Player'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ Emoji Picker Popover ═══════════ */}
      {emojiOpen && state.status === 'playing' && (
        <div className="fixed inset-0 z-50" data-testid="ludo-emoji-picker">
          <div className="absolute inset-0" onClick={() => setEmojiOpen(false)} />
          <div
            className="absolute top-16 right-3 rounded-2xl p-3"
            style={{
              background: 'rgba(5, 11, 31, 0.95)',
              border: `1px solid ${THEME.glassBorder}`,
              backdropFilter: 'blur(16px)',
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${THEME.neon}40`,
            }}
          >
            <div className="grid grid-cols-4 gap-2">
              {EMOJI_LIST.map((e) => (
                <button
                  key={e}
                  onClick={() => sendEmoji(e)}
                  disabled={emojiCooldown > 0}
                  data-testid={`ludo-emoji-${e}`}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl active:scale-90 transition disabled:opacity-40"
                  style={{
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: `1px solid ${THEME.glassBorder}`,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            {emojiCooldown > 0 && (
              <p className="text-[9px] text-center mt-2 font-black tracking-widest" style={{ color: THEME.neonSoft, opacity: 0.6 }}>
                Wait {Math.ceil(emojiCooldown / 1000)}s...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Match Result Modal (with confetti) ═══════════ */}
      {showResultModal && state.status === 'completed' && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(5, 11, 31, 0.85)', backdropFilter: 'blur(12px)' }}
          data-testid="ludo-result-modal"
        >
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden relative"
            style={{
              background: `linear-gradient(160deg, ${THEME.bgSoft} 0%, ${THEME.bg} 100%)`,
              border: `1.5px solid ${state.winner_ids.includes(myId) ? THEME.gold : THEME.glassBorder}`,
              boxShadow: state.winner_ids.includes(myId)
                ? `0 20px 60px rgba(251, 191, 36, 0.4), 0 0 40px ${THEME.gold}60`
                : `0 20px 60px rgba(0,0,0,0.6), 0 0 24px ${THEME.neon}40`,
            }}
          >
            {/* Top winner banner strip */}
            <div
              className="py-4 relative overflow-hidden"
              style={{
                background: state.winner_ids.includes(myId)
                  ? `linear-gradient(135deg, ${THEME.gold} 0%, #D97706 100%)`
                  : `linear-gradient(135deg, ${THEME.neon} 0%, #1D4ED8 100%)`,
              }}
            >
              {/* diagonal sheen */}
              <div
                className="absolute inset-0 opacity-25 pointer-events-none"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,0.25) 8px 10px)',
                }}
              />
              <div className="relative flex flex-col items-center">
                <Trophy
                  className={`w-14 h-14 ${state.winner_ids.includes(myId) ? 'text-white' : 'text-white/70'}`}
                  fill={state.winner_ids.includes(myId) ? '#FFFFFF' : 'none'}
                  strokeWidth={2}
                  style={state.winner_ids.includes(myId) ? { filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.6))' } : {}}
                />
                <p className="text-2xl font-black text-white mt-2 tracking-tight">
                  {state.winner_ids.includes(myId) ? '🎉 आप जीते!' : 'Better Luck Next!'}
                </p>
                <p className="text-[11px] font-black uppercase tracking-widest text-white/85 mt-1">
                  {state.winner_ids.includes(myId) ? 'Victory Royale' : 'Match Over'}
                </p>
              </div>
            </div>

            {/* Body — winner list + prize */}
            <div className="p-5 space-y-4">
              <div className="text-center">
                <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: THEME.neonSoft, opacity: 0.7 }}>
                  Winner{state.winner_ids.length > 1 ? 's' : ''}
                </p>
                <p className="text-base font-black mt-1" style={{ color: THEME.neonBright }}>
                  {state.winner_ids.map((wid) => state.players.find((p) => p.user_id === wid)?.name).join(' • ')}
                </p>
              </div>

              {/* Prize pill */}
              <div
                className="rounded-2xl p-4 text-center relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(180, 83, 9, 0.10) 100%)`,
                  border: `1px solid ${THEME.gold}60`,
                  boxShadow: `0 0 20px rgba(251, 191, 36, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)`,
                }}
              >
                <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: THEME.gold }}>Prize Won</p>
                <p className="text-4xl font-black tabular-nums mt-1"
                  style={{ color: THEME.gold, textShadow: `0 0 24px ${THEME.gold}80` }}>
                  ₹{state.per_winner || 0}
                </p>
                {state.winner_ids.length > 1 && (
                  <p className="text-[10px] mt-1 font-bold" style={{ color: THEME.neonSoft, opacity: 0.6 }}>
                    Split among {state.winner_ids.length} winners
                  </p>
                )}
              </div>

              {/* Scoreboard */}
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: THEME.neonSoft, opacity: 0.6 }}>Final Scores</p>
                {[...state.players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, idx) => {
                  const isWinner = state.winner_ids.includes(p.user_id);
                  return (
                    <div
                      key={p.seat}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                      style={{
                        background: isWinner ? `${THEME.gold}18` : 'rgba(15, 23, 42, 0.5)',
                        border: `1px solid ${isWinner ? `${THEME.gold}55` : 'rgba(96, 165, 250, 0.15)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black w-4 text-center" style={{ color: THEME.neonSoft, opacity: 0.7 }}>
                          #{idx + 1}
                        </span>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                          style={{ background: p.color }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[12px] font-bold truncate text-white">
                          {p.name} {p.user_id === myId && <span className="text-[9px]" style={{ color: '#34D399' }}>(You)</span>}
                        </span>
                      </div>
                      <span className="text-[12px] font-black tabular-nums" style={{ color: isWinner ? THEME.gold : THEME.neonSoft }}>
                        {p.score || 0}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => navigate('/dashboard', { replace: true })}
                  data-testid="ludo-result-home"
                  className="py-3 rounded-xl font-black text-sm active:scale-[0.97] transition"
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: THEME.neonSoft,
                    border: `1px solid ${THEME.glassBorder}`,
                  }}
                >
                  Home
                </button>
                <button
                  onClick={() => navigate('/ludo', { replace: true })}
                  data-testid="ludo-play-again"
                  className="py-3 rounded-xl font-black text-white text-sm active:scale-[0.97] transition relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.neon} 0%, #1D4ED8 100%)`,
                    border: `1px solid ${THEME.neonBright}`,
                    boxShadow: `0 6px 20px ${THEME.neon}60, 0 0 12px ${THEME.neonBright}55`,
                  }}
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm-Leave modal (only when playing) */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="ludo-leave-modal"
        >
          <div className="w-full max-w-sm rounded-2xl p-5 border border-red-500/40" style={{ background: 'linear-gradient(135deg, #1F1315, #0A0A0C)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <h3 className="text-lg font-black text-red-300">Sure leave karna hai?</h3>
            </div>
            <p className="text-sm text-gray-300 leading-snug">
              Game start ho chuka hai. Ab leave karne par aap <span className="font-black text-red-400">HAAR</span> jaayenge aur entry fee ₹{state.entry_fee} bhi wapas nahi milegi.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => setShowLeaveModal(false)}
                data-testid="ludo-leave-cancel"
                className="py-2.5 rounded-xl font-black text-sm bg-white/10 text-white border border-white/20"
              >
                Rukna hai
              </button>
              <button
                onClick={doLeave}
                data-testid="ludo-leave-confirm"
                className="py-2.5 rounded-xl font-black text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #DC2626, #7F1D1D)' }}
              >
                Haan, leave karo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LudoGamePage;
