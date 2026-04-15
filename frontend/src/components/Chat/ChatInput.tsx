import { useEffect, useRef, useState } from 'react';
import { Send, Mic, Paperclip, X as XIcon, FileText, Image as ImageIcon } from 'lucide-react';
import apiClient from '../../api/axios';
import { soundService } from '../../utils/soundService';
import { useAuth } from '../../context/AuthContext';
import type { Msg, ReplyToState, PendingFile } from '../../types/chat';

// ─── Constantes ────────────────────────────────────────────────────────────────
const ACCEPTED   = '.pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.webp';
const MAX_BYTES  = 10 * 1024 * 1024;
const IMAGE_MIME = new Set(['image/png','image/jpeg','image/jpg','image/gif','image/webp']);

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_MIME.has(`image/${ext}`) || ext === 'jpg') return <ImageIcon size={14} />;
  return <FileText size={14} />;
}
function fmtBytes(b: number) {
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1048576).toFixed(1)} Mo`;
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  /** ID de la conversation active (peut être null si le client n'a pas encore de conv) */
  convId: string | null;
  /** Crée la conversation si convId est null et retourne le nouvel ID */
  getOrCreateConvId?: () => Promise<string>;
  /** client_id à passer à l'upload S3 pour que le document soit visible côté client */
  clientId?: string | null;
  replyingTo: ReplyToState | null;
  onClearReply: () => void;
  onMessageSent: (msg: Msg) => void;
  /** Appelé quand une conversation est créée à la volée */
  onConvCreated?: (id: string) => void;
  placeholder?: string;
  /** Mode compact pour le ChatWidget */
  compact?: boolean;
}

export default function ChatInput({
  convId, getOrCreateConvId, clientId, replyingTo, onClearReply,
  onMessageSent, onConvCreated, placeholder = 'Répondre…', compact = false,
}: Props) {
  const { user } = useAuth();
  const [text,         setText]        = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [sending,      setSending]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [isRecording,  setIsRecording]  = useState(false);
  const [recTime,      setRecTime]      = useState(0);

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // Nettoyage enregistrement au démontage
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      pendingFiles.forEach(pf => { if (pf.objectUrl) URL.revokeObjectURL(pf.objectUrl); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Obtenir / créer la conv ──────────────────────────────────────────────────
  async function resolveConvId(): Promise<string | null> {
    if (convId) return convId;
    if (!getOrCreateConvId) return null;
    try {
      const id = await getOrCreateConvId();
      onConvCreated?.(id);
      return id;
    } catch { return null; }
  }

  // ── Envoi texte + fichiers ──────────────────────────────────────────────────
  async function handleSend() {
    const hasText  = text.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || sending || uploading) return;

    const cid = await resolveConvId();
    if (!cid) return;

    setSending(true);
    if (hasFiles) setUploading(true);

    try {
      for (const { file, objectUrl } of pendingFiles) {
        const isImg = IMAGE_MIME.has(file.type);
        const form  = new FormData();
        form.append('file', file);
        if (clientId) { form.append('client_id', clientId); form.append('source', 'cabinet'); }
        const { data: uploaded } = await apiClient.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const { data: msg } = await apiClient.post(`/chat/conversations/${cid}/messages`, {
          content: `📎 ${file.name}`,
          message_type: isImg ? 'image' : 'file',
          file_name: file.name,
          document_id: uploaded.id,
          reply_to_id: replyingTo?.id ?? null,
        });
        onMessageSent(msg);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        soundService.playMessageSent();
      }
      setPendingFiles([]);
      setUploading(false);

      if (hasText) {
        const content = text.trim();
        setText('');
        const { data: msg } = await apiClient.post(`/chat/conversations/${cid}/messages`, {
          content, message_type: 'text', reply_to_id: replyingTo?.id ?? null,
        });
        onMessageSent(msg);
        soundService.playMessageSent();
      }
      onClearReply();
    } catch { /* texte conservé, retry possible */ }
    finally { setSending(false); setUploading(false); }
  }

  // ── Sélection de fichiers ───────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const toAdd: PendingFile[] = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) { alert(`"${f.name}" dépasse la limite de 10 Mo.`); continue; }
      toAdd.push({ file: f, objectUrl: IMAGE_MIME.has(f.type) ? URL.createObjectURL(f) : null });
    }
    setPendingFiles(p => [...p, ...toAdd]);
    e.target.value = '';
  }

  function removePendingFile(idx: number) {
    setPendingFiles(p => {
      const copy = [...p];
      if (copy[idx].objectUrl) URL.revokeObjectURL(copy[idx].objectUrl!);
      copy.splice(idx, 1);
      return copy;
    });
  }

  // ── Enregistrement vocal ────────────────────────────────────────────────────
  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    try {
      const stream       = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = ev => chunks.push(ev.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        await sendVoiceNote(new Blob(chunks, { type: 'audio/webm' }));
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecTime(0);
      timerRef.current = setInterval(() => {
        setRecTime(prev => { if (prev >= 120) { stopRecording(); return prev; } return prev + 1; });
      }, 1000);
    } catch { alert('Microphone non disponible'); }
  };

  const stopRecording = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.preventDefault();
    if (!isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecTime(0);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const sendVoiceNote = async (blob: Blob) => {
    const cid = await resolveConvId();
    if (!cid) return;
    const filename = `note_vocale_${Date.now()}.webm`;
    const file     = new File([blob], filename, { type: 'audio/webm' });
    const tempId   = 'temp-' + Date.now();

    // Message optimiste
    onMessageSent({ id: tempId, content: '🎤 Note vocale', message_type: 'audio', file_name: filename, sender_id: user?.id ?? '', sender_role: user?.role ?? 'admin', is_read: false, created_at: new Date().toISOString() });

    try {
      const form = new FormData();
      form.append('file', file);
      if (clientId) { form.append('client_id', clientId); form.append('source', 'cabinet'); }
      const { data: uploaded } = await apiClient.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { data: msg } = await apiClient.post(`/chat/conversations/${cid}/messages`, {
        content: '🎤 Note vocale', message_type: 'audio', file_name: filename,
        document_id: uploaded.id, reply_to_id: replyingTo?.id ?? null,
      });
      // Remplace le message optimiste
      onMessageSent({ ...msg, _replaceId: tempId } as Msg & { _replaceId: string });
      onClearReply();
      soundService.playMessageSent();
    } catch {
      // Signale l'échec en marquant le temp message
      onMessageSent({ id: tempId, content: '', message_type: '_error_remove', sender_id: tempId, sender_role: '', is_read: false, created_at: '' });
      alert('Erreur envoi note vocale');
    }
  };

  // ─── Styles ────────────────────────────────────────────────────────────────
  const btnH   = compact ? 36 : 42;
  const btnR   = compact ? 18 : 21;
  const canSend = (text.trim().length > 0 || pendingFiles.length > 0) && !uploading;

  return (
    <div style={{ background: '#fff', flexShrink: 0 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}`}</style>

      {/* ── Indicateur d'enregistrement ── */}
      {isRecording && (
        <div style={{ padding: '8px 16px', background: '#FEF2F2', borderTop: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ color: '#DC2626', fontWeight: 500 }}>Enregistrement en cours...</span>
          <span style={{ color: '#EF4444', fontWeight: 700, fontFamily: 'monospace' }}>
            {Math.floor(recTime / 60).toString().padStart(2, '0')}:{(recTime % 60).toString().padStart(2, '0')}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>Relâchez 🎤 pour envoyer</span>
        </div>
      )}

      {/* ── Preview fichiers en attente ── */}
      {pendingFiles.length > 0 && (
        <div style={{ padding: compact ? '8px 12px' : '10px 16px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {uploading && <div style={{ width: '100%', fontSize: 12, color: '#3B82F6', fontWeight: 500, marginBottom: 4 }}>Envoi en cours…</div>}
          {pendingFiles.map(({ file, objectUrl }, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '5px 8px', maxWidth: 200 }}>
              {objectUrl
                ? <img src={objectUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                : <span style={{ color: '#6B7280', flexShrink: 0 }}>{fileIcon(file.name)}</span>
              }
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtBytes(file.size)}</div>
              </div>
              <button onClick={() => removePendingFile(idx)} disabled={uploading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', flexShrink: 0, padding: 2, display: 'flex' }}>
                <XIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Barre de réponse ── */}
      {replyingTo && (
        <div style={{ padding: compact ? '6px 12px' : '8px 16px', background: '#EFF6FF', borderTop: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 3, minHeight: 28, background: '#3B82F6', borderRadius: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', marginBottom: 2 }}>
              ↩ Répondre à {replyingTo.isMe ? 'vous-même' : replyingTo.sender_role === 'client' ? 'votre contact' : 'vous-même'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyingTo.file_name ? `📎 ${replyingTo.file_name}` : replyingTo.content}
            </div>
          </div>
          <button onClick={onClearReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 4, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── Zone de saisie ── */}
      <div style={{ padding: compact ? '10px 12px' : '14px 16px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple onChange={handleFileSelect} style={{ display: 'none' }} />

        {/* Paperclip */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isRecording}
          title="Joindre un fichier"
          style={{ width: btnH, height: btnH, borderRadius: btnR, background: 'transparent', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#6B7280', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Paperclip size={compact ? 14 : 16} />
        </button>

        {/* Micro */}
        <button
          onMouseDown={startRecording} onMouseUp={stopRecording}
          onTouchStart={startRecording} onTouchEnd={stopRecording}
          title={isRecording ? 'Relâcher pour envoyer' : 'Maintenir pour enregistrer'}
          style={{ width: btnH, height: btnH, borderRadius: btnR, background: isRecording ? '#EF4444' : 'transparent', border: isRecording ? 'none' : '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: isRecording ? 'white' : '#9CA3AF', transition: 'all 0.15s', animation: isRecording ? 'pulse 1s ease-in-out infinite' : 'none' }}
        >
          <Mic size={compact ? 14 : 16} />
        </button>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={placeholder}
          rows={1}
          style={{ flex: 1, border: '1px solid #E5E7EB', borderRadius: compact ? 10 : 14, padding: compact ? '8px 12px' : '10px 14px', fontSize: compact ? 12 : 13, resize: 'none', outline: 'none', maxHeight: compact ? 80 : 120, fontFamily: 'inherit', lineHeight: 1.5 }}
        />

        {/* Envoyer */}
        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          style={{ width: btnH, height: btnH, borderRadius: btnR, background: canSend ? '#2563EB' : '#E5E7EB', border: 'none', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
        >
          <Send size={compact ? 14 : 16} color="#fff" />
        </button>
      </div>
    </div>
  );
}
