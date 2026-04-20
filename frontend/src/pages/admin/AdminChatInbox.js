import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowLeft, Image, Check, CheckCheck, Mic, Square, Trash2, Clock, Settings } from 'lucide-react';

const AdminChatInbox = ({ API }) => {
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [autoDel, setAutoDel] = useState({ enabled: false, hours: 24 });
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const fetchChatUsers = async () => {
    try {
      const res = await axios.get(`${API}/api/admin/chat/users`, { withCredentials: true });
      setChatUsers(res.data.users || []);
    } catch (err) { console.error(err); }
  };

  const fetchMessages = async (userId) => {
    try {
      const res = await axios.get(`${API}/api/admin/chat/messages/${userId}`, { withCredentials: true });
      setMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchChatUsers();
    fetchAutoDel();
    const interval = setInterval(fetchChatUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAutoDel = async () => {
    try {
      const res = await axios.get(`${API}/api/admin/chat/auto-delete-setting`, { withCredentials: true });
      setAutoDel({ enabled: res.data.enabled, hours: res.data.hours });
    } catch (err) { console.error(err); }
  };

  const saveAutoDel = async (enabled, hours) => {
    try {
      await axios.post(`${API}/api/admin/chat/auto-delete-setting`, { enabled, hours }, { withCredentials: true });
      setAutoDel({ enabled, hours });
    } catch (err) { console.error(err); alert('Failed to save setting'); }
  };

  const deleteAllChats = async () => {
    if (!window.confirm('Delete ALL chat messages from ALL users? Yeh action undo nahi hoga!')) return;
    try {
      const res = await axios.delete(`${API}/api/admin/chat/clear-all`, { withCredentials: true });
      alert(res.data.message || 'All chats deleted');
      fetchChatUsers();
      setMessages([]);
    } catch (err) { console.error(err); alert('Failed to delete'); }
  };

  const deleteUserChat = async (userId, userName) => {
    if (!window.confirm(`Delete all messages for ${userName}?`)) return;
    try {
      await axios.delete(`${API}/api/admin/chat/user/${userId}`, { withCredentials: true });
      fetchChatUsers();
      if (selectedUser?.user_id === userId) { setSelectedUser(null); setMessages([]); }
    } catch (err) { console.error(err); alert('Failed to delete'); }
  };

  const deleteOneMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await axios.delete(`${API}/api/admin/chat/message/${msgId}`, { withCredentials: true });
      if (selectedUser) fetchMessages(selectedUser.user_id);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.user_id);
      const interval = setInterval(() => fetchMessages(selectedUser.user_id), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = async () => {
    if (!reply.trim() || !selectedUser || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/api/admin/chat/reply/${selectedUser.user_id}`, { message: reply.trim(), msg_type: 'text' }, { withCredentials: true });
      setReply(''); fetchMessages(selectedUser.user_id);
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post(`${API}/api/chat/upload`, formData, { withCredentials: true });
      await axios.post(`${API}/api/admin/chat/reply/${selectedUser.user_id}`, { message: '', msg_type: 'image', attachment_url: uploadRes.data.url }, { withCredentials: true });
      fetchMessages(selectedUser.user_id);
    } catch (err) { console.error(err); }
    finally { setSending(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500 || !selectedUser) return;
        setSending(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, `voice_${Date.now()}.webm`);
          const uploadRes = await axios.post(`${API}/api/chat/upload`, formData, { withCredentials: true });
          await axios.post(`${API}/api/admin/chat/reply/${selectedUser.user_id}`, { message: '', msg_type: 'voice', attachment_url: uploadRes.data.url }, { withCredentials: true });
          fetchMessages(selectedUser.user_id);
        } catch (err) { console.error(err); }
        finally { setSending(false); }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { console.error('Mic access denied:', err); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const renderMsgContent = (msg) => {
    const type = msg.msg_type || 'text';
    if (type === 'image' && msg.attachment_url) return <img src={`${API}${msg.attachment_url}`} alt="photo" className="rounded-lg max-w-full max-h-[200px] object-cover" loading="lazy" />;
    if (type === 'voice' && msg.attachment_url) return <audio controls src={`${API}${msg.attachment_url}`} className="max-w-[220px]" preload="none" />;
    return <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>;
  };

  const renderTicks = (msg) => {
    if (msg.sender !== 'admin') return null;
    return msg.read ? <CheckCheck className="w-3.5 h-3.5 text-blue-400 inline-block ml-1" /> : <Check className="w-3 h-3 text-black/40 inline-block ml-1" />;
  };

  if (selectedUser) {
    return (
      <div className="space-y-3">
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" onClick={() => { setSelectedUser(null); setMessages([]); fetchChatUsers(); }} className="text-gray-400 hover:text-white" data-testid="chat-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> {selectedUser.user_name} ({selectedUser.user_phone})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => deleteUserChat(selectedUser.user_id, selectedUser.user_name)} className="text-red-400 hover:text-red-300 border border-red-500/30" data-testid="admin-chat-delete-user">
            <Trash2 className="w-4 h-4 mr-1" /> Clear Chat
          </Button>
        </div>
        <div className="bg-[#0A0A0C] rounded-xl border border-white/10 p-3 h-[400px] overflow-y-auto">
          {messages.map(msg => (
            <div key={msg.id} className={`flex mb-2 group ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl relative ${msg.sender === 'admin' ? 'bg-[#D4AF37] text-black rounded-br-md' : 'bg-[#1E1E24] text-white rounded-bl-md border border-white/10'}`}>
                <button onClick={() => deleteOneMessage(msg.id)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex" title="Delete" data-testid={`admin-msg-delete-${msg.id}`}>
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
                {renderMsgContent(msg)}
                <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${msg.sender === 'admin' ? 'text-black/50' : 'text-gray-400'}`}>
                  <span className="text-[9px]">{formatTime(msg.created_at)}</span>
                  {renderTicks(msg)}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={sending || isRecording} className="text-gray-400 hover:text-white border border-white/10" data-testid="admin-chat-image-btn">
            <Image className="w-4 h-4" />
          </Button>
          {isRecording ? (
            <>
              <div className="flex items-center gap-2 flex-1 px-3 bg-red-50 rounded-lg border border-red-200">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-red-600 text-sm font-medium">{Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
              </div>
              <Button onClick={stopRecording} className="bg-red-500 hover:bg-red-600 text-white" data-testid="admin-chat-stop-recording">
                <Square className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={startRecording} disabled={sending} className="text-gray-400 hover:text-white border border-white/10" data-testid="admin-chat-mic-btn">
                <Mic className="w-4 h-4" />
              </Button>
              <Input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()} placeholder="Reply type karein..." className="bg-[#0A0A0C] border-white/10 text-white flex-1" data-testid="admin-chat-reply-input" />
              <Button onClick={handleReply} disabled={!reply.trim() || sending} className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-bold" data-testid="admin-chat-reply-btn">Send</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-base">User Chats ({chatUsers.length})</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-gray-300 hover:text-white border border-white/10" data-testid="admin-chat-settings-btn">
            <Settings className="w-4 h-4 mr-1" /> Auto-Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={deleteAllChats} className="text-red-400 hover:text-red-300 border border-red-500/30" data-testid="admin-chat-clear-all">
            <Trash2 className="w-4 h-4 mr-1" /> Clear All
          </Button>
        </div>
      </div>
      {showSettings && (
        <Card className="bg-[#141418] border-white/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-gray-300 text-sm"><Clock className="w-4 h-4 text-[#D4AF37]" /> Daily Auto-Delete Settings</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-white text-sm">
                <input type="checkbox" checked={autoDel.enabled} onChange={e => saveAutoDel(e.target.checked, autoDel.hours)} data-testid="admin-chat-autodel-toggle" className="w-4 h-4 accent-[#D4AF37]" />
                Enable auto-delete
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">Older than</span>
                <Input type="number" min="1" value={autoDel.hours} onChange={e => setAutoDel({...autoDel, hours: parseInt(e.target.value) || 1})} onBlur={() => saveAutoDel(autoDel.enabled, autoDel.hours)} className="bg-[#0A0A0C] border-white/10 text-white w-20 h-8 text-sm" data-testid="admin-chat-autodel-hours" />
                <span className="text-gray-400 text-xs">hours</span>
              </div>
            </div>
            <p className="text-gray-500 text-[11px]">Background job deletes messages older than set hours every 1 hour. Default: 24h.</p>
          </CardContent>
        </Card>
      )}
      {chatUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Koi chat nahi hai</div>
      ) : chatUsers.map(u => (
        <Card key={u.user_id} className="bg-[#141418] border-white/10 cursor-pointer hover:border-[#D4AF37]/50 transition-all" data-testid={`chat-user-${u.user_id}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div onClick={() => setSelectedUser(u)} className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                <span className="text-[#D4AF37] font-bold">{u.user_name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">{u.user_name}</p>
                <p className="text-gray-400 text-xs">{u.user_phone}</p>
                <p className="text-gray-400 text-xs truncate max-w-[200px]">{u.last_message}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-gray-600 text-[10px]">{formatTime(u.last_time)}</p>
              {u.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold flex items-center justify-center">{u.unread}</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); deleteUserChat(u.user_id, u.user_name); }} className="text-red-400 hover:text-red-300 p-1" title="Delete chat" data-testid={`chat-user-delete-${u.user_id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminChatInbox;
