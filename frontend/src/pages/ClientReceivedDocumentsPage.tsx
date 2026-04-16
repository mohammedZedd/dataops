import { useCallback, useEffect, useState } from 'react';
import {
  FileText, ImageIcon, FileSpreadsheet, Download, Eye, X, Mic,
  Search, Inbox, Music,
} from 'lucide-react';
import { getMyDocuments, getPresignedDownloadUrl, getPresignedPreviewUrl, markAllReceivedAsViewed } from '../api/documents';
import type { ClientDocument } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function FileIcon({ name, size = 20 }: { name: string; size?: number }) {
  const t = fileType(name);
  const cfg = {
    pdf:   { icon: <FileText size={size} />,        bg: 'bg-red-100',    color: 'text-red-600'    },
    image: { icon: <ImageIcon size={size} />,        bg: 'bg-purple-100', color: 'text-purple-600' },
    excel: { icon: <FileSpreadsheet size={size} />,  bg: 'bg-green-100',  color: 'text-green-600'  },
    audio: { icon: <Music size={size} />,             bg: 'bg-violet-100', color: 'text-violet-600' },
    autre: { icon: <FileText size={size} />,          bg: 'bg-blue-100',   color: 'text-blue-600'   },
  }[t];
  return (
    <div className={`w-10 h-10 ${cfg.bg} rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
      {cfg.icon}
    </div>
  );
}

function TypeBadge({ name }: { name: string }) {
  const t = fileType(name);
  const cfg = {
    pdf:   { cls: 'bg-red-100 text-red-700',       label: 'PDF'    },
    image: { cls: 'bg-purple-100 text-purple-700', label: 'Image'  },
    excel: { cls: 'bg-green-100 text-green-700',   label: 'Excel'  },
    audio: { cls: 'bg-violet-100 text-violet-700', label: 'Audio'  },
    autre: { cls: 'bg-gray-100 text-gray-600',     label: 'Fichier'},
  }[t];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

type FilterType = 'all' | 'pdf' | 'image' | 'excel' | 'audio' | 'autre';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientReceivedDocumentsPage() {
  const [documents,   setDocuments]   = useState<ClientDocument[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState<FilterType>('all');

  // Preview modal
  const [previewDoc,     setPreviewDoc]     = useState<ClientDocument | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    setLoadError(null);
    try {
      const all = await getMyDocuments();
      setDocuments(all.filter(d => d.source === 'cabinet'));
    } catch {
      setLoadError('Impossible de charger vos documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
    markAllReceivedAsViewed().catch(() => {});
  }, [fetchDocs]);

  // ── Preview ────────────────────────────────────────────────────────────────
  function closePreview() { setPreviewDoc(null); setPreviewUrl(null); }

  async function loadPreview(doc: ClientDocument) {
    setPreviewLoading(true);
    setPreviewDoc(doc);
    try {
      const url = await getPresignedPreviewUrl(doc.id);
      setPreviewUrl(url);
    } catch { closePreview(); }
    finally { setPreviewLoading(false); }
  }

  async function handleDownload(doc: ClientDocument) {
    try {
      const url = await getPresignedDownloadUrl(doc.id);
      window.open(url, '_blank');
    } catch { /* ignore */ }
  }

  const canPreview = (name: string) => ['pdf', 'image'].includes(fileType(name));

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = documents.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'all' || fileType(d.file_name) === typeFilter;
    return matchSearch && matchType;
  });

  const newCount      = documents.filter(d => d.is_new).length;
  const hasFilters    = search !== '' || typeFilter !== 'all';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon name={previewDoc.file_name} size={16} />
                <p className="text-sm font-semibold text-gray-800 truncate">{previewDoc.file_name}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Download size={13} /> Télécharger
                </button>
                <button onClick={closePreview} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg ml-1">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 min-h-0">
              {previewLoading ? (
                <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : previewUrl ? (
                fileType(previewDoc.file_name) === 'pdf'
                  ? <iframe src={previewUrl} className="w-full h-[80vh]" title={previewDoc.file_name} />
                  : <img src={previewUrl} alt={previewDoc.file_name} className="max-w-full max-h-[80vh] object-contain p-4" />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Header gradient ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">Documents reçus</h1>
              {newCount > 0 && (
                <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-violet-600 text-white animate-pulse">
                  {newCount} nouveau{newCount > 1 ? 'x' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Consultez et téléchargez les documents envoyés par votre cabinet comptable.
            </p>
          </div>
          {!loading && (
            <div className="bg-white px-5 py-3 rounded-xl shadow-sm border border-blue-100 text-center flex-shrink-0">
              <div className="text-xs text-gray-400 mb-0.5">Total</div>
              <div className="text-3xl font-bold text-blue-600">{documents.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">document{documents.length !== 1 ? 's' : ''} reçu{documents.length !== 1 ? 's' : ''}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un fichier…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as FilterType)}
            className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer bg-white"
          >
            <option value="all">Tous les types</option>
            <option value="pdf">PDF</option>
            <option value="image">Images</option>
            <option value="excel">Excel</option>
            <option value="audio">Audio</option>
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ── Table card ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>

        ) : loadError ? (
          <div className="py-10 text-center px-6">
            <p className="text-sm font-medium text-red-600">{loadError}</p>
            <button onClick={fetchDocs} className="mt-2 text-xs text-blue-600 underline">Réessayer</button>
          </div>

        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {hasFilters ? <Search size={28} className="text-gray-400" /> : <Inbox size={28} className="text-gray-400" />}
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              {hasFilters ? 'Aucun résultat' : 'Aucun document reçu'}
            </h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              {hasFilters
                ? 'Essayez d\'autres critères de recherche.'
                : 'Votre cabinet comptable n\'a pas encore envoyé de documents.'}
            </p>
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setTypeFilter('all'); }}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Voir tous les documents
              </button>
            )}
          </div>

        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fichier</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Taille</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reçu le</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(doc => (
                  <tr
                    key={doc.id}
                    className="hover:bg-blue-50/40 transition-colors group"
                    style={{ borderLeft: doc.is_new ? '3px solid #7C3AED' : '3px solid transparent' }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileIcon name={doc.file_name} size={18} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            {doc.is_new && (
                              <span className="flex-shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-violet-600 text-white">
                                Nouveau
                              </span>
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-xs text-gray-400 italic mt-0.5 truncate max-w-[200px]">"{doc.description}"</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><TypeBadge name={doc.file_name} /></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatSize(doc.file_size)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => loadPreview(doc)}
                          disabled={!canPreview(doc.file_name)}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Aperçu"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
                          title="Télécharger"
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map(doc => (
                <div
                  key={doc.id}
                  className="p-4"
                  style={{ borderLeft: doc.is_new ? '3px solid #7C3AED' : '3px solid transparent' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileIcon name={doc.file_name} size={18} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</span>
                          {doc.is_new && (
                            <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-violet-600 text-white">Nouveau</span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-xs text-gray-400 italic mt-0.5">"{doc.description}"</p>
                        )}
                      </div>
                    </div>
                    <TypeBadge name={doc.file_name} />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-400">
                      {formatSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => loadPreview(doc)}
                        disabled={!canPreview(doc.file_name)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {hasFilters
                  ? `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''} sur ${documents.length} document${documents.length !== 1 ? 's' : ''}`
                  : `${documents.length} document${documents.length !== 1 ? 's' : ''} reçu${documents.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
