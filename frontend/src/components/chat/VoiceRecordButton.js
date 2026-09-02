import React, { useRef, useState, useEffect } from 'react';
import { Mic, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = [
    ['audio/webm;codecs=opus', 'webm'], ['audio/webm', 'webm'],
    ['audio/mp4', 'm4a'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/ogg', 'ogg'],
  ];
  for (const [m, ext] of list) if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext };
  return { mime: '', ext: 'webm' };
};

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// WhatsApp-style: hold to record, release to send, slide left to cancel.
export const VoiceRecordButton = ({ onRecorded, onRecordingChange, disabled, size = 44, color = '#25D366', testId = 'chat-mic-btn' }) => {
  const [recording, setRecording] = useState(false);
  const [time, setTime] = useState(0);
  const [dragX, setDragX] = useState(0);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelRef = useRef(false);
  const startXRef = useRef(0);
  const timerRef = useRef(null);
  const extRef = useRef('webm');
  const startedAtRef = useRef(0);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const start = async (e) => {
    if (disabled || recording) return;
    e.preventDefault();
    startXRef.current = e.clientX;
    cancelRef.current = false;
    setDragX(0);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      toast.error('Mic permission do — Settings me microphone allow karo');
      return;
    }
    const picked = pickMime();
    if (!picked) { toast.error('Is browser me voice recording support nahi hai'); stream.getTracks().forEach(t => t.stop()); return; }
    extRef.current = picked.ext;
    const rec = picked.mime ? new MediaRecorder(stream, { mimeType: picked.mime }) : new MediaRecorder(stream);
    recRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(timerRef.current);
      setRecording(false);
      onRecordingChange?.(false);
      setTime(0);
      setDragX(0);
      const dur = (Date.now() - startedAtRef.current) / 1000;
      if (cancelRef.current) return;
      if (dur < 0.7 || chunksRef.current.length === 0) { toast('Bolne ke liye mic ko dabaye rakho', { duration: 1500 }); return; }
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || picked.mime || 'audio/webm' });
      onRecorded(blob, extRef.current, Math.round(dur));
    };
    startedAtRef.current = Date.now();
    rec.start(250);
    setRecording(true);
    onRecordingChange?.(true);
    setTime(0);
    timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    try { navigator.vibrate?.(30); } catch (_) { /* ignore */ }
  };

  const move = (e) => {
    if (!recording) return;
    const dx = Math.min(0, e.clientX - startXRef.current);
    setDragX(dx);
    if (dx < -90) { cancelRef.current = true; stop(); toast('Recording cancel', { duration: 1200 }); }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  };

  return (
    <div className={`flex items-center gap-2 justify-end select-none ${recording ? 'flex-1' : ''}`} style={{ touchAction: 'none' }}>
      {recording && (
        <div
          className="flex-1 flex items-center gap-2 rounded-full px-3 py-2 overflow-hidden"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
          data-testid="chat-recording-bar"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-red-400 text-sm font-mono shrink-0">{fmt(time)}</span>
          <span
            className="text-gray-300 text-xs flex items-center gap-1 ml-auto transition-transform"
            style={{ transform: `translateX(${dragX}px)`, opacity: Math.max(0.2, 1 + dragX / 100) }}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" /> ← Slide to cancel
          </span>
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={() => { cancelRef.current = true; stop(); }}
        onContextMenu={(e) => e.preventDefault()}
        className="rounded-full flex items-center justify-center shadow-lg transition-transform shrink-0"
        style={{
          width: size, height: size, background: recording ? '#EF4444' : color,
          transform: recording ? 'scale(1.35)' : 'scale(1)', touchAction: 'none',
          WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        }}
        aria-label="Hold to record voice"
        data-testid={testId}
      >
        <Mic className="text-white" style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default VoiceRecordButton;
