import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send, Mic } from 'lucide-react';
import apiClient from '../api/axios';
import { getPresignedDownloadUrl } from '../api/documents';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../utils/soundService';
import { formatTimeAgo as timeAgo } from '../utils/dateUtils';

interface Conv { id: string; client_id: string | null; client_name: string | null; client_company: string | null; status: string; last_message: { content: string; sender_role: string; created_at: string } | null; unread_count: number; last_message_at: string | null }
interface ReplyTo { id: string; content: string; file_name?: string; sender_role: string }
interface Msg { id: string; sender_id: string; sender_role: string; content: string; message_type?: string; file_name?: string; document_id?: string; reply_to_id?: string; reply_to?: ReplyTo | null; is_read: boolean; created_at: string }

/* ── Inline AudioPlayer ── */
function AudioPlayer({ documentId, isMe }: { documentId: string; isMe: boolean }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (audioUrl || loading) return;
    setLoading(true);
    try {
      const url = await getPresignedDownloadUrl(documentId);
      setAudioUrl(url);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  if (error) return <div style={{ fontSize: 11, color: '#EF4444' }}>Impossible de charger l'audio</div>;
  if (!audioUrl) return (
    <button onClick={load} disabled={loading} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#F3F4F6', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: isMe ? 'white' : '#374151', fontSize: 12, width: '100%' }}>
      {loading ? '⏳ Chargement...' : '▶ Écouter'}
    </button>
  );
  return <audio controls style={{ width: '100%', height: 32 }} src={audioUrl} />;
}

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

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; file_name?: string; sender_role: string; isMe: boolean } | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, []);

  const fetchConvs = useCallback(async () => { try { const { data } = await apiClient.get('/chat/conversations'); setConvs(data.conversations ?? []); } catch { /* */ } }, []);
  const fetchMsgs = useCallback(async () => { if (!activeId) return; try { const { data } = await apiClient.get(`/chat/conversations/${activeId}/messages`); setMsgs(data.messages ?? []); } catch { /* */ } }, [activeId]);

  useEffect(() => { fetchConvs(); const t = setInterval(fetchConvs, 15000); return () => clearInterval(t); }, [fetchConvs]);
  useEffect(() => { if (activeId) { fetchMsgs(); const t = setInterval(fetchMsgs, 5000); return () => clearInterval(t); } }, [activeId, fetchMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // Clear reply when switching conversations
  useEffect(() => { setReplyingTo(null); }, [activeId]);

  async function handleSend() {
    if (!text.trim() || sending || !activeId) return;
    const content = text.trim(); setText(''); setSending(true);
    try {
      const { data } = await apiClient.post(`/chat/conversations/${activeId}/messages`, { content, message_type: 'text', reply_to_id: replyingTo?.id || null });
      setMsgs(p => [...p, data]);
      setReplyingTo(null);
      soundService.playMessageSent();
    } catch { setText(content); }
    finally { setSending(false); }
  }

  // ── Voice recording ──
  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!activeId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (ev) => { chunks.push(ev.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        await sendVoiceNote(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } catch { alert('Microphone non disponible'); }
  };

  const stopRecording = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    if (!isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const sendVoiceNote = async (blob: Blob) => {
    if (!activeId) return;
    const filename = `note_vocale_${Date.now()}.webm`;
    const file = new File([blob], filename, { type: 'audio/webm' });
    const tempId = 'temp-' + Date.now();
    setMsgs(prev => [...prev, { id: tempId, content: '🎤 Note vocale', message_type: 'audio', file_name: filename, sender_id: user?.id ?? '', sender_role: user?.role ?? 'admin', is_read: false, created_at: new Date().toISOString() }]);

    try {
      const form = new FormData();
      form.append('file', file);
      const activeConv = convs.find(c => c.id === activeId);
      if (activeConv?.client_id) { form.append('client_id', activeConv.client_id); form.append('source', 'cabinet'); }
      const { data: uploadData } = await apiClient.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });

      const { data: msg } = await apiClient.post(`/chat/conversations/${activeId}/messages`, { content: '🎤 Note vocale', message_type: 'audio', file_name: filename, document_id: uploadData.id, reply_to_id: replyingTo?.id || null });
      setMsgs(prev => prev.map(m => m.id === tempId ? msg : m));
      setReplyingTo(null);
      soundService.playMessageSent();
    } catch (err) {
      console.error('Voice note error:', err);
      setMsgs(prev => prev.filter(m => m.id !== tempId));
      alert('Erreur envoi note vocale');
    }
  };

  const active = convs.find(c => c.id === activeId);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', margin: '-16px -24px', background: '#fff' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}`}</style>

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
                <div key={m.id}
                  onMouseEnter={() => setHoveredMsgId(m.id)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                  style={{ position: 'relative', display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {!isMe && <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(#3B82F6,#1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(active.client_name ?? '?').charAt(0).toUpperCase()}</div>}

                  {/* Audio message */}
                  {m.message_type === 'audio' && m.document_id ? (
                    <div style={{ maxWidth: 280, background: isMe ? '#2563EB' : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                      {m.reply_to && (
                        <div style={{ background: 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.5)' : '#3B82F6'}`, borderRadius: '0 6px 6px 0', padding: '6px 10px', marginBottom: 8, fontSize: 12, opacity: 0.85 }}>
                          <div style={{ fontWeight: 600, color: isMe ? 'rgba(255,255,255,0.8)' : '#3B82F6', marginBottom: 2, fontSize: 11 }}>{m.reply_to.sender_role === 'client' ? active.client_name : 'Vous'}</div>
                          <div style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{m.reply_to.file_name ? `📎 ${m.reply_to.file_name}` : m.reply_to.content}</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>🎤</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>Note vocale</span>
                      </div>
                      <AudioPlayer documentId={m.document_id} isMe={isMe} />
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                    </div>
                  ) : (
                    /* Regular / file message */
                    <div style={{ maxWidth: '65%', background: isMe ? '#2563EB' : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                      {/* Reply preview inside bubble */}
                      {m.reply_to && (
                        <div style={{ background: 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.5)' : '#3B82F6'}`, borderRadius: '0 6px 6px 0', padding: '6px 10px', marginBottom: 8, fontSize: 12, opacity: 0.85 }}>
                          <div style={{ fontWeight: 600, color: isMe ? 'rgba(255,255,255,0.8)' : '#3B82F6', marginBottom: 2, fontSize: 11 }}>{m.reply_to.sender_role === 'client' ? active.client_name : 'Vous'}</div>
                          <div style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{m.reply_to.file_name ? `📎 ${m.reply_to.file_name}` : m.reply_to.content}</div>
                        </div>
                      )}
                      {m.message_type === 'file' && m.document_id ? (
                        <div onClick={async () => { try { const url = await getPresignedDownloadUrl(m.document_id!); if (url) window.open(url, '_blank'); } catch { /* */ } }}
                          style={{ background: isMe ? 'rgba(255,255,255,0.15)' : '#F8FAFC', borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: m.content && m.content !== `📎 ${m.file_name}` ? 6 : 0 }}>
                          <span style={{ fontSize: 18 }}>📎</span>
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.file_name}</span>
                          <span style={{ fontSize: 12, opacity: 0.6 }}>↓</span>
                        </div>
                      ) : null}
                      {(m.message_type !== 'file' || (m.content && m.content !== `📎 ${m.file_name}`)) && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>}
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                    </div>
                  )}

                  {/* Hover action buttons */}
                  {hoveredMsgId === m.id && (
                    <div style={{ position: 'absolute', top: -32, right: isMe ? 0 : 'auto', left: isMe ? 'auto' : 0, display: 'flex', gap: 4, background: 'white', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setReplyingTo({ id: m.id, content: m.content, file_name: m.file_name, sender_role: m.sender_role, isMe })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 12, fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        title="Répondre">
                        ↩ Répondre
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div style={{ padding: '8px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ color: '#DC2626', fontWeight: 500 }}>Enregistrement en cours...</span>
              <span style={{ color: '#EF4444', fontWeight: 700, fontFamily: 'monospace' }}>
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
              </span>
              <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>Relâchez 🎤 pour envoyer</span>
            </div>
          )}

          {/* Reply preview bar */}
          {replyingTo && (
            <div style={{ padding: '8px 24px', background: '#EFF6FF', borderTop: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: '100%', minHeight: 30, background: '#3B82F6', borderRadius: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', marginBottom: 2 }}>
                  ↩ Répondre à {replyingTo.isMe ? 'vous-même' : replyingTo.sender_role === 'client' ? active.client_name : 'vous-même'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {replyingTo.file_name ? `📎 ${replyingTo.file_name}` : replyingTo.content}
                </div>
              </div>
              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 18, padding: 4, flexShrink: 0 }}>✕</button>
            </div>
          )}

          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            {/* Mic button */}
            <button
              onMouseDown={startRecording} onMouseUp={stopRecording}
              onTouchStart={startRecording} onTouchEnd={stopRecording}
              style={{ width: 42, height: 42, borderRadius: '50%', background: isRecording ? '#EF4444' : 'transparent', border: isRecording ? 'none' : '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isRecording ? 'white' : '#9CA3AF', transition: 'all 0.15s', animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none' }}
              title={isRecording ? 'Relâcher pour envoyer' : 'Maintenir pour enregistrer'}>
              <Mic size={16} />
            </button>
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
