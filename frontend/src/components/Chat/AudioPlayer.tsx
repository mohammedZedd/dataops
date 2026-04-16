import { useState } from 'react';
import { getPresignedDownloadUrl } from '../../api/documents';

interface Props {
  documentId: string;
  isMe: boolean;
  compact?: boolean;
}

export default function AudioPlayer({ documentId, isMe, compact = false }: Props) {
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
    <button
      onClick={load}
      disabled={loading}
      style={{ background: isMe ? 'rgba(255,255,255,0.2)' : '#F3F4F6', border: 'none', borderRadius: 8, padding: compact ? '4px 10px' : '6px 12px', cursor: 'pointer', color: isMe ? 'white' : '#374151', fontSize: compact ? 11 : 12, width: '100%' }}
    >
      {loading ? '⏳ Chargement...' : '▶ Écouter'}
    </button>
  );
  return <audio controls style={{ width: '100%', height: compact ? 28 : 32 }} src={audioUrl} />;
}
