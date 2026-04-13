import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { MessageCircle, Send, ArrowLeft, Image, Mic, Square, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FooterNav from '../components/FooterNav';

const API = process.env.REACT_APP_BACKEND_URL;

const ChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const getToken = () => document.cookie.match(/access_token=([^;]+)/)?.[1] || localStorage.getItem('matka11_token');
  const headers = { Authorization: `Bearer ${getToken()}` };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/api/chat/messages`, { headers });
      setMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendTextMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/api/chat/send`, { message: input.trim(), msg_type: 'text' }, { headers });
      setInput('');
      fetchMessages();
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await axios.post(`${API}/api/chat/upload`, formData, { headers });
      await axios.post(`${API}/api/chat/send`, {
        message: '', msg_type: 'image', attachment_url: uploadRes.data.url
      }, { headers });
      fetchMessages();
    } catch (err) { console.error(err); }
    finally { setSending(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setSending(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'voice.webm');
          const uploadRes = await axios.post(`${API}/api/chat/upload`, formData, { headers });
          await axios.post(`${API}/api/chat/send`, {
            message: '', msg_type: 'voice', attachment_url: uploadRes.data.url
          }, { headers });
          fetchMessages();
        } catch (err) { console.error(err); }
        finally { setSending(false); }
      };
      mediaRecorder.start();
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' });
  const formatRecordTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const renderTicks = (msg) => {
    if (msg.sender !== 'user') return null;
    return msg.read ? (
      <CheckCheck className="w-3.5 h-3.5 text-blue-400 inline-block ml-1" />
    ) : (
      <Check className="w-3 h-3 text-black/40 inline-block ml-1" />
    );
  };

  const renderMsgContent = (msg) => {
    const type = msg.msg_type || 'text';
    if (type === 'image' && msg.attachment_url) {
      return <img src={`${API}${msg.attachment_url}`} alt="photo" className="rounded-lg max-w-full max-h-[200px] object-cover" loading="lazy" />;
    }
    if (type === 'voice' && msg.attachment_url) {
      return <audio controls src={`${API}${msg.attachment_url}`} className="max-w-[220px]" preload="none" />;
    }
    return <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>;
  };

  let lastDate = '';

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0C] border-b border-white/10" style={{maxWidth: '480px', margin: '0 auto'}}>
        <div className="px-3 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg bg-[#141418] border border-white/10 text-gray-400 hover:text-white transition-all" data-testid="chat-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">MATKA 11 Support</p>
            <p className="text-green-400 text-[10px]">Online</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 pt-16 pb-32 overflow-y-auto" data-testid="chat-messages">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MessageCircle className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">Admin se baat karein</p>
            <p className="text-gray-600 text-xs mt-1">Message, photo ya voice bhejein</p>
          </div>
        )}
        {messages.map((msg) => {
          const msgDate = formatDate(msg.created_at);
          let showDateHeader = false;
          if (msgDate !== lastDate) { lastDate = msgDate; showDateHeader = true; }
          const isUser = msg.sender === 'user';
          return (
            <React.Fragment key={msg.id}>
              {showDateHeader && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] text-gray-400 bg-[#141418] px-3 py-1 rounded-full">{msgDate}</span>
                </div>
              )}
              <div className={`flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${isUser ? 'bg-[#D4AF37] text-black rounded-br-md' : 'bg-[#1E1E24] text-white rounded-bl-md border border-white/10'}`} data-testid={`chat-msg-${msg.id}`}>
                  {renderMsgContent(msg)}
                  <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${isUser ? 'text-black/50' : 'text-gray-400'}`}>
                    <span className="text-[9px]">{formatTime(msg.created_at)}</span>
                    {renderTicks(msg)}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input Bar */}
      <div className="fixed bottom-14 left-0 right-0 z-40 bg-[#0A0A0C] border-t border-white/10 px-3 py-2" style={{maxWidth: '480px', margin: '0 auto'}}>
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageSelect} className="hidden" data-testid="chat-file-input" />
        {recording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-sm font-mono">{formatRecordTime(recordTime)}</span>
              <span className="text-gray-400 text-xs">Recording...</span>
            </div>
            <button onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center" data-testid="chat-stop-record">
              <Square className="w-4 h-4 text-white fill-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="w-10 h-10 rounded-full bg-[#141418] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-40 transition-all" data-testid="chat-image-btn">
              <Image className="w-4 h-4" />
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendTextMessage()}
              placeholder="Message type karein..."
              className="flex-1 bg-[#141418] border border-white/10 rounded-full px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#D4AF37] placeholder-gray-500"
              data-testid="chat-input"
            />
            {input.trim() ? (
              <button onClick={sendTextMessage} disabled={sending} className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center hover:bg-[#D4AF37]/80 disabled:opacity-40 transition-all" data-testid="chat-send-btn">
                <Send className="w-4 h-4 text-black" />
              </button>
            ) : (
              <button onClick={startRecording} disabled={sending} className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center hover:bg-[#D4AF37]/80 disabled:opacity-40 transition-all" data-testid="chat-mic-btn">
                <Mic className="w-4 h-4 text-black" />
              </button>
            )}
          </div>
        )}
      </div>
      <FooterNav />
    </div>
  );
};

export default ChatPage;
