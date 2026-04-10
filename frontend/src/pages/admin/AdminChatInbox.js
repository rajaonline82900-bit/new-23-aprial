import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowLeft, Image, Check, CheckCheck } from 'lucide-react';

const AdminChatInbox = ({ API }) => {
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

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
    const interval = setInterval(fetchChatUsers, 10000);
    return () => clearInterval(interval);
  }, []);

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
        <Button variant="ghost" onClick={() => { setSelectedUser(null); setMessages([]); fetchChatUsers(); }} className="text-gray-400 hover:text-white mb-2" data-testid="chat-back">
          <ArrowLeft className="w-4 h-4 mr-2" /> {selectedUser.user_name} ({selectedUser.user_phone})
        </Button>
        <div className="bg-[#0A0A0C] rounded-xl border border-white/10 p-3 h-[400px] overflow-y-auto">
          {messages.map(msg => (
            <div key={msg.id} className={`flex mb-2 ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${msg.sender === 'admin' ? 'bg-[#D4AF37] text-black rounded-br-md' : 'bg-[#1E1E24] text-white rounded-bl-md border border-white/10'}`}>
                {renderMsgContent(msg)}
                <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${msg.sender === 'admin' ? 'text-black/50' : 'text-gray-500'}`}>
                  <span className="text-[9px]">{formatTime(msg.created_at)}</span>
                  {renderTicks(msg)}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={sending} className="text-gray-400 hover:text-white border border-white/10" data-testid="admin-chat-image-btn">
            <Image className="w-4 h-4" />
          </Button>
          <Input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReply()} placeholder="Reply type karein..." className="bg-[#0A0A0C] border-white/10 text-white flex-1" data-testid="admin-chat-reply-input" />
          <Button onClick={handleReply} disabled={!reply.trim() || sending} className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black font-bold" data-testid="admin-chat-reply-btn">Send</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-white font-bold text-base">User Chats ({chatUsers.length})</h3>
      {chatUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Koi chat nahi hai</div>
      ) : chatUsers.map(u => (
        <Card key={u.user_id} className="bg-[#141418] border-white/10 cursor-pointer hover:border-[#D4AF37]/50 transition-all" onClick={() => setSelectedUser(u)} data-testid={`chat-user-${u.user_id}`}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                <span className="text-[#D4AF37] font-bold">{u.user_name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">{u.user_name}</p>
                <p className="text-gray-500 text-xs">{u.user_phone}</p>
                <p className="text-gray-400 text-xs truncate max-w-[200px]">{u.last_message}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-gray-600 text-[10px]">{formatTime(u.last_time)}</p>
              {u.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold flex items-center justify-center">{u.unread}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminChatInbox;
