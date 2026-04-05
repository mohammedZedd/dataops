import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, ArrowLeft } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../utils/soundService';

interface Msg { id: string; sender_id: string; sender_role: string; content: string; is_read: boolean; created_at: string }
interface Conv { id: string; client_name: string | null; client_company: string | null; unread_count: number; last_message: { content: string; created_at: string } | null; last_message_at: string | null }

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60000) return "À l'instant";
  if (ms < 3600000) return `${Math.floor(ms / 60000)} min`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(0);

  const isClient = user?.role === 'client';
  const isStaff = user?.role === 'admin' || user?.role === 'accountant';
  const gradient = isClient ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : 'linear-gradient(135deg,#059669,#047857)';
  const accent = isClient ? '#2563EB' : '#059669';

  // Fetch conversations
  const fetchConvs = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await apiClient.get('/chat/conversations');
      const list: Conv[] = data.conversations ?? [];
      setConvs(list);
      setTotalUnread(list.reduce((s, c) => s + (c.unread_count ?? 0), 0));
      // For client: auto-select the first conversation
      if (isClient && list.length > 0 && !activeConvId) setActiveConvId(list[0].id);
    } catch { /* */ }
  }, [user, isClient, activeConvId]);

  const fetchMsgs = useCallback(async () => {
    if (!activeConvId) return;
    try {
      const { data } = await apiClient.get(`/chat/conversations/${activeConvId}/messages`);
      const newMsgs: Msg[] = data.messages ?? [];
      if (newMsgs.length > prevMsgCount.current && prevMsgCount.current > 0) {
        const last = newMsgs[newMsgs.length - 1];
        if (last && last.sender_id !== user?.id) soundService.playMessageReceived();
      }
      prevMsgCount.current = newMsgs.length;
      setMsgs(newMsgs);
      // Clear unread for this conv locally
      setConvs(p => p.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c));
    } catch { /* */ }
  }, [activeConvId]);

  useEffect(() => { fetchConvs(); const t = setInterval(fetchConvs, 15000); return () => clearInterval(t); }, [fetchConvs]);
  useEffect(() => { if (open && activeConvId) { fetchMsgs(); const t = setInterval(fetchMsgs, 5000); return () => clearInterval(t); } }, [open, activeConvId, fetchMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    const content = text.trim(); setText(''); setSending(true);
    try {
      let cid = activeConvId;
      if (!cid && isClient) {
        const { data } = await apiClient.post('/chat/conversations');
        cid = data.id; setActiveConvId(cid);
      }
      if (!cid) return;
      const { data } = await apiClient.post(`/chat/conversations/${cid}/messages`, { content, message_type: 'text' });
      setMsgs(p => [...p, data]);
      prevMsgCount.current += 1;
      soundService.playMessageSent();
    } catch { setText(content); }
    finally { setSending(false); }
  }

  if (!user) return null;
  // Hide on dedicated messages/chat pages
  if (location.pathname === '/client/messages' || location.pathname === '/chat') return null;

  const activeConv = convs.find(c => c.id === activeConvId);
  const showConvList = isStaff && !activeConvId;
  const showMessages = activeConvId != null;

  return (
    <>
      <style>{`@keyframes chatSlide{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

      {/* Floating button */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
        {totalUnread > 0 && !open && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', minWidth: 20, height: 20, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '0 4px', border: '2px solid #fff' }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </div>
        )}
        <button onClick={() => { setOpen(v => !v); if (!open) fetchConvs(); }} style={{ width: 56, height: 56, borderRadius: '50%', background: gradient, border: 'none', cursor: 'pointer', boxShadow: `0 4px 20px ${isClient ? 'rgba(37,99,235,0.4)' : 'rgba(5,150,105,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: open ? 'scale(0.9)' : 'scale(1)' }}>
          {open ? <X size={22} color="#fff" /> : <MessageSquare size={22} color="#fff" />}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 24, width: 360, height: 500, background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', zIndex: 999, overflow: 'hidden', border: '1px solid #E5E7EB', animation: 'chatSlide 0.3s ease-out' }}>

          {/* Header */}
          <div style={{ background: gradient, padding: '14px 16px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isStaff && activeConvId && (
                <button onClick={() => { setActiveConvId(null); setMsgs([]); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowLeft size={14} />
                </button>
              )}
              {showMessages && activeConv ? (
                <><div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{(activeConv.client_name ?? '?').slice(0, 2).toUpperCase()}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{activeConv.client_name}</div><div style={{ fontSize: 10, opacity: 0.8 }}>{activeConv.client_company}</div></div></>
              ) : isClient ? (
                <><div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
                  <div><div style={{ fontWeight: 600, fontSize: 14 }}>Votre cabinet</div><div style={{ fontSize: 11, opacity: 0.8 }}>Envoyez un message</div></div></>
              ) : (
                <><MessageSquare size={18} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>Messages clients</div><div style={{ fontSize: 11, opacity: 0.8 }}>{convs.length} conversation{convs.length !== 1 ? 's' : ''}</div></div></>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {isStaff && <button onClick={() => { navigate('/chat'); setOpen(false); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Tout voir</button>}
            </div>
          </div>

          {/* Conversations list (staff only, no active conv) */}
          {showConvList && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {convs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}><div style={{ fontSize: 36, marginBottom: 8 }}>💬</div><p style={{ fontWeight: 500, color: '#374151' }}>Aucun message</p></div>
              ) : convs.map(c => (
                <div key={c.id} onClick={() => setActiveConvId(c.id)} style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: c.unread_count > 0 ? '#F0FDF4' : '#fff', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = c.unread_count > 0 ? '#F0FDF4' : '#fff'; }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    {(c.client_name ?? '?').slice(0, 2).toUpperCase()}
                    {c.unread_count > 0 && <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{c.unread_count}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: c.unread_count > 0 ? 700 : 500, fontSize: 14, color: '#111827' }}>{c.client_name}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                    </div>
                    <p style={{ fontSize: 12, color: c.unread_count > 0 ? '#374151' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{c.last_message?.content ?? 'Aucun message'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Messages view */}
          {(showMessages || isClient) && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC' }}>
                {msgs.length === 0 && <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF' }}><div style={{ fontSize: 36, marginBottom: 8 }}>👋</div><div style={{ fontWeight: 500, color: '#374151', fontSize: 14 }}>{isClient ? 'Comment pouvons-nous vous aider ?' : 'Aucun message'}</div></div>}
                {msgs.map(m => {
                  const isMe = m.sender_id === user?.id;
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                      {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.sender_role === 'client' ? 'linear-gradient(#3B82F6,#1D4ED8)' : 'linear-gradient(#059669,#047857)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.sender_role === 'client' ? (activeConv?.client_name?.charAt(0) ?? 'C') : 'C'}</div>}
                      <div style={{ maxWidth: '75%', background: isMe ? accent : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>
                        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={isClient ? 'Écrivez un message…' : 'Répondre…'} rows={1} style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', maxHeight: 80, fontFamily: 'inherit' }} />
                <button onClick={handleSend} disabled={!text.trim() || sending} style={{ width: 38, height: 38, borderRadius: '50%', background: text.trim() ? accent : '#E5E7EB', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={16} color="#fff" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
