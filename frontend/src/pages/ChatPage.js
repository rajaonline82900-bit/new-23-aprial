import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Mic, Image, Square, Check, CheckCheck, Trash2, X, Video } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('matka11_token') || '';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMessages = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/chat/messages`, { headers });
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Chat fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const iv = setInterval(fetchMessages, 3000);
    return () => clearInterval(iv);
  }, [fetchMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendTextMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/api/chat/send`, { message: input.trim(), msg_type: 'text' }, { headers });
      setInput('');
      fetchMessages();
    } catch (err) { console.error(err); }
    setSending(false);
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
    setSending(false);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setSending(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, `voice_${Date.now()}.webm`);
          const uploadRes = await axios.post(`${API}/api/chat/upload`, formData, { headers });
          await axios.post(`${API}/api/chat/send`, {
            message: '', msg_type: 'voice', attachment_url: uploadRes.data.url
          }, { headers });
          fetchMessages();
        } catch (err) { console.error(err); }
        setSending(false);
      };
      recorder.start();
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

  const deleteMessage = async (msgId) => {
    try {
      await axios.delete(`${API}/api/chat/message/${msgId}`, { headers });
      setSelectedMsg(null);
      fetchMessages();
    } catch (err) {
      console.error(err);
      setSelectedMsg(null);
    }
  };

  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'TODAY';
    if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatRecordTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const renderTicks = (msg) => {
    if (msg.sender !== 'user') return null;
    return msg.read ? (
      <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1] inline-block ml-0.5" strokeWidth={2.5} />
    ) : (
      <Check className="w-3 h-3 text-gray-500 inline-block ml-0.5" strokeWidth={2.5} />
    );
  };

  const renderMsgContent = (msg) => {
    const type = msg.msg_type || 'text';
    if (type === 'image' && msg.attachment_url) {
      return <img src={`${API}${msg.attachment_url}`} alt="photo" className="rounded-lg max-w-full max-h-[220px] object-cover" loading="lazy" />;
    }
    if (type === 'voice' && msg.attachment_url) {
      return <audio controls src={`${API}${msg.attachment_url}`} className="max-w-[220px]" preload="none" />;
    }
    return <p className="text-[14px] whitespace-pre-wrap break-words leading-snug">{msg.message}</p>;
  };

  let lastDate = '';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        // WhatsApp-style chat paper pattern (dark)
        background: '#0B141A',
        backgroundImage:
          'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22 fill=%22none%22><path d=%22M0 100 L20 80 L40 100 L20 120 Z M40 60 L60 40 L80 60 L60 80 Z M120 100 L140 80 L160 100 L140 120 Z M160 40 L180 20 L200 40 L180 60 Z M80 140 L100 120 L120 140 L100 160 Z%22 fill=%22%2317262E%22 opacity=%220.4%22/></svg>")',
        backgroundSize: '200px 200px',
      }}
      data-testid="chat-page"
    >
      {/* WhatsApp-style green header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 shadow-lg"
        style={{ background: 'linear-gradient(180deg, #128C7E 0%, #075E54 100%)', maxWidth: '480px', margin: '0 auto' }}
      >
        <div className="px-2 py-2 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded-full active:bg-white/10 text-white transition-all"
            data-testid="chat-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <img
              src="/lucky-bet-logo.jpg"
              alt="Shiv Shakti Club"
              className="w-10 h-10 rounded-full ring-2 ring-white/50 object-cover"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#075E54]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px] leading-tight truncate">Shiv Shakti Club Support</p>
            <p className="text-emerald-100 text-[11px] leading-tight">online</p>
          </div>
          {/* Optional call/video icons (visual only for authenticity) */}
          <button className="p-1.5 rounded-full text-white active:bg-white/10 transition-all" aria-label="video">
            <Video className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages area */}
      <main
        className="flex-1 px-2 pt-[68px] pb-24 overflow-y-auto"
        data-testid="chat-messages"
        style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                 style={{ background: 'rgba(37, 211, 102, 0.15)', border: '1px solid rgba(37, 211, 102, 0.35)' }}>
              <img src="/lucky-bet-logo.jpg" alt="" className="w-12 h-12 rounded-full" />
            </div>
            <p className="text-emerald-300 text-sm font-bold">Admin से बात करें</p>
            <p className="text-gray-400 text-xs mt-1">Message, photo या voice भेजें</p>
            <p className="text-gray-500 text-[10px] mt-4 px-6">
              🔒 यह chat पूरी तरह सुरक्षित है। सिर्फ आप और Admin ही messages देख सकते हैं।
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const msgDate = formatDate(msg.created_at);
          let showDateHeader = false;
          if (msgDate !== lastDate) { lastDate = msgDate; showDateHeader = true; }
          const isUser = msg.sender === 'user';
          let pressTimer = null;
          const handlePressStart = () => {
            if (!isUser) return;
            pressTimer = setTimeout(() => setSelectedMsg(msg), 500);
          };
          const handlePressEnd = () => { if (pressTimer) clearTimeout(pressTimer); };
          return (
            <React.Fragment key={msg.id}>
              {showDateHeader && (
                <div className="flex justify-center my-3">
                  <span
                    className="text-[11px] font-medium px-3 py-1 rounded-md shadow-sm"
                    style={{ background: 'rgba(31, 43, 51, 0.9)', color: '#B4C4CE' }}
                  >
                    {msgDate}
                  </span>
                </div>
              )}
              <div className={`flex mb-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  onContextMenu={(e) => { if (isUser) { e.preventDefault(); setSelectedMsg(msg); } }}
                  className={`relative max-w-[78%] px-2.5 py-1.5 select-none ${isUser ? 'cursor-pointer' : ''}`}
                  style={
                    isUser
                      ? {
                          background: '#005C4B',
                          color: '#E9EDEF',
                          borderRadius: '8px 8px 0px 8px',
                          boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.3)',
                        }
                      : {
                          background: '#202C33',
                          color: '#E9EDEF',
                          borderRadius: '8px 8px 8px 0px',
                          boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.3)',
                        }
                  }
                  data-testid={`chat-msg-${msg.id}`}
                >
                  {/* Bubble tail */}
                  <span
                    className="absolute top-0 w-0 h-0"
                    style={
                      isUser
                        ? {
                            right: '-6px',
                            borderTop: '8px solid #005C4B',
                            borderRight: '6px solid transparent',
                          }
                        : {
                            left: '-6px',
                            borderTop: '8px solid #202C33',
                            borderLeft: '6px solid transparent',
                          }
                    }
                  />
                  {renderMsgContent(msg)}
                  <div className="flex items-center justify-end gap-0.5 mt-0.5 -mb-0.5">
                    <span className="text-[10px]" style={{ color: 'rgba(233, 237, 239, 0.6)' }}>
                      {formatTime(msg.created_at)}
                    </span>
                    {renderTicks(msg)}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input Bar — fixed at bottom (no footer since we hide it on /chat) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-2 py-2"
        style={{
          background: '#1F2C34',
          maxWidth: '480px',
          margin: '0 auto',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
        }}
      >
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageSelect} className="hidden" data-testid="chat-file-input" />
        {recording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 rounded-full px-4 py-2.5" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-sm font-mono">{formatRecordTime(recordTime)}</span>
              <span className="text-gray-400 text-xs">Recording...</span>
            </div>
            <button onClick={stopRecording} className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center shadow-lg" data-testid="chat-stop-record">
              <Square className="w-4 h-4 text-white fill-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{ color: '#AEBAC1' }}
              data-testid="chat-image-btn"
            >
              <Image className="w-5 h-5" strokeWidth={2} />
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendTextMessage()}
              placeholder="Type a message"
              className="flex-1 rounded-full px-4 py-2.5 text-white text-sm focus:outline-none placeholder-gray-500"
              style={{ background: '#2A3942', border: 'none' }}
              data-testid="chat-input"
            />
            {input.trim() ? (
              <button
                onClick={sendTextMessage}
                disabled={sending}
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                style={{ background: '#25D366' }}
                data-testid="chat-send-btn"
              >
                <Send className="w-4 h-4 text-white translate-x-[1px]" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={sending}
                className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"
                style={{ background: '#25D366' }}
                data-testid="chat-mic-btn"
              >
                <Mic className="w-4 h-4 text-white" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {selectedMsg && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedMsg(null)} data-testid="chat-delete-modal">
          <div className="rounded-2xl p-4 w-full max-w-sm" style={{ background: '#1F2C34', border: '1px solid rgba(255,255,255,0.08)', margin: '0 auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold text-sm">Message Options</p>
              <button onClick={() => setSelectedMsg(null)} className="text-gray-400 hover:text-white" data-testid="chat-delete-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(11, 20, 26, 0.6)' }}>
              <p className="text-gray-300 text-xs truncate">
                {selectedMsg.msg_type === 'image' ? 'Photo' : selectedMsg.msg_type === 'voice' ? 'Voice message' : selectedMsg.message}
              </p>
            </div>
            <button
              onClick={() => deleteMessage(selectedMsg.id)}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
              data-testid="chat-delete-confirm"
            >
              <Trash2 className="w-4 h-4" /> Delete Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
