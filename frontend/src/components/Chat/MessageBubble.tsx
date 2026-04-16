import { useState } from 'react';
import { getPresignedDownloadUrl } from '../../api/documents';
import { formatTimeAgo as timeAgo } from '../../utils/dateUtils';
import AudioPlayer from './AudioPlayer';
import ImageMessage from './ImageMessage';
import type { Msg, ReplyToState } from '../../types/chat';

interface Props {
  msg: Msg;
  isMe: boolean;
  /** Label affiché pour l'interlocuteur (ex: "Votre cabinet", nom du client) */
  otherLabel: string;
  /** 'flat' = bleu uni (admin), 'gradient' = dégradé bleu-violet (client) */
  variant?: 'flat' | 'gradient';
  onReply: (state: ReplyToState) => void;
  /** Avatar à droite quand isMe=true (null = pas d'avatar côté "moi") */
  meAvatar?: React.ReactNode;
  /** Avatar à gauche quand isMe=false */
  otherAvatar: React.ReactNode;
  /** Affiche le label de l'interlocuteur au-dessus de la bulle */
  showOtherLabel?: boolean;
  compact?: boolean;
}

export default function MessageBubble({
  msg, isMe, otherLabel, variant = 'flat', onReply,
  meAvatar, otherAvatar, showOtherLabel = false, compact = false,
}: Props) {
  const [hovered, setHovered] = useState(false);

  const meBg     = variant === 'gradient' ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : '#2563EB';
  const bg       = isMe ? meBg : '#fff';
  const color    = isMe ? '#fff' : '#111827';
  const border   = isMe ? 'none' : '1px solid #E5E7EB';
  const shadow   = isMe
    ? (variant === 'gradient' ? '0 4px 12px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.08)')
    : '0 2px 8px rgba(0,0,0,0.06)';
  const radius   = isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px';
  const pad      = compact ? '8px 12px' : '12px 16px';
  const fontSize = compact ? 13 : 14;

  const replyBorder  = isMe ? 'rgba(255,255,255,0.5)' : '#3B82F6';
  const replyName    = isMe ? 'rgba(255,255,255,0.8)' : '#3B82F6';
  const replyContent = isMe ? 'rgba(255,255,255,0.7)' : '#6B7280';

  function ReplyPreview() {
    if (!msg.reply_to) return null;
    const senderIsClient = msg.reply_to.sender_role === 'client';
    const label = senderIsClient
      ? (isMe ? 'Vous' : otherLabel)
      : (isMe ? otherLabel : 'Vous');
    return (
      <div style={{ background: 'rgba(0,0,0,0.06)', borderLeft: `3px solid ${replyBorder}`, borderRadius: '0 6px 6px 0', padding: '6px 10px', marginBottom: 8, fontSize: 12, opacity: 0.85 }}>
        <div style={{ fontWeight: 600, color: replyName, marginBottom: 2, fontSize: 11 }}>{label}</div>
        <div style={{ color: replyContent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
          {msg.reply_to.file_name ? `📎 ${msg.reply_to.file_name}` : msg.reply_to.content}
        </div>
      </div>
    );
  }

  function Timestamp() {
    return (
      <div style={{ fontSize: 10, marginTop: compact ? 4 : 6, opacity: 0.7, textAlign: 'right' }}>
        {timeAgo(msg.created_at)}
        {isMe && <span style={{ marginLeft: 4 }}>{msg.is_read ? '✓✓' : '✓'}</span>}
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}
    >
      {!isMe && otherAvatar}

      <div style={{ maxWidth: '68%' }}>
        {showOtherLabel && !isMe && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, marginLeft: 4 }}>{otherLabel}</div>
        )}

        {/* ── Audio ── */}
        {msg.message_type === 'audio' && msg.document_id ? (
          <div style={{ maxWidth: compact ? 240 : 280, background: bg, color, borderRadius: radius, padding: pad, boxShadow: shadow, border }}>
            <ReplyPreview />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: compact ? 15 : 18 }}>🎤</span>
              <span style={{ fontSize: compact ? 11 : 12, fontWeight: 500 }}>Note vocale</span>
            </div>
            <AudioPlayer documentId={msg.document_id} isMe={isMe} compact={compact} />
            <Timestamp />
          </div>

        ) : msg.message_type === 'image' && msg.document_id ? (
          /* ── Image ── */
          <div style={{ background: bg, color, borderRadius: radius, padding: '8px 10px', boxShadow: shadow, border }}>
            <ReplyPreview />
            <ImageMessage documentId={msg.document_id} isMe={isMe} />
            {msg.file_name && (
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.file_name}
              </div>
            )}
            <Timestamp />
          </div>

        ) : (
          /* ── Texte / Fichier ── */
          <div style={{ background: bg, color, borderRadius: radius, padding: pad, boxShadow: shadow, border }}>
            <ReplyPreview />
            {msg.message_type === 'file' && msg.document_id ? (
              <div
                onClick={async () => { try { const url = await getPresignedDownloadUrl(msg.document_id!); if (url) window.open(url, '_blank'); } catch { /* */ } }}
                style={{ background: isMe ? 'rgba(255,255,255,0.15)' : '#F8FAFC', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: (msg.content && msg.content !== `📎 ${msg.file_name}`) ? 6 : 0, border: isMe ? '1px solid rgba(255,255,255,0.2)' : '1px solid #E5E7EB' }}
              >
                <span style={{ fontSize: compact ? 18 : 20, flexShrink: 0 }}>
                  {msg.file_name?.endsWith('.pdf') ? '📄' : msg.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' : msg.file_name?.match(/\.(xlsx|xls)$/i) ? '📊' : '📎'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: compact ? 12 : 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.file_name || 'Document'}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Télécharger ↓</div>
                </div>
              </div>
            ) : null}
            {(msg.message_type !== 'file' || (msg.content && msg.content !== `📎 ${msg.file_name}`)) && (
              <div style={{ fontSize, lineHeight: 1.6 }}>{msg.content}</div>
            )}
            <Timestamp />
          </div>
        )}
      </div>

      {isMe && meAvatar}

      {/* Bouton reply au hover */}
      {hovered && (
        <div style={{ position: 'absolute', top: -32, right: isMe ? 0 : 'auto', left: isMe ? 'auto' : 0, display: 'flex', gap: 4, background: 'white', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 10, whiteSpace: 'nowrap' }}>
          <button
            onClick={() => onReply({ id: msg.id, content: msg.content, file_name: msg.file_name, sender_role: msg.sender_role, isMe })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 12, fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            ↩ Répondre
          </button>
        </div>
      )}
    </div>
  );
}
