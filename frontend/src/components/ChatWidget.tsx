import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface Msg { id: string; sender_id: string; sender_role: string; content: string; is_read: boolean; created_at: string }

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60000) return "À l'instant";
  if (ms < 3600000) return `${Math.floor(ms / 60000)} min`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  // Don't show for admin/accountant
  if (user?.role !== 'client') return null;

  const fetchConv = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/chat/conversations');
      if (data.conversations?.length > 0) {
        const c = data.conversations[0];
        setConvId(c.id);
        setUnread(c.unread_count ?? 0);
      }
    } catch { /* */ }
  }, []);

  const fetchMsgs = useCallback(async () => {
    if (!convId) return;
    try {
      const { data } = await apiClient.get(`/chat/conversations/${convId}/messages`);
      setMsgs(data.messages ?? []);
      setUnread(0);
    } catch { /* */ }
  }, [convId]);

  useEffect(() => { fetchConv(); const t = setInterval(fetchConv, 30000); return () => clearInterval(t); }, [fetchConv]);
  useEffect(() => { if (open && convId) { fetchMsgs(); const t = setInterval(fetchMsgs, 5000); return () => clearInterval(t); } }, [open, convId, fetchMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      let cid = convId;
      if (!cid) {
        const { data } = await apiClient.post('/chat/conversations');
        cid = data.id;
        setConvId(cid);
      }
      const { data } = await apiClient.post(`/chat/conversations/${cid}/messages`, { content, message_type: 'text' });
      setMsgs(p => [...p, data]);
    } catch { setText(content); }
    finally { setSending(false); }
  }

  return (
    <>
      <style>{`@keyframes chatSlide{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
        {unread > 0 && !open && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>{unread}</div>
        )}
        <button onClick={() => setOpen(v => !v)} style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(37,99,235,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: open ? 'scale(0.9)' : 'scale(1)' }}>
          {open ? <X size={22} color="#fff" /> : <MessageSquare size={22} color="#fff" />}
        </button>
      </div>
      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 24, width: 340, height: 480, background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', zIndex: 999, overflow: 'hidden', border: '1px solid #E5E7EB', animation: 'chatSlide 0.3s ease-out' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)', padding: '16px 20px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
              <div><div style={{ fontWeight: 600, fontSize: 14 }}>Votre cabinet comptable</div><div style={{ fontSize: 11, opacity: 0.8 }}>Envoyez un message</div></div>
            </div>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC' }}>
            {msgs.length === 0 && <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF' }}><div style={{ fontSize: 36, marginBottom: 8 }}>👋</div><div style={{ fontWeight: 500, color: '#374151', fontSize: 14 }}>Comment pouvons-nous vous aider ?</div></div>}
            {msgs.map(m => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(#2563EB,#7C3AED)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>}
                  <div style={{ maxWidth: '75%', background: isMe ? '#2563EB' : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>
                    <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Écrivez un message…" rows={1} style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', maxHeight: 80, fontFamily: 'inherit' }} />
            <button onClick={handleSend} disabled={!text.trim() || sending} style={{ width: 38, height: 38, borderRadius: '50%', background: text.trim() ? '#2563EB' : '#E5E7EB', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} color="#fff" style={{ transform: 'rotate(0deg)' }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
