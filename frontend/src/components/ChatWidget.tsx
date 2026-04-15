import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, ArrowLeft } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../utils/soundService';
import { formatTimeAgo as timeAgo } from '../utils/dateUtils';
import { MessageBubble, ChatInput } from './Chat';
import type { Conv, Msg, ReplyToState } from '../types/chat';

export function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open,        setOpen]        = useState(false);
  const [convs,       setConvs]       = useState<Conv[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [msgs,        setMsgs]        = useState<Msg[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [replyingTo,  setReplyingTo]  = useState<ReplyToState | null>(null);

  const endRef      = useRef<HTMLDivElement>(null);
  const prevCount   = useRef(0);

  const isClient = user?.role === 'client';
  const isStaff  = user?.role === 'admin' || user?.role === 'accountant';
  const gradient = isClient ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : 'linear-gradient(135deg,#059669,#047857)';
  const accent   = isClient ? '#2563EB' : '#059669';

  const activeConv = convs.find(c => c.id === activeConvId);

  // Clear reply on conv change
  useEffect(() => { setReplyingTo(null); }, [activeConvId]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchConvs = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await apiClient.get('/chat/conversations');
      const list: Conv[] = data.conversations ?? [];
      setConvs(list);
      setTotalUnread(list.reduce((s, c) => s + (c.unread_count ?? 0), 0));
      if (isClient && list.length > 0 && !activeConvId) setActiveConvId(list[0].id);
    } catch { /* */ }
  }, [user, isClient, activeConvId]);

  const fetchMsgs = useCallback(async () => {
    if (!activeConvId) return;
    try {
      const { data } = await apiClient.get(`/chat/conversations/${activeConvId}/messages`);
      const list: Msg[] = data.messages ?? [];
      if (list.length > prevCount.current && prevCount.current > 0) {
        const last = list[list.length - 1];
        if (last?.sender_id !== user?.id) soundService.playMessageReceived();
      }
      prevCount.current = list.length;
      setMsgs(list);
      setConvs(p => p.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c));
    } catch { /* */ }
  }, [activeConvId, user?.id]);

  useEffect(() => {
    fetchConvs();
    const t = setInterval(fetchConvs, 15000);
    return () => clearInterval(t);
  }, [fetchConvs]);

  useEffect(() => {
    if (open && activeConvId) {
      fetchMsgs();
      const t = setInterval(fetchMsgs, 5000);
      return () => clearInterval(t);
    }
  }, [open, activeConvId, fetchMsgs]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleMessageSent(msg: Msg & { _replaceId?: string }) {
    if (msg._replaceId) {
      setMsgs(p => p.map(m => m.id === msg._replaceId ? msg : m));
    } else if (msg.message_type === '_error_remove') {
      setMsgs(p => p.filter(m => m.id !== msg.sender_id));
    } else {
      setMsgs(p => [...p, msg]);
      prevCount.current += 1;
    }
  }

  async function getOrCreateConvId(): Promise<string> {
    if (activeConvId) return activeConvId;
    const { data } = await apiClient.post('/chat/conversations');
    setActiveConvId(data.id);
    return data.id;
  }

  // ── Avatars ───────────────────────────────────────────────────────────────────
  function clientAvatar(name: string | null) {
    return (
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(#3B82F6,#1D4ED8)', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {(name ?? '?').charAt(0).toUpperCase()}
      </div>
    );
  }
  const cabinetAvatar = (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(#3B82F6,#1D4ED8)', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>
  );

  if (!user) return null;
  if (location.pathname === '/client/messages' || location.pathname === '/chat') return null;

  const showConvList = isStaff && !activeConvId;
  const showMessages = activeConvId != null || isClient;

  return (
    <>
      <style>{`@keyframes chatSlide{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}`}</style>

      {/* Floating button */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
        {totalUnread > 0 && !open && (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', minWidth: 20, height: 20, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '0 4px', border: '2px solid #fff' }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </div>
        )}
        <button
          onClick={() => { setOpen(v => !v); if (!open) fetchConvs(); }}
          style={{ width: 56, height: 56, borderRadius: '50%', background: gradient, border: 'none', cursor: 'pointer', boxShadow: `0 4px 20px ${isClient ? 'rgba(37,99,235,0.4)' : 'rgba(5,150,105,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: open ? 'scale(0.9)' : 'scale(1)' }}
        >
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
                <>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{(activeConv.client_name ?? '?').slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{activeConv.client_name}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{activeConv.client_company}</div>
                  </div>
                </>
              ) : isClient ? (
                <>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Votre cabinet</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Envoyez un message</div>
                  </div>
                </>
              ) : (
                <>
                  <MessageSquare size={18} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Messages clients</div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>{convs.length} conversation{convs.length !== 1 ? 's' : ''}</div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {isStaff && (
                <button onClick={() => { navigate('/chat'); setOpen(false); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                  Tout voir
                </button>
              )}
            </div>
          </div>

          {/* Conversations list (staff, no active conv) */}
          {showConvList && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {convs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                  <p style={{ fontWeight: 500, color: '#374151' }}>Aucun message</p>
                </div>
              ) : convs.map(c => (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: c.unread_count > 0 ? '#F0FDF4' : '#fff', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = c.unread_count > 0 ? '#F0FDF4' : '#fff'; }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    {(c.client_name ?? '?').slice(0, 2).toUpperCase()}
                    {c.unread_count > 0 && (
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{c.unread_count}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: c.unread_count > 0 ? 700 : 500, fontSize: 14, color: '#111827' }}>{c.client_name}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                    </div>
                    <p style={{ fontSize: 12, color: c.unread_count > 0 ? '#374151' : '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {c.last_message?.content ?? 'Aucun message'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Messages view */}
          {showMessages && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: '#F8FAFC' }}>
                {msgs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9CA3AF' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
                    <div style={{ fontWeight: 500, color: '#374151', fontSize: 14 }}>
                      {isClient ? 'Comment pouvons-nous vous aider ?' : 'Aucun message'}
                    </div>
                  </div>
                )}
                {msgs.map(m => {
                  const isMe = m.sender_id === user?.id;
                  return (
                    <MessageBubble
                      key={m.id}
                      msg={m}
                      isMe={isMe}
                      otherLabel={isClient ? 'Cabinet' : (activeConv?.client_name ?? '—')}
                      variant="flat"
                      onReply={setReplyingTo}
                      otherAvatar={isClient ? cabinetAvatar : clientAvatar(activeConv?.client_name ?? null)}
                      compact
                    />
                  );
                })}
                <div ref={endRef} />
              </div>

              <ChatInput
                convId={activeConvId}
                getOrCreateConvId={isClient ? getOrCreateConvId : undefined}
                clientId={isStaff ? activeConv?.client_id : undefined}
                replyingTo={replyingTo}
                onClearReply={() => setReplyingTo(null)}
                onMessageSent={handleMessageSent}
                onConvCreated={setActiveConvId}
                placeholder={isClient ? 'Écrivez un message…' : 'Répondre…'}
                compact
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
