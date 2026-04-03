import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, ImageIcon, FileSpreadsheet, Download, Trash2, CheckCircle, AlertCircle, Eye, X } from 'lucide-react';
import { getMyDocuments, uploadDocument, getPresignedDownloadUrl, getPresignedPreviewUrl, deleteDocument } from '../api/documents';
import type { ClientDocument } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls';
const MAX_SIZE = 10 * 1024 * 1024;

function fileType(name: string): 'pdf' | 'image' | 'excel' | 'autre' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  return 'autre';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function TypeBadge({ name }: { name: string }) {
  const t = fileType(name);
  const styles: Record<string, string> = {
    pdf:   'bg-red-50 text-red-700 border border-red-200',
    image: 'bg-purple-50 text-purple-700 border border-purple-200',
    excel: 'bg-green-50 text-green-700 border border-green-200',
    autre: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  const labels: Record<string, string> = { pdf: 'PDF', image: 'Image', excel: 'Excel', autre: 'Fichier' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${styles[t]}`}>
      {t === 'pdf'   && <FileText size={10} />}
      {t === 'image' && <ImageIcon size={10} />}
      {t === 'excel' && <FileSpreadsheet size={10} />}
      {labels[t]}
    </span>
  );
}

function StatusBadge({ status }: { status: ClientDocument['status'] }) {
  if (status === 'processed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-green-50 text-green-700 border border-green-200">
        Traité
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200">
        En cours
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-red-50 text-red-700 border border-red-200">
        Erreur
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap bg-amber-50 text-amber-700 border border-amber-200">
      En attente
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDocumentsPage() {
  const [documents,   setDocuments]   = useState<ClientDocument[]>([]);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  // Upload state
  const [dragging,    setDragging]    = useState(false);
  const [selected,    setSelected]    = useState<File | null>(null);
  const [progress,    setProgress]    = useState(0);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toast,       setToast]       = useState<'success' | 'deleted' | 'error' | null>(null);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; doc: ClientDocument | null }>({ open: false, doc: null });

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(() => {
    setLoadError(null);
    getMyDocuments()
      .then(setDocuments)
      .catch(() => setLoadError('Impossible de charger vos documents.'));
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Escape key closes modal
  useEffect(() => {
    if (!previewDoc) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePreview();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [previewDoc]);

  function closePreview() {
    setPreviewDoc(null);
    setPreviewUrl(null);
  }

  async function loadPreview(doc: ClientDocument) {
    setDeleteModal({ open: false, doc: null });
    setPreviewLoading(true);
    setPreviewDoc(doc);
    try {
      const url = await getPresignedPreviewUrl(doc.id);
      setPreviewUrl(url);
    } catch {
      closePreview();
    } finally {
      setPreviewLoading(false);
    }
  }

  function showToast(type: 'success' | 'deleted' | 'error') {
    setToast(type);
    setTimeout(() => setToast(null), 3000);
  }

  function validate(file: File): string | null {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'];
    if (!allowed.includes(file.type)) return 'Type non autorisé. PDF, JPG, PNG, XLSX uniquement.';
    if (file.size > MAX_SIZE) return 'Fichier trop volumineux (max 10 Mo).';
    return null;
  }

  function pickFile(file: File) {
    const err = validate(file);
    if (err) { setUploadError(err); return; }
    setUploadError(null);
    setSelected(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) pickFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  }

  async function handleDownload(doc: ClientDocument) {
    const url = await getPresignedDownloadUrl(doc.id);
    window.open(url, '_blank');
  }

  async function handleDelete(doc: ClientDocument) {
    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setDeleteModal({ open: false, doc: null });
      showToast('deleted');
    } catch {
      showToast('error');
    }
  }

  async function handleUpload() {
    if (!selected) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    try {
      const doc = await uploadDocument(selected, setProgress);
      setDocuments((prev) => [doc, ...prev]);
      setSelected(null);
      setProgress(0);
      showToast('success');
    } catch {
      setUploadError('Échec de l\'envoi. Veuillez réessayer.');
      showToast('error');
    } finally {
      setUploading(false);
    }
  }

  const canPreview = (name: string) => ['pdf', 'image'].includes(fileType(name));

  return (
    <div className="space-y-6">

      {/* Toast */}
      <div className={`fixed top-16 right-4 z-50 flex items-center gap-2.5 bg-white border rounded-xl
        shadow-lg px-4 py-3 transition-all duration-300
        ${toast === 'error' ? 'border-red-200' : 'border-green-200'}
        ${toast ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}
      >
        {toast === 'success' && <><CheckCircle size={18} className="text-green-500 flex-shrink-0" /><span className="text-sm font-medium text-gray-800">Document envoyé avec succès</span></>}
        {toast === 'deleted' && <><CheckCircle size={18} className="text-green-500 flex-shrink-0" /><span className="text-sm font-medium text-gray-800">Fichier supprimé</span></>}
        {toast === 'error'   && <><AlertCircle size={18} className="text-red-500 flex-shrink-0" /><span className="text-sm font-medium text-gray-800">Une erreur est survenue</span></>}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal.open && deleteModal.doc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">Supprimer ce fichier ?</p>
                <p className="text-sm text-gray-500 mt-0.5">Cette action est irréversible.</p>
              </div>
              <p className="text-sm font-medium text-gray-700 bg-gray-50 rounded px-3 py-2 w-full text-center truncate">
                {deleteModal.doc.file_name}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal({ open: false, doc: null })}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteModal.doc!)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-medium text-gray-800 truncate mr-4">{previewDoc.file_name}</p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Télécharger"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={closePreview}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 min-h-0">
              {previewLoading ? (
                <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : previewUrl ? (
                fileType(previewDoc.file_name) === 'pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[80vh]"
                    title={previewDoc.file_name}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={previewDoc.file_name}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="pb-5 border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Mes documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Déposez vos fichiers pour les transmettre à votre cabinet comptable.
        </p>
      </div>

      {/* Upload zone */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <p className="text-sm font-medium text-gray-700">Ajouter un document</p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !selected && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center gap-3
            transition-colors cursor-pointer
            ${dragging
              ? 'border-blue-400 bg-blue-50'
              : selected
                ? 'border-green-300 bg-green-50 cursor-default'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={onInputChange} />

          {selected ? (
            <>
              <FileText size={32} className="text-green-500" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">{selected.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatSize(selected.size)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSelected(null); setUploadError(null); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Changer de fichier
              </button>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload size={22} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  Glissez un fichier ici ou <span className="text-blue-600">parcourir</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, XLSX — max 10 Mo</p>
              </div>
            </>
          )}
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-400 text-right">{progress}%</p>
          </div>
        )}

        {uploadError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertCircle size={13} /> {uploadError}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!selected || uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-medium rounded-lg transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload size={15} />
          {uploading ? 'Envoi en cours…' : 'Envoyer'}
        </button>
      </div>

      {/* Documents list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-700">
            Fichiers envoyés
            {documents.length > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">({documents.length})</span>
            )}
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Fichier</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Taille</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Statut</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => (
                <tr
                  key={doc.id}
                  className={`hover:bg-gray-50 transition-colors ${idx < documents.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">{doc.file_name}</td>
                  <td className="px-4 py-3"><TypeBadge name={doc.file_name} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatSize(doc.file_size)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadPreview(doc)}
                        disabled={!canPreview(doc.file_name)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Prévisualiser"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Télécharger"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => { closePreview(); setDeleteModal({ open: true, doc }); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
