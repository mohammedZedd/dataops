import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatTimeAgo as timeAgo } from '../utils/dateUtils';
import { soundService } from '../utils/soundService';
import { MessageBubble, ChatInput } from '../components/Chat';
import type { Conv, Msg, ReplyToState } from '../types/chat';

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [convs,      setConvs]      = useState<Conv[]>([]);
  const [activeId,   setActiveId]   = useState<string | null>(searchParams.get('conversation'));
  const [msgs,       setMsgs]       = useState<Msg[]>([]);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [replyingTo, setReplyingTo] = useState<ReplyToState | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchConvs = useCallback(async () => {
    try { const { data } = await apiClient.get('/chat/conversations'); setConvs(data.conversations ?? []); } catch { /* */ }
  }, []);

  const fetchMsgs = useCallback(async () => {
    if (!activeId) return;
    try { const { data } = await apiClient.get(`/chat/conversations/${activeId}/messages`); setMsgs(data.messages ?? []); } catch { /* */ }
  }, [activeId]);

  useEffect(() => { fetchConvs(); const t = setInterval(fetchConvs, 15000); return () => clearInterval(t); }, [fetchConvs]);
  useEffect(() => {
    if (activeId) {
      fetchMsgs();
      const t = setInterval(fetchMsgs, 5000);
      return () => clearInterval(t);
    }
  }, [activeId, fetchMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { setReplyingTo(null); }, [activeId]);

  // ── Réception messages depuis ChatInput ──────────────────────────────────
  function handleMessageSent(msg: Msg & { _replaceId?: string }) {
    if (msg._replaceId) {
      setMsgs(p => p.map(m => m.id === msg._replaceId ? msg : m));
    } else if (msg.message_type === '_error_remove') {
      setMsgs(p => p.filter(m => m.id !== msg.sender_id));
    } else {
      setMsgs(p => [...p, msg]);
      // Notification son si message reçu
      if (msg.sender_id !== user?.id) soundService.playMessageReceived();
    }
  }

  const active = convs.find(c => c.id === activeId);

  // ── Avatars ──────────────────────────────────────────────────────────────
  function clientAvatar(name: string | null) {
    return (
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(#3B82F6,#1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {(name ?? '?').charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="chat-root">
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}
        .chat-root{display:flex;height:calc(100vh - 56px);margin:-16px -24px;background:#fff;overflow:hidden}
        .chat-sidebar{width:320px;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;flex-shrink:0}
        .chat-main{flex:1;display:flex;flex-direction:column;min-width:0}
        .chat-back-btn{display:none;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#3B82F6;font-size:13px;font-weight:600;padding:4px 8px;border-radius:6px;flex-shrink:0}
        .chat-back-btn:hover{background:#EFF6FF}
        @media(max-width:768px){
          .chat-root{margin:-16px -16px}
          .chat-sidebar{width:100%;position:absolute;inset:0;z-index:5;background:#fff}
          .chat-sidebar.chat-panel-hidden{display:none}
          .chat-main.chat-panel-hidden{display:none}
          .chat-main{width:100%;position:absolute;inset:0}
          .chat-back-btn{display:flex!important}
        }
        @media(min-width:769px) and (max-width:1024px){.chat-sidebar{width:260px}}
        @media(min-width:1920px){
          .chat-sidebar{width:380px}
          .chat-msg-area{padding:20px calc((100% - 900px)/2)!important}
        }
        @media(min-width:2560px){
          .chat-root{max-width:2200px}
          .chat-msg-area{padding:20px calc((100% - 1000px)/2)!important}
        }
      `}</style>

      {/* ── Sidebar conversations ──────────────────────────────────────────── */}
      <div className={`chat-sidebar${mobileView === 'chat' ? ' chat-panel-hidden' : ''}`}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Messages</h2>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
              <MessageSquare size={32} color="#D1D5DB" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 500 }}>Aucune conversation</p>
            </div>
          )}
          {convs.map(c => (
            <div
              key={c.id}
              onClick={() => { setActiveId(c.id); setMobileView('chat'); }}
              style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6', transition: 'background 0.15s', background: activeId === c.id ? '#EFF6FF' : '#fff', borderLeft: activeId === c.id ? '3px solid #3B82F6' : '3px solid transparent' }}
              onMouseEnter={e => { if (activeId !== c.id) (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (activeId !== c.id) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  {(c.client_name ?? '?').slice(0, 2).toUpperCase()}
                  {c.unread_count > 0 && (
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                      {c.unread_count}
                    </div>
                  )}
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

      {/* ── Zone de chat ──────────────────────────────────────────────────── */}
      {active ? (
        <div className={`chat-main${mobileView === 'list' ? ' chat-panel-hidden' : ''}`}>

          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button className="chat-back-btn" onClick={() => setMobileView('list')} aria-label="Retour">
              <ArrowLeft size={16} /> Retour
            </button>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {(active.client_name ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.client_name}</div>
              <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.client_company}</div>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-msg-area" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map(m => {
              const isMe = m.sender_id === user?.id;
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isMe={isMe}
                  otherLabel={active.client_name ?? '—'}
                  variant="flat"
                  onReply={setReplyingTo}
                  otherAvatar={clientAvatar(active.client_name)}
                />
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <ChatInput
            convId={activeId}
            clientId={active.client_id}
            replyingTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
            onMessageSent={handleMessageSent}
          />
        </div>

      ) : (
        <div className={`chat-main${mobileView === 'list' ? ' chat-panel-hidden' : ''}`} style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#9CA3AF' }}>
          <MessageSquare size={48} color="#D1D5DB" />
          <p style={{ fontWeight: 500, color: '#374151' }}>Sélectionnez une conversation</p>
        </div>
      )}
    </div>
  );
}
