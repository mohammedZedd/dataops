import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface Conv { id: string; client_name: string | null; client_company: string | null; status: string; last_message: { content: string; sender_role: string; created_at: string } | null; unread_count: number; last_message_at: string | null }
interface Msg { id: string; sender_id: string; sender_role: string; content: string; is_read: boolean; created_at: string }

function timeAgo(d: string) { const ms = Date.now() - new Date(d).getTime(); if (ms < 60000) return "À l'instant"; if (ms < 3600000) return `${Math.floor(ms / 60000)} min`; if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`; return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); }

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initConvId = searchParams.get('conversation');

  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initConvId);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchConvs = useCallback(async () => { try { const { data } = await apiClient.get('/chat/conversations'); setConvs(data.conversations ?? []); } catch { /* */ } }, []);
  const fetchMsgs = useCallback(async () => { if (!activeId) return; try { const { data } = await apiClient.get(`/chat/conversations/${activeId}/messages`); setMsgs(data.messages ?? []); } catch { /* */ } }, [activeId]);

  useEffect(() => { fetchConvs(); const t = setInterval(fetchConvs, 15000); return () => clearInterval(t); }, [fetchConvs]);
  useEffect(() => { if (activeId) { fetchMsgs(); const t = setInterval(fetchMsgs, 5000); return () => clearInterval(t); } }, [activeId, fetchMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function handleSend() {
    if (!text.trim() || sending || !activeId) return;
    const content = text.trim(); setText(''); setSending(true);
    try { const { data } = await apiClient.post(`/chat/conversations/${activeId}/messages`, { content, message_type: 'text' }); setMsgs(p => [...p, data]); } catch { setText(content); }
    finally { setSending(false); }
  }

  const active = convs.find(c => c.id === activeId);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', margin: '-16px -24px', background: '#fff' }}>
      {/* Left — Conversations */}
      <div style={{ width: 320, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Messages</h2>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}><MessageSquare size={32} color="#D1D5DB" style={{ margin: '0 auto 8px' }} /><p style={{ fontWeight: 500 }}>Aucune conversation</p></div>}
          {convs.map(c => (
            <div key={c.id} onClick={() => setActiveId(c.id)} style={{
              padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', transition: 'background 0.15s',
              background: activeId === c.id ? '#EFF6FF' : '#fff', borderLeft: activeId === c.id ? '3px solid #3B82F6' : '3px solid transparent',
            }}
              onMouseEnter={e => { if (activeId !== c.id) (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (activeId !== c.id) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  {(c.client_name ?? '?').slice(0, 2).toUpperCase()}
                  {c.unread_count > 0 && <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{c.unread_count}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: c.unread_count > 0 ? 700 : 500, fontSize: 14, color: '#111827' }}>{c.client_name ?? '—'}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                  </div>
                  <p style={{ fontSize: 12, color: c.unread_count > 0 ? '#374151' : '#9CA3AF', fontWeight: c.unread_count > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {c.last_message?.content ?? 'Aucun message'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Messages */}
      {active ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(active.client_name ?? '?').slice(0, 2).toUpperCase()}</div>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>{active.client_name}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{active.client_company}</div></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map(m => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {!isMe && <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(#3B82F6,#1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(active.client_name ?? '?').charAt(0).toUpperCase()}</div>}
                  <div style={{ maxWidth: '65%', background: isMe ? '#2563EB' : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>
                    <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Répondre…" rows={1} style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: 12, padding: '10px 14px', fontSize: 13, resize: 'none', outline: 'none', maxHeight: 100, fontFamily: 'inherit' }} />
            <button onClick={handleSend} disabled={!text.trim() || sending} style={{ width: 42, height: 42, borderRadius: '50%', background: text.trim() ? '#2563EB' : '#E5E7EB', border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexDirection: 'column', gap: 12 }}>
          <MessageSquare size={48} color="#D1D5DB" />
          <p style={{ fontWeight: 500, color: '#374151' }}>Sélectionnez une conversation</p>
        </div>
      )}
    </div>
  );
}
