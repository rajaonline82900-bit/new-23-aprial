import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const VideoManager = ({ kind, title }) => {
  const [url, setUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchUrl = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/help-videos/${kind}`);
      setSavedUrl(r.data.url);
      setUrl(r.data.url || '');
    } catch { /* noop */ }
  };
  useEffect(() => { fetchUrl(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!url.trim()) { toast.error('URL required'); return; }
    setBusy(true);
    try {
      await axios.post(`${API_URL}/api/admin/help-videos/${kind}`, { url: url.trim() }, { withCredentials: true });
      toast.success(`${title} video saved`);
      fetchUrl();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
    setBusy(false);
  };

  const del = async () => {
    if (!savedUrl) return;
    if (!window.confirm(`Delete ${title} video?`)) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/api/admin/help-videos/${kind}`, { withCredentials: true });
      toast.success(`${title} video deleted`);
      setUrl('');
      setSavedUrl(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
    setBusy(false);
  };

  // Preview
  let previewNode = null;
  if (savedUrl) {
    const ytMatch = savedUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    const isVideoFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(savedUrl);
    if (ytMatch) {
      previewNode = <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} title="preview" className="w-full aspect-video rounded-lg" frameBorder="0" allowFullScreen />;
    } else if (isVideoFile) {
      previewNode = <video src={savedUrl} controls className="w-full aspect-video rounded-lg bg-black" />;
    } else {
      previewNode = <a href={savedUrl} target="_blank" rel="noreferrer" className="text-yellow-300 text-xs underline break-all">{savedUrl}</a>;
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#141418', border: '1px solid rgba(255,215,0,0.25)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-black text-lg text-yellow-300">▶ {title} Video</h3>
        {savedUrl && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background: '#22C55E', color: '#0A0A14' }}>ACTIVE</span>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        Paste YouTube video/shorts URL, or direct .mp4/.webm link. User ko {kind === 'deposit' ? 'Add Funds' : 'Withdraw'} dialog mein "How to {kind === 'deposit' ? 'Deposit' : 'Withdraw'}?" button pe click karte hi play hoga.
      </p>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
        data-testid={`video-url-${kind}`}
        className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
        style={{ background: '#0A0A14', border: '1.5px solid rgba(255,215,0,0.35)' }}
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} data-testid={`video-save-${kind}`}
          className="flex-1 py-2 rounded-lg font-black text-sm text-black active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(180deg, #FBBF24 0%, #B45309 100%)' }}>
          {busy ? '...' : (savedUrl ? 'Update' : 'Save')}
        </button>
        {savedUrl && (
          <button onClick={del} disabled={busy} data-testid={`video-delete-${kind}`}
            className="px-4 py-2 rounded-lg font-black text-sm text-white active:scale-95 disabled:opacity-50"
            style={{ background: '#DC2626' }}>
            Delete
          </button>
        )}
      </div>
      {previewNode && (
        <div className="mt-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Preview</p>
          {previewNode}
        </div>
      )}
    </div>
  );
};

const AdminHelpVideosTab = () => (
  <div className="space-y-4">
    <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.08)', border: '1px dashed rgba(212,175,55,0.4)' }}>
      <p className="text-yellow-300 font-black text-sm">Help Videos Management</p>
      <p className="text-[11px] text-yellow-200/70 mt-1">Yahan se app ke andar Deposit aur Withdraw pages pe dikhne wale "How to..." video guides add / update / delete kar sakte ho.</p>
    </div>
    <VideoManager kind="deposit" title="How to Deposit" />
    <VideoManager kind="withdraw" title="How to Withdraw" />
  </div>
);

export default AdminHelpVideosTab;
