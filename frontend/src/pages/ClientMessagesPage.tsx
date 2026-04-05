import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../utils/soundService';
import { formatTimeAgo as timeAgo } from '../utils/dateUtils';

interface Msg { id: string; sender_id: string; sender_role: string; content: string; is_read: boolean; created_at: string }

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const isAtBottom = useRef(true);
  const [hasNew, setHasNew] = useState(false);

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/chat/conversations');
      if (data.conversations?.length > 0) {
        const c = data.conversations[0];
        setConvId(c.id);
        const { data: m } = await apiClient.get(`/chat/conversations/${c.id}/messages`);
        const list = m.messages ?? [];
        setMsgs(list);
        prevCount.current = list.length;
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  const fetchMsgs = useCallback(async () => {
    if (!convId) return;
    try {
      const { data } = await apiClient.get(`/chat/conversations/${convId}/messages`);
      const list: Msg[] = data.messages ?? [];
      // Only update if messages actually changed
      setMsgs(prev => {
        const prevIds = prev.map(m => m.id).join(',');
        const newIds = list.map((m: Msg) => m.id).join(',');
        if (prevIds === newIds) return prev;
        // New message detected
        if (list.length > prevCount.current && prevCount.current > 0) {
          const last = list[list.length - 1];
          const isMine = last && last.sender_id === user?.id;
          if (!isMine) soundService.playMessageReceived();
          if (!isMine && !isAtBottom.current) setHasNew(true);
        }
        prevCount.current = list.length;
        return list;
      });
    } catch { /* */ }
  }, [convId, user?.id]);

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (convId) { const t = setInterval(fetchMsgs, 4000); return () => clearInterval(t); } }, [convId, fetchMsgs]);

  // Smart scroll: only on new messages + at bottom
  useEffect(() => {
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    const isMine = last?.sender_id === user?.id;
    if (isMine || isAtBottom.current) endRef.current?.scrollIntoView({ behavior: prevCount.current <= 1 ? 'instant' : 'smooth' });
  }, [msgs.length]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isAtBottom.current) setHasNew(false);
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    const content = text.trim(); setText(''); setSending(true);
    try {
      let cid = convId;
      if (!cid) { const { data } = await apiClient.post('/chat/conversations'); cid = data.id; setConvId(cid); }
      const { data } = await apiClient.post(`/chat/conversations/${cid}/messages`, { content, message_type: 'text' });
      setMsgs(p => [...p, data]);
      prevCount.current += 1;
      soundService.playMessageSent();
    } catch { setText(content); }
    finally { setSending(false); }
  }

  const suggestions = ["J'ai une question sur ma facture", "Pouvez-vous vérifier ce document ?", "J'attends un retour sur mon dossier"];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 0', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Votre cabinet comptable</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            En ligne
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* New message indicator */}
        {hasNew && (
          <div onClick={() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); setHasNew(false); }}
            style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', color: '#fff', borderRadius: 20, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(37,99,235,0.3)', zIndex: 10, whiteSpace: 'nowrap' }}>
            ↓ Nouveau message
          </div>
        )}
      <div ref={containerRef} onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, width: '100%', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Chargement…</div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Bonjour {user?.first_name} !</h3>
            <p style={{ margin: '0 0 24px', color: '#6B7280', fontSize: 15, maxWidth: 360, lineHeight: 1.6 }}>Envoyez un message à votre cabinet comptable.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setText(s)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 20, cursor: 'pointer', fontSize: 13, color: '#374151', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#BFDBFE'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>Début de la conversation</div>
            {msgs.map(m => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                  {!isMe && <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>}
                  <div style={{ maxWidth: '68%' }}>
                    {!isMe && <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, marginLeft: 4 }}>Votre cabinet</div>}
                    <div style={{ background: isMe ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px', padding: '12px 16px', boxShadow: isMe ? '0 4px 12px rgba(37,99,235,0.3)' : '0 2px 8px rgba(0,0,0,0.06)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{m.content}</div>
                      <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                    </div>
                  </div>
                  {isMe && <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(user?.first_name ?? '').slice(0, 2).toUpperCase()}</div>}
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>
      </div>

      {/* Input */}
      <div style={{ background: '#fff', borderTop: '1px solid #E5E7EB', padding: '16px 0', flexShrink: 0 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Écrivez votre message…" rows={1}
            style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '12px 16px', fontSize: 14, resize: 'none', outline: 'none', maxHeight: 120, fontFamily: 'inherit', lineHeight: 1.5 }} />
          <button onClick={handleSend} disabled={!text.trim() || sending} style={{ width: 48, height: 48, borderRadius: '50%', background: text.trim() ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : '#E5E7EB', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Send size={18} color="#fff" />
          </button>
        </div>
        <p style={{ maxWidth: 720, margin: '8px auto 0', fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Shift + Entrée pour aller à la ligne</p>
      </div>
    </div>
  );
}
