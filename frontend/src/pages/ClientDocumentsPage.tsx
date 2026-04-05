import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, FileText, ImageIcon, FileSpreadsheet, Download, Trash2,
  CheckCircle, AlertCircle, Eye, X, Mic, MicOff, Square,
  Play, Pause,
} from 'lucide-react';
import { getMyDocuments, uploadDocument, getPresignedDownloadUrl, getPresignedPreviewUrl, deleteDocument } from '../api/documents';
import { useAuth } from '../context/AuthContext';
import type { ClientDocument } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED_FILE = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls';
const ACCEPTED_ALL = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.webm,.mp4,.mp3,.ogg,.wav';
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 300; // 5 minutes

function fileType(name: string): 'pdf' | 'image' | 'excel' | 'audio' | 'autre' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  if (['webm', 'mp4', 'mp3', 'ogg', 'wav', 'mpeg'].includes(ext)) return 'audio';
  return 'autre';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatTimer(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function TypeBadge({ name }: { name: string }) {
  const t = fileType(name);
  const styles: Record<string, string> = {
    pdf: 'bg-red-50 text-red-700 border border-red-200',
    image: 'bg-purple-50 text-purple-700 border border-purple-200',
    excel: 'bg-green-50 text-green-700 border border-green-200',
    audio: 'bg-violet-50 text-violet-700 border border-violet-200',
    autre: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  const labels: Record<string, string> = { pdf: 'PDF', image: 'Image', excel: 'Excel', audio: 'Audio', autre: 'Fichier' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${styles[t]}`}>
      {t === 'pdf' && <FileText size={10} />}
      {t === 'image' && <ImageIcon size={10} />}
      {t === 'excel' && <FileSpreadsheet size={10} />}
      {t === 'audio' && <Mic size={10} />}
      {labels[t]}
    </span>
  );
}

function StatusBadge({ status }: { status: ClientDocument['status'] }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    processed: { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Traité' },
    processing: { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'En cours' },
    error: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Erreur' },
  };
  const c = cfg[status] ?? { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'En attente' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap border ${c.cls}`}>{c.label}</span>;
}

type UploadTab = 'file' | 'voice';

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientDocumentsPage() {
  const { user } = useAuth();
  const isReadOnly = user?.access_level === 'readonly';

  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Upload
  const [tab, setTab] = useState<UploadTab>('file');
  const [selected, setSelected] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toast, setToast] = useState<'success' | 'deleted' | 'error' | null>(null);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceDescription, setVoiceDescription] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Preview / delete modals
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; doc: ClientDocument | null }>({ open: false, doc: null });
  // Inline audio player in list
  const [playingDocId, setPlayingDocId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(() => {
    setLoadError(null);
    getMyDocuments().then(setDocuments).catch(() => setLoadError('Impossible de charger vos documents.'));
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function showToast(type: 'success' | 'deleted' | 'error') {
    setToast(type);
    setTimeout(() => setToast(null), 3000);
  }

  function closePreview() { setPreviewDoc(null); setPreviewUrl(null); }

  async function loadPreview(doc: ClientDocument) {
    setDeleteModal({ open: false, doc: null });
    setPreviewLoading(true);
    setPreviewDoc(doc);
    try {
      const url = await getPresignedPreviewUrl(doc.id);
      setPreviewUrl(url);
    } catch { closePreview(); }
    finally { setPreviewLoading(false); }
  }

  function validate(file: File): string | null {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'];
    if (!allowed.includes(file.type)) return 'Type non autorisé.';
    if (file.size > MAX_SIZE) return 'Fichier trop volumineux (max 10 Mo).';
    return null;
  }

  function pickFile(file: File) {
    const err = validate(file);
    if (err) { setUploadError(err); return; }
    setUploadError(null);
    setSelected(file);
  }

  async function handleUpload() {
    const file = selected || audioFile;
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    try {
      const desc = audioFile ? voiceDescription.trim() : undefined;
      const doc = await uploadDocument(file, setProgress, desc);
      setDocuments(prev => [doc, ...prev]);
      setSelected(null);
      setAudioFile(null);
      setAudioUrl(null);
      setVoiceDescription('');
      setProgress(0);
      showToast('success');
    } catch {
      setUploadError('Échec de l\'envoi. Veuillez réessayer.');
      showToast('error');
    } finally {
      setUploading(false);
    }
  }

  // ─── Voice ─────────────────────────────────────────────────────────────────

  async function startRecording() {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `note_vocale_${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(file);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setVoiceError('Accès au microphone refusé. Vérifiez les permissions de votre navigateur.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function discardRecording() {
    setAudioFile(null);
    setAudioUrl(null);
    setRecordingTime(0);
  }

  // ─── Inline audio player for list ──────────────────────────────────────────

  async function togglePlayDoc(doc: ClientDocument) {
    if (playingDocId === doc.id) {
      setPlayingDocId(null);
      setPlayingUrl(null);
      return;
    }
    try {
      const url = await getPresignedDownloadUrl(doc.id);
      setPlayingDocId(doc.id);
      setPlayingUrl(url);
    } catch { /* ignore */ }
  }

  // ─── Misc ──────────────────────────────────────────────────────────────────

  async function handleDownload(doc: ClientDocument) {
    const url = await getPresignedDownloadUrl(doc.id);
    window.open(url, '_blank');
  }

  async function handleDelete(doc: ClientDocument) {
    try {
      await deleteDocument(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setDeleteModal({ open: false, doc: null });
      showToast('deleted');
    } catch { showToast('error'); }
  }

  const canPreview = (name: string) => ['pdf', 'image'].includes(fileType(name));
  const hasFileToUpload = !!selected || !!audioFile;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Toast */}
      <div className={`fixed top-16 right-4 z-50 flex items-center gap-2.5 bg-white border rounded-xl shadow-lg px-4 py-3 transition-all duration-300
        ${toast === 'error' ? 'border-red-200' : 'border-green-200'}
        ${toast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
        {toast === 'success' && <><CheckCircle size={18} className="text-green-500" /><span className="text-sm font-medium text-gray-800">Document envoyé avec succès</span></>}
        {toast === 'deleted' && <><CheckCircle size={18} className="text-green-500" /><span className="text-sm font-medium text-gray-800">Fichier supprimé</span></>}
        {toast === 'error' && <><AlertCircle size={18} className="text-red-500" /><span className="text-sm font-medium text-gray-800">Une erreur est survenue</span></>}
      </div>

      {/* Delete modal */}
      {deleteModal.open && deleteModal.doc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center"><Trash2 size={24} className="text-red-500" /></div>
              <p className="font-semibold text-gray-900">Supprimer ce fichier ?</p>
              <p className="text-sm text-gray-500">Cette action est irréversible.</p>
              <p className="text-sm font-medium text-gray-700 bg-gray-50 rounded px-3 py-2 w-full text-center truncate">{deleteModal.doc.file_name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal({ open: false, doc: null })} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={() => handleDelete(deleteModal.doc!)} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="bg-white rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-medium text-gray-800 truncate mr-4">{previewDoc.file_name}</p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleDownload(previewDoc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Télécharger"><Download size={16} /></button>
                <button onClick={closePreview} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Fermer"><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 min-h-0">
              {previewLoading ? (
                <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : previewUrl ? (
                fileType(previewDoc.file_name) === 'pdf'
                  ? <iframe src={previewUrl} className="w-full h-[80vh]" title={previewDoc.file_name} />
                  : fileType(previewDoc.file_name) === 'audio'
                    ? <audio controls src={previewUrl} className="my-12" />
                    : <img src={previewUrl} alt={previewDoc.file_name} className="max-w-full max-h-[80vh] object-contain" />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Mes documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Déposez vos fichiers pour les transmettre à votre cabinet comptable.</p>
      </div>

      {/* Readonly banner */}
      {isReadOnly && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <span className="text-[18px] flex-shrink-0 mt-0.5">&#9888;&#65039;</span>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: '#92400E' }}>Votre accès a été limité</p>
            <p className="text-[13px] mt-1" style={{ color: '#92400E' }}>
              Vous pouvez consulter vos documents existants mais vous ne pouvez plus en envoyer de nouveaux.
              Pour plus d'informations, contactez votre cabinet comptable.
            </p>
          </div>
        </div>
      )}

      {/* ═══ Upload zone — 3 tabs ═══ */}
      {!isReadOnly && (
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <p className="text-sm font-medium text-gray-700">Ajouter un document</p>

        {/* Tab buttons */}
        <div className="flex gap-3">
          {([
            { id: 'file' as UploadTab, icon: <Upload size={20} />, label: 'Fichier' },
            { id: 'voice' as UploadTab, icon: <Mic size={20} />, label: 'Note vocale' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setUploadError(null); }}
              className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all"
              style={{
                borderColor: tab === t.id ? '#3B82F6' : '#E5E7EB',
                background: tab === t.id ? '#EFF6FF' : '#fff',
                color: tab === t.id ? '#2563EB' : '#6B7280',
              }}
            >
              {t.icon}
              <span className="text-[13px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ─── File tab ────────────────────────────────────────────────────── */}
        {tab === 'file' && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
            onClick={() => !selected && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center gap-3 transition-colors cursor-pointer
              ${dragging ? 'border-blue-400 bg-blue-50' : selected ? 'border-green-300 bg-green-50 cursor-default' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
          >
            <input ref={inputRef} type="file" accept={ACCEPTED_FILE} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }} />
            {selected ? (
              <>
                <FileText size={32} className="text-green-500" />
                <p className="text-sm font-medium text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-500">{formatSize(selected.size)}</p>
                <button onClick={e => { e.stopPropagation(); setSelected(null); setPhotoPreview(null); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Changer</button>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center"><Upload size={22} className="text-gray-400" /></div>
                <p className="text-sm font-medium text-gray-700">Glissez un fichier ici ou <span className="text-blue-600">parcourir</span></p>
                <p className="text-xs text-gray-400">PDF, JPG, PNG, XLSX — max 10 Mo</p>
              </>
            )}
          </div>
        )}



        {/* ─── Voice tab ───────────────────────────────────────────────────── */}
        {tab === 'voice' && (
          <div className="space-y-3">
            {voiceError && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <MicOff size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-700">{voiceError}</p>
              </div>
            )}

            {audioUrl && audioFile ? (
              /* RECORDED state */
              <div className="border border-gray-200 rounded-xl p-5 flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 w-full">
                  <button
                    onClick={() => { if (audioRef.current) { audioPlaying ? audioRef.current.pause() : audioRef.current.play(); setAudioPlaying(!audioPlaying); } }}
                    className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 hover:bg-violet-200 transition-colors"
                  >
                    {audioPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{audioFile.name}</p>
                    <p className="text-xs text-gray-500">Durée : {formatTimer(recordingTime)} — {formatSize(audioFile.size)}</p>
                  </div>
                  <audio ref={audioRef} src={audioUrl} onEnded={() => setAudioPlaying(false)} />
                </div>
                <input
                  value={voiceDescription}
                  onChange={e => setVoiceDescription(e.target.value)}
                  placeholder="Ajouter une description (optionnel)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-400 mt-1"
                />
                <button onClick={discardRecording} className="text-xs text-gray-400 hover:text-red-500 underline">Supprimer et réenregistrer</button>
              </div>
            ) : isRecording ? (
              /* RECORDING state */
              <div className="border-2 border-red-200 bg-red-50 rounded-xl p-6 flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                    <Mic size={28} className="text-red-500" />
                  </div>
                </div>
                <p className="text-2xl font-mono font-bold text-red-700">{formatTimer(recordingTime)}</p>
                {recordingTime >= MAX_RECORDING_SECONDS - 60 && (
                  <p className="text-xs text-red-500 font-medium">{MAX_RECORDING_SECONDS - recordingTime}s restantes</p>
                )}
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Square size={14} /> Arrêter
                </button>
              </div>
            ) : (
              /* IDLE state */
              <button
                onClick={startRecording}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl px-6 py-10 flex flex-col items-center gap-3 hover:border-violet-400 hover:bg-violet-50 transition-colors cursor-pointer"
              >
                <div className="h-14 w-14 rounded-full bg-violet-50 flex items-center justify-center"><Mic size={28} className="text-violet-500" /></div>
                <p className="text-sm font-medium text-gray-700">Appuyez pour enregistrer</p>
                <p className="text-xs text-gray-400">Note vocale — max 5 minutes</p>
              </button>
            )}
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400 text-right">{progress}%</p>
          </div>
        )}

        {uploadError && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={13} /> {uploadError}</p>}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!hasFileToUpload || uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload size={15} />
          {uploading ? 'Envoi en cours…' : 'Envoyer'}
        </button>
      </div>
      )}

      {/* ═══ Documents list ═══ */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">
            Fichiers envoyés
            {documents.length > 0 && <span className="ml-2 text-xs text-gray-400 font-normal">({documents.length})</span>}
          </p>
        </div>

        {loadError && <div className="px-4 py-3 text-sm text-red-600">{loadError}</div>}

        {documents.length === 0 && !loadError ? (
          <div className="py-14 text-center">
            <p className="text-sm font-semibold text-gray-600">Aucun document envoyé</p>
            <p className="text-sm text-gray-400 mt-1">Vos fichiers apparaîtront ici après l'envoi.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Fichier</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Taille</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Statut</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => (
                <>
                  <tr key={doc.id} className={`hover:bg-gray-50 transition-colors ${idx < documents.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{doc.file_name}</td>
                    <td className="px-4 py-3"><TypeBadge name={doc.file_name} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatSize(doc.file_size)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {fileType(doc.file_name) === 'audio' ? (
                          <button onClick={() => togglePlayDoc(doc)} className="p-1.5 text-gray-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors" title="Écouter">
                            {playingDocId === doc.id ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                        ) : (
                          <button onClick={() => loadPreview(doc)} disabled={!canPreview(doc.file_name)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Prévisualiser">
                            <Eye size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDownload(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger">
                          <Download size={14} />
                        </button>
                        <button onClick={() => { if (!isReadOnly) { closePreview(); setDeleteModal({ open: true, doc }); } }} disabled={isReadOnly} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={isReadOnly ? 'Action non disponible' : 'Supprimer'}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Inline audio player */}
                  {playingDocId === doc.id && playingUrl && (
                    <tr key={`${doc.id}-player`} className="border-b border-gray-100">
                      <td colSpan={6} className="px-4 py-2 bg-violet-50">
                        <audio controls autoPlay src={playingUrl} className="w-full h-8" onEnded={() => setPlayingDocId(null)} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documents reçus du cabinet */}
      {(() => {
        const cabinetDocs = documents.filter(d => d.source === 'cabinet');
        if (cabinetDocs.length === 0) return null;
        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6">
            <div className="px-4 py-3 border-b" style={{ borderColor: '#EDE9FE' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📥</span>
                <span className="text-sm font-medium" style={{ color: '#7C3AED' }}>Documents reçus du cabinet</span>
                <span style={{ background: '#EDE9FE', color: '#7C3AED', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{cabinetDocs.length}</span>
              </div>
            </div>
            {cabinetDocs.map((doc, idx) => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx < cabinetDocs.length - 1 ? '1px solid #F3F4F6' : 'none', background: doc.is_new ? '#FAF5FF' : '#fff', borderLeft: doc.is_new ? '3px solid #7C3AED' : '3px solid #EDE9FE' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {doc.file_name?.endsWith('.pdf') ? '📄' : doc.file_name?.match(/\.(jpg|jpeg|png)$/i) ? '🖼️' : doc.file_name?.match(/\.(xlsx|xls)$/i) ? '📊' : '📎'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</p>
                  <p style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>Envoyé par votre cabinet · {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}</p>
                  {doc.description && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, fontStyle: 'italic' }}>"{doc.description}"</p>}
                </div>
                <button onClick={() => handleDownload(doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger"><Download size={14} /></button>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
