import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted } from '../utils/casinoFx';

/**
 * SoundToggle — small speaker icon button. Persists mute state in localStorage.
 * Emits a `shiv-shakti-mute-changed` window event so multiple mounts stay in sync.
 */
const SoundToggle = ({ className = '' }) => {
  const [muted, setLocalMuted] = useState(isMuted());

  useEffect(() => {
    const sync = () => setLocalMuted(isMuted());
    window.addEventListener('shiv-shakti-mute-changed', sync);
    return () => window.removeEventListener('shiv-shakti-mute-changed', sync);
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setLocalMuted(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      data-testid="sound-toggle-btn"
      className={`p-2 rounded-lg active:scale-95 transition-all ${className}`}
      style={{
        background: muted ? 'rgba(127, 29, 29, 0.35)' : 'rgba(20, 169, 76, 0.15)',
        border: `1px solid ${muted ? 'rgba(248,113,113,0.5)' : 'rgba(34,197,94,0.45)'}`,
      }}
    >
      {muted
        ? <VolumeX className="w-4 h-4 text-red-400" />
        : <Volume2 className="w-4 h-4 text-emerald-400" />}
    </button>
  );
};

export default SoundToggle;
