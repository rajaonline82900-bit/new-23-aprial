import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Image, Check, CheckCheck, Trash2, Clock, Send, Search, MoreVertical } from 'lucide-react';
import { VoiceRecordButton } from '../../components/chat/VoiceRecordButton';
import { VoiceBubble } from '../../components/chat/VoiceBubble';

const WA = { bg: '#0B141A', panel: '#111B21', header: '#202C33', mine: '#005C4B', theirs: '#202C33', green: '#25D366', text: '#E9EDEF', muted: '#8696A0' };
const PAPER = 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22 fill=%22none%22><path d=%22M0 100 L20 80 L40 100 L20 120 Z M40 60 L60 40 L80 60 L60 80 Z M120 100 L140 80 L160 100 L140 120 Z M160 40 L180 20 L200 40 L180 60 Z M80 140 L100 120 L120 140 L100 160 Z%22 fill=%22%2317262E%22 opacity=%220.4%22/></svg>")';

const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtDay = (d) => {
  const x = new Date(d), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
  if (x.toDateString() === t.toDateString()) return 'TODAY';
  if (x.toDateString() === y.toDateString()) return 'YESTERDAY';
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtListTime = (d) => {
  const x = new Date(d), t = new Date();
  return x.toDateString() === t.toDateString() ? fmtTime(d) : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
const errMsg = (e) => e?.response?.data?.detail || e?.message || 'Network error';

const Avatar = ({ name, size = 44 }) => (
  <div className="rounded-full flex items-center justify-center shrink-0 font-bold text-white" style={{ width: size, height: size, background: '#6B7C85', fontSize: size * 0.4 }}>
    {name?.charAt(0)?.toUpperCase() || 'U'}
  </div>
);

const AdminChatInbox = ({ API }) => {
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [autoDel, setAutoDel] = useState({ enabled: false, hours: 24 });
  const [selectedMsg, setSelectedMsg] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const cfg = { withCredentials: true };

  const fetchChatUsers = async () => {
    try { const r = await axios.get(`${API}/api/admin/chat/users`, cfg); setChatUsers(r.data.users || []); } catch (e) { console.error(e); }
  };
  const fetchMessages = async (uid) => {
    try { const r = await axios.get(`${API}/api/admin/chat/messages/${uid}`, cfg); setMessages(r.data.messages || []); } catch (e) { console.error(e); }
  };
  const fetchAutoDel = async () => {
    try { const r = await axios.get(`${API}/api/admin/chat/auto-delete-setting`, cfg); setAutoDel({ enabled: r.data.enabled, hours: r.data.hours }); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchChatUsers(); fetchAutoDel();
    const iv = setInterval(fetchChatUsers, 8000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    fetchMessages(selectedUser.user_id);
    const iv = setInterval(() => fetchMessages(selectedUser.user_id), 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const saveAutoDel = async (enabled, hours) => {
    try { await axios.post(`${API}/api/admin/chat/auto-delete-setting`, { enabled, hours }, cfg); setAutoDel({ enabled, hours }); toast.success('Saved'); }
    catch (e) { toast.error('Save fail'); }
  };
  const deleteAllChats = async () => {
    if (!window.confirm('Sabhi users ki poori chat delete? Undo nahi hoga!')) return;
    try { const r = await axios.delete(`${API}/api/admin/chat/clear-all`, cfg); toast.success(r.data.message); fetchChatUsers(); setMessages([]); } catch (e) { toast.error('Delete fail'); }
  };
  const deleteUserChat = async (uid, name) => {
    if (!window.confirm(`${name} ki poori chat delete?`)) return;
    try { await axios.delete(`${API}/api/admin/chat/user/${uid}`, cfg); fetchChatUsers(); if (selectedUser?.user_id === uid) { setSelectedUser(null); setMessages([]); } } catch (e) { toast.error('Delete fail'); }
  };
  const deleteOneMessage = async (id) => {
    try { await axios.delete(`${API}/api/admin/chat/message/${id}`, cfg); setSelectedMsg(null); if (selectedUser) fetchMessages(selectedUser.user_id); } catch (e) { toast.error('Delete fail'); }
  };

  const sendReply = async (payload) => {
    if (!selectedUser) return;
    await axios.post(`${API}/api/admin/chat/reply/${selectedUser.user_id}`, payload, cfg);
    fetchMessages(selectedUser.user_id);
  };
  const handleReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try { await sendReply({ message: reply.trim(), msg_type: 'text' }); setReply(''); } catch (e) { toast.error(`Send fail: ${errMsg(e)}`); }
    setSending(false);
  };
  const uploadAndSend = async (file, type, filename) => {
    setSending(true);
    const tid = toast.loading(type === 'image' ? 'Photo bhej rahe hain…' : 'Voice bhej rahe hain…');
    try {
      const fd = new FormData();
      if (filename) fd.append('file', file, filename); else fd.append('file', file);
      const up = await axios.post(`${API}/api/chat/upload`, fd, { ...cfg, timeout: 60000 });
      await sendReply({ message: '', msg_type: type, attachment_url: up.data.url });
      toast.success('Sent', { id: tid, duration: 1200 });
    } catch (e) { toast.error(`Send fail: ${errMsg(e)}`, { id: tid }); }
    setSending(false);
  };
  const handleImageUpload = async (e) => {
    const f = e.target.files?.[0];
    if (f) await uploadAndSend(f, 'image');
    e.target.value = '';
  };

  const renderContent = (m) => {
    const t = m.msg_type || 'text';
    if (t === 'image' && m.attachment_url) return <a href={`${API}${m.attachment_url}`} target="_blank" rel="noreferrer"><img src={`${API}${m.attachment_url}`} alt="photo" className="rounded-lg max-w-full max-h-[240px] object-cover" loading="lazy" /></a>;
    if (t === 'voice' && m.attachment_url) return <VoiceBubble src={`${API}${m.attachment_url}`} mine={m.sender === 'admin'} testId={`admin-voice-${m.id}`} />;
    return <p className="text-[14px] whitespace-pre-wrap break-words leading-snug">{m.message}</p>;
  };
  const ticks = (m) => m.sender !== 'admin' ? null : (m.read
    ? <CheckCheck className="w-3.5 h-3.5 inline-block ml-0.5" style={{ color: '#53BDEB' }} />
    : <Check className="w-3 h-3 inline-block ml-0.5 text-gray-400" />);

  // ───────────── Conversation view ─────────────
  if (selectedUser) {
    let lastDay = '';
    return (
      <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: WA.bg, height: 'calc(100vh - 140px)', minHeight: 520 }} data-testid="admin-chat-conversation">
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" data-testid="admin-chat-file-input" />
        <div className="flex items-center gap-2 px-2 py-2 shrink-0" style={{ background: WA.header }}>
          <button onClick={() => { setSelectedUser(null); setMessages([]); fetchChatUsers(); }} className="p-1.5 rounded-full text-white active:bg-white/10" data-testid="chat-back"><ArrowLeft className="w-5 h-5" /></button>
          <Avatar name={selectedUser.user_name} size={38} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[15px] truncate">{selectedUser.user_name}</p>
            <p className="text-[11px] truncate" style={{ color: WA.muted }}>{selectedUser.user_phone}</p>
          </div>
          <button onClick={() => deleteUserChat(selectedUser.user_id, selectedUser.user_name)} className="p-2 rounded-full text-red-400 active:bg-white/10" title="Clear chat" data-testid="admin-chat-delete-user"><Trash2 className="w-[18px] h-[18px]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2" style={{ backgroundImage: PAPER, backgroundSize: '200px 200px' }}>
          {messages.map((m) => {
            const day = fmtDay(m.created_at);
            const showDay = day !== lastDay; lastDay = day;
            const mine = m.sender === 'admin';
            return (
              <React.Fragment key={m.id}>
                {showDay && <div className="flex justify-center my-2"><span className="text-[11px] px-3 py-1 rounded-md" style={{ background: '#1F2B33', color: '#B4C4CE' }}>{day}</span></div>}
                <div className={`flex mb-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="relative max-w-[75%] px-2.5 py-1.5 cursor-pointer"
                    style={{ background: mine ? WA.mine : WA.theirs, color: WA.text, borderRadius: mine ? '8px 8px 0 8px' : '8px 8px 8px 0', boxShadow: '0 1px 0.5px rgba(0,0,0,0.3)' }}
                    onContextMenu={(e) => { e.preventDefault(); setSelectedMsg(m); }}
                    onDoubleClick={() => setSelectedMsg(m)}
                    data-testid={`admin-msg-${m.id}`}
                  >
                    <span className="absolute top-0 w-0 h-0" style={mine ? { right: -6, borderTop: `8px solid ${WA.mine}`, borderRight: '6px solid transparent' } : { left: -6, borderTop: `8px solid ${WA.theirs}`, borderLeft: '6px solid transparent' }} />
                    {renderContent(m)}
                    <div className="flex items-center justify-end gap-0.5 mt-0.5 -mb-0.5">
                      <span className="text-[10px]" style={{ color: 'rgba(233,237,239,0.6)' }}>{fmtTime(m.created_at)}</span>
                      {ticks(m)}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="px-2 py-2 shrink-0" style={{ background: WA.header }}>
          <div className="flex items-center gap-1.5">
            {!isRecording && (
              <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ color: '#AEBAC1' }} data-testid="admin-chat-image-btn"><Image className="w-5 h-5" /></button>
            )}
            {!isRecording && (
              <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()} placeholder="Type a message" className="flex-1 min-w-0 rounded-full px-4 py-2.5 text-white text-sm focus:outline-none placeholder-gray-500" style={{ background: '#2A3942' }} data-testid="admin-chat-reply-input" />
            )}
            {reply.trim() ? (
              <button onClick={handleReply} disabled={sending} className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg shrink-0" style={{ background: WA.green }} data-testid="admin-chat-reply-btn"><Send className="w-4 h-4 text-white translate-x-[1px]" /></button>
            ) : (
              <VoiceRecordButton onRecorded={(blob, ext) => uploadAndSend(blob, 'voice', `voice_${Date.now()}.${ext}`)} onRecordingChange={setIsRecording} disabled={sending} testId="admin-chat-mic-btn" />
            )}
          </div>
          <p className="text-center text-[10px] mt-1" style={{ color: 'rgba(174,186,193,0.5)' }}>Mic dabaye rakho → bolo → chhodo = send · Message pe right-click/double-click = delete</p>
        </div>

        {selectedMsg && (
          <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={() => setSelectedMsg(null)} data-testid="admin-chat-delete-modal">
            <div className="rounded-2xl p-4 w-full max-w-sm" style={{ background: WA.header }} onClick={e => e.stopPropagation()}>
              <p className="text-white font-bold text-sm mb-2">Delete message?</p>
              <p className="text-gray-400 text-xs mb-4 truncate">{selectedMsg.msg_type === 'image' ? 'Photo' : selectedMsg.msg_type === 'voice' ? 'Voice message' : selectedMsg.message}</p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedMsg(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-300 border border-white/10">Cancel</button>
                <button onClick={() => deleteOneMessage(selectedMsg.id)} className="flex-1 py-2 rounded-lg text-sm bg-red-500 text-white font-bold flex items-center justify-center gap-1" data-testid="admin-msg-delete-confirm"><Trash2 className="w-4 h-4" /> Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ───────────── Chat list view ─────────────
  const list = chatUsers.filter(u => !search || u.user_name?.toLowerCase().includes(search.toLowerCase()) || (u.user_phone || '').includes(search));
  const totalUnread = chatUsers.reduce((s, u) => s + (u.unread || 0), 0);

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: WA.panel, height: 'calc(100vh - 140px)', minHeight: 520 }} data-testid="admin-chat-list">
      <div className="px-3 py-3 flex items-center justify-between shrink-0" style={{ background: WA.header }}>
        <div>
          <p className="text-white font-bold text-lg leading-tight">Chats</p>
          <p className="text-[11px]" style={{ color: WA.muted }}>{chatUsers.length} users{totalUnread ? ` · ${totalUnread} unread` : ''}</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full text-white active:bg-white/10" data-testid="admin-chat-settings-btn"><MoreVertical className="w-5 h-5" /></button>
          {showMenu && (
            <div className="absolute right-0 top-10 w-64 rounded-xl shadow-2xl z-20 p-3 space-y-3" style={{ background: '#233138', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 text-gray-200 text-sm"><Clock className="w-4 h-4" style={{ color: WA.green }} /> Auto-delete</div>
              <label className="flex items-center gap-2 text-white text-sm">
                <input type="checkbox" checked={autoDel.enabled} onChange={e => saveAutoDel(e.target.checked, autoDel.hours)} className="w-4 h-4 accent-[#25D366]" data-testid="admin-chat-autodel-toggle" /> Enable
              </label>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                Older than
                <input type="number" min="1" value={autoDel.hours} onChange={e => setAutoDel({ ...autoDel, hours: parseInt(e.target.value) || 1 })} onBlur={() => saveAutoDel(autoDel.enabled, autoDel.hours)} className="w-16 h-8 rounded px-2 text-white text-sm" style={{ background: '#111B21' }} data-testid="admin-chat-autodel-hours" />
                hours
              </div>
              <button onClick={deleteAllChats} className="w-full py-2 rounded-lg text-sm bg-red-500/90 text-white font-semibold flex items-center justify-center gap-1" data-testid="admin-chat-clear-all"><Trash2 className="w-4 h-4" /> Clear all chats</button>
            </div>
          )}
        </div>
      </div>
      <div className="px-3 py-2 shrink-0" style={{ background: WA.panel }}>
        <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: '#202C33' }}>
          <Search className="w-4 h-4" style={{ color: WA.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone" className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-gray-500" data-testid="admin-chat-search" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: WA.muted }}>Koi chat nahi hai</div>
        ) : list.map(u => (
          <div key={u.user_id} onClick={() => setSelectedUser(u)} className="flex items-center gap-3 px-3 py-3 cursor-pointer active:bg-white/5 hover:bg-white/5" style={{ borderBottom: '1px solid rgba(134,150,160,0.12)' }} data-testid={`chat-user-${u.user_id}`}>
            <Avatar name={u.user_name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-white font-semibold text-[15px] truncate">{u.user_name}</p>
                <span className="text-[11px] shrink-0" style={{ color: u.unread ? WA.green : WA.muted }}>{fmtListTime(u.last_time)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-[13px] truncate" style={{ color: WA.muted }}>{u.user_phone ? `${u.user_phone} · ` : ''}{u.last_message}</p>
                {u.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full text-black text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: WA.green }} data-testid={`chat-unread-${u.user_id}`}>{u.unread}</span>}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteUserChat(u.user_id, u.user_name); }} className="p-1.5 text-gray-500 hover:text-red-400" title="Delete chat" data-testid={`chat-user-delete-${u.user_id}`}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminChatInbox;
