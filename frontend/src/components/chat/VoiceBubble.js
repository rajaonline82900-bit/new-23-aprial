import React, { useRef, useState } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const VoiceBubble = ({ src, mine, testId }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const [err, setErr] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play().catch(() => setErr(true)); }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
  };

  return (
    <div className="flex items-center gap-2 min-w-[190px] py-1" data-testid={testId}>
      <audio
        ref={audioRef} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => setProgress(e.target.currentTime)}
        onLoadedMetadata={(e) => setDur(isFinite(e.target.duration) ? e.target.duration : 0)}
        onDurationChange={(e) => setDur(isFinite(e.target.duration) ? e.target.duration : 0)}
        onError={() => setErr(true)}
      />
      <button onClick={toggle} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: mine ? 'rgba(255,255,255,0.15)' : 'rgba(37,211,102,0.2)' }} data-testid="voice-play-btn">
        {playing ? <Pause className="w-4 h-4 text-white fill-white" /> : <Play className="w-4 h-4 text-white fill-white translate-x-[1px]" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 rounded-full cursor-pointer" style={{ background: 'rgba(255,255,255,0.2)' }} onClick={seek}>
          <div className="h-1.5 rounded-full" style={{ width: `${dur ? (progress / dur) * 100 : 0}%`, background: '#25D366', transition: 'width 0.2s linear' }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'rgba(233,237,239,0.65)' }}>
          <span>{err ? 'Play nahi ho saka' : fmt(playing ? progress : dur)}</span>
          <Mic className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};

export default VoiceBubble;
