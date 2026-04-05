import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, Send, ArrowLeft, Paperclip, Mic } from 'lucide-react';
import apiClient from '../api/axios';
import { getPresignedDownloadUrl } from '../api/documents';
import { useAuth } from '../context/AuthContext';
import { soundService } from '../utils/soundService';
import { formatTimeAgo as timeAgo } from '../utils/dateUtils';

interface ReplyTo { id: string; content: string; file_name?: string; sender_role: string }
interface Msg { id: string; sender_id: string; sender_role: string; content: string; message_type: string; file_name?: string; file_url?: string; document_id?: string; reply_to_id?: string; reply_to?: ReplyTo | null; is_read: boolean; created_at: string }
interface Conv { id: string; client_id: string | null; client_name: string | null; client_company: string | null; unread_count: number; last_message: { content: string; created_at: string } | null; last_message_at: string | null }

/* ── Inline AudioPlayer (widget-sized) ── */
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

  if (error) return <div style={{ fontSize: 10, color: '#EF4444' }}>Erreur audio</div>;
  if (!audioUrl) return (
    <button onClick={load} disabled={loading} style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#F3F4F6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: isMe ? 'white' : '#374151', fontSize: 11, width: '100%' }}>
      {loading ? '⏳...' : '▶ Écouter'}
    </button>
  );
  return <audio controls style={{ width: '100%', height: 28 }} src={audioUrl} />;
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
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCount = useRef(0);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; file_name?: string; sender_role: string; isMe: boolean } | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isClient = user?.role === 'client';
  const isStaff = user?.role === 'admin' || user?.role === 'accountant';
  const gradient = isClient ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : 'linear-gradient(135deg,#059669,#047857)';
  const accent = isClient ? '#2563EB' : '#059669';

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    };
  }, []);

  // Clear reply when switching conversations
  useEffect(() => { setReplyingTo(null); }, [activeConvId]);

  // Fetch conversations
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
      const newMsgs: Msg[] = data.messages ?? [];
      if (newMsgs.length > prevMsgCount.current && prevMsgCount.current > 0) {
        const last = newMsgs[newMsgs.length - 1];
        if (last && last.sender_id !== user?.id) soundService.playMessageReceived();
      }
      prevMsgCount.current = newMsgs.length;
      setMsgs(newMsgs);
      setConvs(p => p.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c));
    } catch { /* */ }
  }, [activeConvId]);

  useEffect(() => { fetchConvs(); const t = setInterval(fetchConvs, 15000); return () => clearInterval(t); }, [fetchConvs]);
  useEffect(() => { if (open && activeConvId) { fetchMsgs(); const t = setInterval(fetchMsgs, 5000); return () => clearInterval(t); } }, [open, activeConvId, fetchMsgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function handleSend() {
    if ((!text.trim() && !attachedFile) || sending) return;
    const content = text.trim(); const file = attachedFile;
    setText(''); setAttachedFile(null); setSending(true);
    try {
      let cid = activeConvId;
      if (!cid && isClient) { const { data } = await apiClient.post('/chat/conversations'); cid = data.id; setActiveConvId(cid); }
      if (!cid) return;

      if (file) {
        const form = new FormData(); form.append('file', file);
        if (activeConvId) { const conv = convs.find(c => c.id === activeConvId); if (conv?.client_id) form.append('client_id', conv.client_id); }
        const { data: uploadData } = await apiClient.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const { data } = await apiClient.post(`/chat/conversations/${cid}/messages`, { content: content || `📎 ${file.name}`, message_type: 'file', file_name: file.name, document_id: uploadData.id, reply_to_id: replyingTo?.id || null });
        setMsgs(p => [...p, data]);
      } else {
        const { data } = await apiClient.post(`/chat/conversations/${cid}/messages`, { content, message_type: 'text', reply_to_id: replyingTo?.id || null });
        setMsgs(p => [...p, data]);
      }
      prevMsgCount.current += 1;
      setReplyingTo(null);
      soundService.playMessageSent();
    } catch { setText(content); if (file) setAttachedFile(file); }
    finally { setSending(false); }
  }

  async function handleDownloadFile(docId: string) {
    try { const url = await getPresignedDownloadUrl(docId); window.open(url, '_blank'); } catch { /* */ }
  }

  // ── Voice recording ──
  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
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
    const filename = `note_vocale_${Date.now()}.webm`;
    const file = new File([blob], filename, { type: 'audio/webm' });
    const tempId = 'temp-' + Date.now();
    setMsgs(prev => [...prev, { id: tempId, content: '🎤 Note vocale', message_type: 'audio', file_name: filename, sender_id: user?.id ?? '', sender_role: user?.role ?? 'client', is_read: false, created_at: new Date().toISOString() }]);

    try {
      let cid = activeConvId;
      if (!cid && isClient) { const { data } = await apiClient.post('/chat/conversations'); cid = data.id; setActiveConvId(cid); }
      if (!cid) { setMsgs(prev => prev.filter(m => m.id !== tempId)); return; }

      const form = new FormData();
      form.append('file', file);
      const conv = convs.find(c => c.id === cid);
      if (isStaff && conv?.client_id) { form.append('client_id', conv.client_id); form.append('source', 'cabinet'); }
      const { data: uploadData } = await apiClient.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });

      const { data: msg } = await apiClient.post(`/chat/conversations/${cid}/messages`, { content: '🎤 Note vocale', message_type: 'audio', file_name: filename, document_id: uploadData.id, reply_to_id: replyingTo?.id || null });
      setMsgs(prev => prev.map(m => m.id === tempId ? msg : m));
      prevMsgCount.current += 1;
      setReplyingTo(null);
      soundService.playMessageSent();
    } catch (err) {
      console.error('Voice note error:', err);
      setMsgs(prev => prev.filter(m => m.id !== tempId));
      alert('Erreur envoi note vocale');
    }
  };

  if (!user) return null;
  if (location.pathname === '/client/messages' || location.pathname === '/chat') return null;

  const activeConv = convs.find(c => c.id === activeConvId);
  const showConvList = isStaff && !activeConvId;
  const showMessages = activeConvId != null;

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
                    <div key={m.id}
                      onMouseEnter={() => setHoveredMsgId(m.id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                      style={{ position: 'relative', display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                      {!isMe && <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.sender_role === 'client' ? 'linear-gradient(#3B82F6,#1D4ED8)' : 'linear-gradient(#059669,#047857)', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.sender_role === 'client' ? (activeConv?.client_name?.charAt(0) ?? 'C') : 'C'}</div>}

                      {/* Audio message */}
                      {m.message_type === 'audio' && m.document_id ? (
                        <div style={{ maxWidth: '75%', background: isMe ? accent : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                          {m.reply_to && (
                            <div style={{ background: 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.5)' : '#3B82F6'}`, borderRadius: '0 6px 6px 0', padding: '4px 8px', marginBottom: 6, fontSize: 11, opacity: 0.85 }}>
                              <div style={{ fontWeight: 600, color: isMe ? 'rgba(255,255,255,0.8)' : '#3B82F6', fontSize: 10 }}>{m.reply_to.sender_role === 'client' ? (isClient ? 'Vous' : activeConv?.client_name) : (isClient ? 'Votre cabinet' : 'Vous')}</div>
                              <div style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{m.reply_to.file_name ? `📎 ${m.reply_to.file_name}` : m.reply_to.content}</div>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 14 }}>🎤</span>
                            <span style={{ fontSize: 11, fontWeight: 500 }}>Note vocale</span>
                          </div>
                          <AudioPlayer documentId={m.document_id} isMe={isMe} />
                          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                        </div>
                      ) : (
                        /* Regular / file message */
                        <div style={{ maxWidth: '75%', background: isMe ? accent : '#fff', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: isMe ? 'none' : '1px solid #E5E7EB' }}>
                          {/* Reply preview inside bubble */}
                          {m.reply_to && (
                            <div style={{ background: 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${isMe ? 'rgba(255,255,255,0.5)' : '#3B82F6'}`, borderRadius: '0 6px 6px 0', padding: '4px 8px', marginBottom: 6, fontSize: 11, opacity: 0.85 }}>
                              <div style={{ fontWeight: 600, color: isMe ? 'rgba(255,255,255,0.8)' : '#3B82F6', fontSize: 10 }}>{m.reply_to.sender_role === 'client' ? (isClient ? 'Vous' : activeConv?.client_name) : (isClient ? 'Votre cabinet' : 'Vous')}</div>
                              <div style={{ color: isMe ? 'rgba(255,255,255,0.7)' : '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{m.reply_to.file_name ? `📎 ${m.reply_to.file_name}` : m.reply_to.content}</div>
                            </div>
                          )}
                          {m.message_type === 'file' && m.document_id ? (
                            <div onClick={() => handleDownloadFile(m.document_id!)} style={{ background: isMe ? 'rgba(255,255,255,0.15)' : '#F8FAFC', borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: m.content && m.content !== `📎 ${m.file_name}` ? 6 : 0 }}>
                              <span style={{ fontSize: 18 }}>📎</span>
                              <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.file_name}</span>
                              <span style={{ fontSize: 12, opacity: 0.6 }}>↓</span>
                            </div>
                          ) : null}
                          {(m.message_type !== 'file' || (m.content && m.content !== `📎 ${m.file_name}`)) && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.content}</div>}
                          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>{timeAgo(m.created_at)}{isMe && <span style={{ marginLeft: 4 }}>{m.is_read ? '✓✓' : '✓'}</span>}</div>
                        </div>
                      )}

                      {/* Hover action buttons */}
                      {hoveredMsgId === m.id && (
                        <div style={{ position: 'absolute', top: -28, right: isMe ? 0 : 'auto', left: isMe ? 'auto' : 0, display: 'flex', gap: 4, background: 'white', border: '1px solid #E5E7EB', borderRadius: 16, padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setReplyingTo({ id: m.id, content: m.content, file_name: m.file_name, sender_role: m.sender_role, isMe })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 5px', borderRadius: 10, fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3, transition: 'background 0.15s' }}
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
                <div style={{ padding: '6px 12px', background: '#FEF2F2', borderTop: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                  <span style={{ color: '#DC2626', fontWeight: 500 }}>Enregistrement...</span>
                  <span style={{ color: '#EF4444', fontWeight: 700, fontFamily: 'monospace' }}>
                    {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* Reply preview bar */}
              {replyingTo && (
                <div style={{ padding: '6px 12px', background: '#EFF6FF', borderTop: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 3, minHeight: 24, background: '#3B82F6', borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#3B82F6', marginBottom: 1 }}>
                      ↩ {replyingTo.isMe ? 'Vous' : replyingTo.sender_role === 'client' ? (isClient ? 'Vous' : activeConv?.client_name) : (isClient ? 'Votre cabinet' : 'Vous')}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {replyingTo.file_name ? `📎 ${replyingTo.file_name}` : replyingTo.content}
                    </div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 2, flexShrink: 0 }}>✕</button>
                </div>
              )}

              <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 10485760) setAttachedFile(f); e.target.value = ''; }} />
                {attachedFile && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, padding: '6px 12px', background: '#EFF6FF', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#1E40AF' }}>
                    <span>📎 {attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12 }}>✕</button>
                  </div>
                )}
                {isStaff && <button onClick={() => fileInputRef.current?.click()} title="Joindre un fichier" style={{ width: 32, height: 32, borderRadius: '50%', background: attachedFile ? '#EFF6FF' : 'transparent', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#9CA3AF' }}><Paperclip size={14} /></button>}
                {/* Mic button */}
                <button
                  onMouseDown={startRecording} onMouseUp={stopRecording}
                  onTouchStart={startRecording} onTouchEnd={stopRecording}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: isRecording ? '#EF4444' : 'transparent', border: isRecording ? 'none' : '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isRecording ? 'white' : '#9CA3AF', transition: 'all 0.15s', animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none' }}
                  title={isRecording ? 'Relâcher pour envoyer' : 'Maintenir pour enregistrer'}>
                  <Mic size={14} />
                </button>
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
