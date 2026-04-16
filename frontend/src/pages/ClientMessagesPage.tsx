import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../utils/soundService';
import { MessageBubble, ChatInput } from '../components/Chat';
import type { Msg, ReplyToState } from '../types/chat';

export default function ClientMessagesPage() {
  const { user } = useAuth();
  const [convId,     setConvId]     = useState<string | null>(null);
  const [msgs,       setMsgs]       = useState<Msg[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [hasNew,     setHasNew]     = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyToState | null>(null);

  const endRef       = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCount    = useRef(0);
  const isAtBottom   = useRef(true);

  // ── Init: charge la conversation existante du client ────────────────────────
  const init = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/chat/conversations');
      if (data.conversations?.length > 0) {
        const c = data.conversations[0];
        setConvId(c.id);
        const { data: m } = await apiClient.get(`/chat/conversations/${c.id}/messages`);
        const list: Msg[] = m.messages ?? [];
        setMsgs(list);
        prevCount.current = list.length;
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  // ── Polling des nouveaux messages ───────────────────────────────────────────
  const fetchMsgs = useCallback(async () => {
    if (!convId) return;
    try {
      const { data } = await apiClient.get(`/chat/conversations/${convId}/messages`);
      const list: Msg[] = data.messages ?? [];
      setMsgs(prev => {
        if (prev.map(m => m.id).join(',') === list.map((m: Msg) => m.id).join(',')) return prev;
        if (list.length > prevCount.current && prevCount.current > 0) {
          const last = list[list.length - 1];
          if (last?.sender_id !== user?.id) {
            soundService.playMessageReceived();
            if (!isAtBottom.current) setHasNew(true);
          }
        }
        prevCount.current = list.length;
        return list;
      });
    } catch { /* */ }
  }, [convId, user?.id]);

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (convId) { const t = setInterval(fetchMsgs, 4000); return () => clearInterval(t); } }, [convId, fetchMsgs]);

  // Scroll auto sur nouveau message
  useEffect(() => {
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    if (last?.sender_id === user?.id || isAtBottom.current) {
      endRef.current?.scrollIntoView({ behavior: prevCount.current <= 1 ? 'instant' : 'smooth' });
    }
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isAtBottom.current) setHasNew(false);
  }

  // ── Gestion des messages reçus depuis ChatInput ─────────────────────────────
  function handleMessageSent(msg: Msg & { _replaceId?: string }) {
    if (msg._replaceId) {
      // Remplace le message optimiste (note vocale)
      setMsgs(p => p.map(m => m.id === msg._replaceId ? msg : m));
    } else if (msg.message_type === '_error_remove') {
      setMsgs(p => p.filter(m => m.id !== msg.sender_id));
    } else {
      setMsgs(p => [...p, msg]);
      prevCount.current += 1;
    }
  }

  // Crée la conversation si elle n'existe pas encore
  async function getOrCreateConvId(): Promise<string> {
    if (convId) return convId;
    const { data } = await apiClient.post('/chat/conversations');
    setConvId(data.id);
    return data.id;
  }

  const suggestions = [
    "J'ai une question sur ma facture",
    "Pouvez-vous vérifier ce document ?",
    "J'attends un retour sur mon dossier",
  ];

  // Avatar cabinet (même style que les avatars clients dans ChatPage)
  const cabinetAvatar = (
    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(#3B82F6,#1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div>
  );

  return (
    <>
    <style>{`.client-msg-root{display:flex;flex-direction:column;height:calc(100vh - 56px);margin:-16px -24px;background:#fff;overflow:hidden}@media(max-width:768px){.client-msg-root{margin:-16px -16px}}`}</style>
    <div className="client-msg-root">

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Votre cabinet comptable</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            En ligne
          </p>
        </div>
      </div>

      {/* Zone messages */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {hasNew && (
          <div
            onClick={() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); setHasNew(false); }}
            style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#2563EB,#7C3AED)', color: '#fff', borderRadius: 20, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(37,99,235,0.3)', zIndex: 10, whiteSpace: 'nowrap' }}
          >
            ↓ Nouveau message
          </div>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>Chargement…</div>
          ) : msgs.length === 0 ? (
            /* État vide avec suggestions */
            <div style={{ textAlign: 'center', padding: '40px 20px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Bonjour {user?.first_name} !</h3>
              <p style={{ margin: '0 0 24px', color: '#6B7280', fontSize: 15, maxWidth: 360, lineHeight: 1.6 }}>
                Envoyez un message à votre cabinet comptable.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      // Hack: on ne peut pas accéder au state interne de ChatInput,
                      // donc on simule un clic — à remplacer par un prop onSuggest si besoin
                      const textarea = document.querySelector<HTMLTextAreaElement>('.client-chat-textarea');
                      if (textarea) { const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!; nativeInput.call(textarea, s); textarea.dispatchEvent(new Event('input', { bubbles: true })); }
                    }}
                    style={{ padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 20, cursor: 'pointer', fontSize: 13, color: '#374151', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#EFF6FF'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#BFDBFE'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'; }}
                  >
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
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    isMe={isMe}
                    otherLabel="Cabinet"
                    variant="flat"
                    onReply={setReplyingTo}
                    otherAvatar={cabinetAvatar}
                  />
                );
              })}
              <div ref={endRef} />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        convId={convId}
        getOrCreateConvId={getOrCreateConvId}
        replyingTo={replyingTo}
        onClearReply={() => setReplyingTo(null)}
        onMessageSent={handleMessageSent}
        onConvCreated={setConvId}
        placeholder="Écrivez votre message…"
      />
    </div>
    </>
  );
}
