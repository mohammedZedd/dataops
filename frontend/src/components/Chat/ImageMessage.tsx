import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getPresignedPreviewUrl } from '../../api/documents';

interface Props {
  documentId: string;
  isMe: boolean;
}

export default function ImageMessage({ documentId, isMe }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getPresignedPreviewUrl(documentId).then(setUrl).catch(() => {});
  }, [documentId]);

  if (!url) return (
    <div style={{ width: 200, height: 120, background: isMe ? 'rgba(255,255,255,0.15)' : '#F3F4F6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ImageIcon size={24} color={isMe ? 'rgba(255,255,255,0.5)' : '#9CA3AF'} />
    </div>
  );
  return (
    <img
      src={url}
      alt="image"
      onClick={() => window.open(url, '_blank')}
      style={{ maxWidth: 240, maxHeight: 200, borderRadius: 8, cursor: 'pointer', display: 'block', objectFit: 'cover' }}
    />
  );
}
