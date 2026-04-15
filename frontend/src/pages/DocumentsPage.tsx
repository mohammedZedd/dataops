import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Loader2, FolderOpen, AlertTriangle, FileText, ImageIcon,
  FileSpreadsheet, Mic, Eye, ClipboardList, Download, X, ChevronLeft, ChevronRight, Sparkles, CheckCircle,
} from 'lucide-react';
import { getAllDocuments, getDocumentStats, getDocumentsByClientSummary, getPresignedPreviewUrl, getPresignedDownloadUrl, createInvoiceFromDocument, markDocumentViewed } from '../api/documents';
import apiClient from '../api/axios';
import { formatRelDate as relDate } from '../utils/dateUtils';
import type { DocumentStats, ClientDocSummary, AdminClientDoc } from '../api/documents';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileType(n: string): 'pdf' | 'image' | 'audio' | 'excel' | 'autre' {
  const e = n.split('.').pop()?.toLowerCase() ?? '';
  if (e === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(e)) return 'image';
  if (['webm', 'mp3', 'mp4', 'ogg', 'wav'].includes(e)) return 'audio';
  if (['xlsx', 'xls'].includes(e)) return 'excel';
  return 'autre';
}

function fileIcon(n: string) {
  const t = fileType(n);
  if (t === 'pdf') return <FileText size={16} color="#EF4444" />;
  if (t === 'image') return <ImageIcon size={16} color="#3B82F6" />;
  if (t === 'audio') return <Mic size={16} color="#7C3AED" />;
  if (t === 'excel') return <FileSpreadsheet size={16} color="#16A34A" />;
  return <FileText size={16} color="#6B7280" />;
}

function formatSize(b: number | null) {
  if (!b) return '—';
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / 1048576).toFixed(1)} Mo`;
}

// relDate imported from utils/dateUtils

function highlight(text: string, q: string) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return <>{text.slice(0, i)}<mark style={{ background: '#FEF9C3', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

const TYPE_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pdf: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'PDF' },
  image: { bg: '#EFF6FF', color: '#3B82F6', border: '#BFDBFE', label: 'Image' },
  audio: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE', label: 'Audio' },
  excel: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Excel' },
  autre: { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB', label: 'Fichier' },
};
const INV_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  to_review: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'À vérifier' },
  validated: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Validée' },
  rejected: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Rejetée' },
};
const DOC_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  uploaded: { bg: '#F3F4F6', color: '#6B7280', label: 'Uploadé' },
  processing: { bg: '#EFF6FF', color: '#3B82F6', label: 'En cours' },
  processed: { bg: '#F0FDF4', color: '#16A34A', label: 'Traité' },
  error: { bg: '#FEF2F2', color: '#DC2626', label: 'Erreur' },
};

const STATUT_PILLS = ['Tous', 'Nouveaux', 'En attente', 'Validé', 'Rejeté'] as const;
type Statut = typeof STATUT_PILLS[number];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const searchRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Read initial filters from URL params (from dashboard navigation)
  const initStatus = (urlParams.get('status') as Statut) || 'Tous';
  const initPeriod = urlParams.get('period') as typeof periodFilter | null;

  const [docs, setDocs] = useState<AdminClientDoc[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [clientSummaries, setClientSummaries] = useState<ClientDocSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Statut>(STATUT_PILLS.includes(initStatus as any) ? initStatus : 'Tous');
  const [typeFilter, setTypeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all' | 'custom'>(initPeriod && ['this_month', 'last_month', 'this_quarter', 'this_year', 'all'].includes(initPeriod) ? initPeriod : 'this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Actions
  const [creatingInv, setCreatingInv] = useState<string | null>(null);

  // ─── AI agent ────────────────────────────────────────────────────────────
  interface AIAnalysisResult {
    id: string;
    document_id: string;
    document_type: string | null;
    confidence: number;
    extraction_data: Record<string, unknown> | null;
    accounting_entries: Array<{ compte_debit: string; libelle_debit?: string; compte_credit: string; libelle_credit?: string; montant: number; description?: string }> | null;
    tva_details: { tva_collectee?: number; tva_deductible?: number; regime?: string; taux_principal?: number } | null;
    alerts: string[];
    suggestions: string[];
    status: string;
    created_at: string;
  }
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AIAnalysisResult>>({});
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiToast, setAiToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [validating, setValidating] = useState(false);

  async function handleAnalyzeDocument(docId: string) {
    setAnalyzingId(docId);
    try {
      const { data } = await apiClient.post<AIAnalysisResult>(`/ai/analyze/${docId}`);
      setAnalyses(prev => ({ ...prev, [docId]: data }));
      setSelectedAnalysis(data);
      setShowAIModal(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Erreur d'analyse IA";
      setAiToast({ kind: 'err', msg: detail });
      setTimeout(() => setAiToast(null), 4000);
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleValidateAnalysis() {
    if (!selectedAnalysis) return;
    setValidating(true);
    try {
      const { data } = await apiClient.post<{ entries_created: number }>(
        `/ai/validate/${selectedAnalysis.id}`,
        { accounting_entries: selectedAnalysis.accounting_entries },
      );
      setAiToast({ kind: 'ok', msg: `${data.entries_created} écriture(s) créée(s) ✓` });
      setShowAIModal(false);
      setTimeout(() => setAiToast(null), 4000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Erreur de validation";
      setAiToast({ kind: 'err', msg: detail });
      setTimeout(() => setAiToast(null), 4000);
    } finally {
      setValidating(false);
    }
  }

  function getDocTypeLabel(t: string | null): string {
    return ({
      facture_achat: 'Facture d\'achat',
      facture_vente: 'Facture de vente',
      releve_bancaire: 'Relevé bancaire',
      note_frais: 'Note de frais',
      autre: 'Document',
    } as Record<string, string>)[t || ''] || 'Document';
  }
  function fmtMad(n: number | null | undefined): string {
    if (n == null) return '—';
    return `${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s, c] = await Promise.all([getAllDocuments(), getDocumentStats(), getDocumentsByClientSummary()]);
      setDocs(d); setStats(s); setClientSummaries(c);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close suggestions on outside click
  useEffect(() => {
    function h(e: MouseEvent) { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSugg(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, periodFilter, dateFrom, dateTo]);

  // Suggestions
  const clientSugg = search.length >= 1 ? clientSummaries.filter(c => c.client.full_name.toLowerCase().includes(search.toLowerCase()) || c.client.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4) : [];
  const fileSugg = search.length >= 2 ? docs.filter(d => d.file_name.toLowerCase().includes(search.toLowerCase())).slice(0, 3) : [];

  // Date range helper
  function getDateRange() {
    const now = new Date();
    switch (periodFilter) {
      case 'this_month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      case 'last_month': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) };
      case 'this_quarter': { const q = Math.floor(now.getMonth() / 3); return { from: new Date(now.getFullYear(), q * 3, 1), to: new Date(now.getFullYear(), q * 3 + 3, 0) }; }
      case 'this_year': return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
      case 'custom': return { from: dateFrom ? new Date(dateFrom) : null, to: dateTo ? new Date(dateTo) : null };
      default: return { from: null, to: null };
    }
  }

  function getPeriodLabel() {
    const now = new Date();
    switch (periodFilter) {
      case 'this_month': return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      case 'last_month': { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); }
      case 'this_quarter': return `T${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
      case 'this_year': return String(now.getFullYear());
      case 'all': return "tout l'historique";
      case 'custom': return dateFrom && dateTo ? `${new Date(dateFrom).toLocaleDateString('fr-FR')} → ${new Date(dateTo).toLocaleDateString('fr-FR')}` : 'période personnalisée';
    }
  }

  // Filtered docs
  const filtered = docs.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.file_name.toLowerCase().includes(q) && !(d.client_name ?? '').toLowerCase().includes(q)) return false;
    }
    if (typeFilter && fileType(d.file_name) !== typeFilter) return false;
    if (statusFilter === 'Nouveaux' && !d.is_new) return false;
    if (statusFilter === 'En attente' && d.invoice_status && d.invoice_status !== 'to_review') return false;
    if (statusFilter === 'Validé' && d.invoice_status !== 'validated') return false;
    if (statusFilter === 'Rejeté' && d.invoice_status !== 'rejected') return false;
    // Date filter
    const range = getDateRange();
    const docDate = new Date(d.uploaded_at);
    if (range.from && docDate < range.from) return false;
    if (range.to) { const end = new Date(range.to); end.setHours(23, 59, 59, 999); if (docDate > end) return false; }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const hasFilters = search || statusFilter !== 'Tous' || typeFilter || periodFilter !== 'this_month';
  const urgentClients = clientSummaries.filter(c => c.urgent_count > 0);

  async function handlePreview(doc: AdminClientDoc) {
    if (doc.is_new) { markDocumentViewed(doc.id).catch(() => {}); setDocs(p => p.map(d => d.id === doc.id ? { ...d, is_new: false } : d)); }
    try { window.open(await getPresignedPreviewUrl(doc.id), '_blank'); } catch { /* */ }
  }
  async function handleDownload(id: string) { try { window.open(await getPresignedDownloadUrl(id), '_blank'); } catch { /* */ } }
  async function handleCreate(doc: AdminClientDoc) {
    if (!doc.client_id) return; setCreatingInv(doc.id);
    try { const inv = await createInvoiceFromDocument(doc.id); navigate(`/clients/${doc.client_id}/invoices/${inv.id}`); }
    catch { /* */ } finally { setCreatingInv(null); }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>;

  return (
    <div>
      {/* Header */}
      <div style={{ paddingBottom: 20, borderBottom: '1px solid #E5E7EB', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Documents</h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Tous les documents envoyés par vos clients</p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <Kpi icon="📄" bg="#EFF6FF" val={stats.total_this_month} col="#3B82F6" label="Documents ce mois" active={statusFilter === 'Tous' && periodFilter === 'this_month'} accentCol="#3B82F6" onClick={() => { setStatusFilter('Tous'); setPeriodFilter('this_month'); setPage(1); tableRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />
          <Kpi icon="⏳" bg="#FFF7ED" val={stats.pending} col="#EA580C" label="En attente" sub={stats.urgent > 0 ? `${stats.urgent} urgents` : undefined} subCol="#DC2626" active={statusFilter === 'En attente'} accentCol="#F59E0B" onClick={() => { setStatusFilter('En attente'); setPeriodFilter('all'); setPage(1); tableRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />
          <Kpi icon="✅" bg="#F0FDF4" val={stats.validated} col="#16A34A" label="Factures validées" active={statusFilter === 'Validé'} accentCol="#16A34A" onClick={() => { setStatusFilter('Validé'); setPeriodFilter('all'); setPage(1); tableRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />
          <Kpi icon="❌" bg="#FEF2F2" val={stats.rejected} col="#DC2626" label="Rejetés / erreurs" active={statusFilter === 'Rejeté'} accentCol="#DC2626" onClick={() => { setStatusFilter('Rejeté'); setPeriodFilter('all'); setPage(1); tableRef.current?.scrollIntoView({ behavior: 'smooth' }); }} />
        </div>
      )}

      {/* Urgent banner */}
      {urgentClients.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="#92400E" />
          <span style={{ fontSize: 13, color: '#92400E', flex: 1 }}><strong>{urgentClients.length}</strong> client{urgentClients.length > 1 ? 's' : ''} en attente depuis &gt; 3 jours</span>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 20px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Smart search */}
        <div ref={searchRef} style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setShowSugg(true); }} onFocus={() => search && setShowSugg(true)}
            placeholder="Rechercher un client, un fichier…"
            style={{ width: '100%', height: 44, border: '1px solid #E5E7EB', borderRadius: showSugg && (clientSugg.length > 0 || fileSugg.length > 0) ? '10px 10px 0 0' : 10, paddingLeft: 40, paddingRight: 36, fontSize: 14, outline: 'none' }} />
          {search && <button onClick={() => { setSearch(''); setShowSugg(false); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: '#E5E7EB', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>}

          {/* Suggestions dropdown */}
          {showSugg && search.length >= 1 && (clientSugg.length > 0 || fileSugg.length > 0) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 10px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden' }}>
              {clientSugg.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', background: '#F9FAFB' }}>Clients</div>
                  {clientSugg.map(c => (
                    <div key={c.client.id} onClick={() => { setSearch(c.client.full_name); setShowSugg(false); }}
                      style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F9FAFB' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {c.client.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{highlight(c.client.full_name, search)}</div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>{c.client.name} · {c.total_documents} docs</div>
                      </div>
                      {c.pending_count > 0 && <span style={{ fontSize: 12, color: '#F59E0B' }}>⏳ {c.pending_count}</span>}
                    </div>
                  ))}
                </>
              )}
              {fileSugg.length > 0 && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', background: '#F9FAFB' }}>Fichiers</div>
                  {fileSugg.map(d => (
                    <div key={d.id} onClick={() => { setSearch(d.file_name); setShowSugg(false); }}
                      style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}>
                      {fileIcon(d.file_name)}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{highlight(d.file_name.length > 40 ? d.file_name.slice(0, 40) + '…' : d.file_name, search)}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{d.client_name}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUT_PILLS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid',
              cursor: 'pointer', background: statusFilter === s ? '#3B82F6' : '#fff',
              color: statusFilter === s ? '#fff' : '#6B7280', borderColor: statusFilter === s ? '#3B82F6' : '#E5E7EB',
            }}>{s}</button>
          ))}
        </div>

        {/* Type */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ height: 38, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, color: typeFilter ? '#111827' : '#9CA3AF' }}>
          <option value="">Type</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
          <option value="audio">Audio</option>
          <option value="excel">Excel</option>
        </select>

        {hasFilters && <button onClick={() => { setSearch(''); setStatusFilter('Tous'); setTypeFilter(''); setPeriodFilter('this_month'); setDateFrom(''); setDateTo(''); }} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réinitialiser</button>}

        {/* Period pills */}
        <div style={{ width: '100%', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {([['this_month', 'Ce mois'], ['last_month', 'Mois dernier'], ['this_quarter', 'Ce trimestre'], ['this_year', 'Cette année'], ['all', 'Tout'], ['custom', 'Personnalisé']] as const).map(([key, label]) => (
            <button key={key} onClick={() => { setPeriodFilter(key as typeof periodFilter); if (key !== 'custom') { setDateFrom(''); setDateTo(''); } }}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: periodFilter === key ? 600 : 400, border: periodFilter === key ? 'none' : '1px solid #E5E7EB', background: periodFilter === key ? '#3B82F6' : '#fff', color: periodFilter === key ? '#fff' : '#6B7280', cursor: 'pointer', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {periodFilter === 'custom' && (
          <div style={{ width: '100%', display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Du</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined}
              style={{ height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#374151', outline: 'none' }} />
            <span style={{ fontSize: 13, color: '#6B7280' }}>Au</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined}
              style={{ height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 10px', fontSize: 13, color: '#374151', outline: 'none' }} />
            {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Effacer</button>}
          </div>
        )}
      </div>

      {/* Results bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 12px' }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{total} document{total !== 1 ? 's' : ''} · {getPeriodLabel()}{search && ` · « ${search} »`}</span>
      </div>

      {/* Table */}
      <div ref={tableRef} />
      {paged.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FolderOpen size={40} color="#D1D5DB" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>{hasFilters ? 'Aucun résultat' : 'Aucun document'}</p>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{hasFilters ? 'Modifiez vos filtres.' : "Vos clients n'ont pas encore envoyé de documents."}</p>
          {hasFilters && <button onClick={() => { setSearch(''); setStatusFilter('Tous'); setTypeFilter(''); }} style={{ marginTop: 12, fontSize: 13, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Réinitialiser</button>}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1E2A4A' }}>
                {['CLIENT', 'FICHIER', 'TYPE', 'DATE', 'STATUT', 'FACTURE', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((doc, idx) => {
                const t = fileType(doc.file_name);
                const isAudio = t === 'audio';
                const isNew = doc.is_new;
                const tb = TYPE_BADGE[t] ?? TYPE_BADGE.autre;
                const ds = DOC_STATUS[doc.status] ?? DOC_STATUS.uploaded;
                const invS = doc.invoice_status ? INV_BADGE[doc.invoice_status] : null;
                const accent = isNew ? '#3B82F6' : isAudio ? '#7C3AED' : invS?.color === '#16A34A' ? '#16A34A' : invS?.color === '#C2410C' ? '#F59E0B' : invS?.color === '#DC2626' ? '#EF4444' : '#E5E7EB';
                const rowBg = isNew ? '#F0F9FF' : '#fff';
                return (
                  <tr key={doc.id} style={{ borderBottom: '1px solid #F3F4F6', boxShadow: `inset 4px 0 0 0 ${accent}`, transition: 'background 0.1s', background: rowBg }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = rowBg; }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(doc.client_name ?? '?').charAt(0).toUpperCase()}</div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{doc.client_name ?? '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {fileIcon(doc.file_name)}
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {doc.file_name}
                            {isNew && <span style={{ background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', flexShrink: 0 }}>Nouveau</span>}
                          </p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>{formatSize(doc.file_size)}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>{tb.label}</span></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>{relDate(doc.uploaded_at)}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: ds.bg, color: ds.color }}>{ds.label}</span></td>
                    <td style={{ padding: '10px 14px' }}>
                      {isAudio ? <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
                        : invS ? <button onClick={() => doc.client_id && navigate(`/clients/${doc.client_id}/invoices/${doc.invoice_id}`)} style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', background: invS.bg, color: invS.color, border: `1px solid ${invS.border}` }}>{invS.label}</button>
                        : <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>Non traitée</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!isAudio && <Btn onClick={() => handlePreview(doc)} title="Prévisualiser" hBg="#EFF6FF" hCol="#3B82F6"><Eye size={14} /></Btn>}
                        {!isAudio && (
                          <Btn
                            onClick={() => handleAnalyzeDocument(doc.id)}
                            title={analyses[doc.id] ? 'Voir l\'analyse IA' : 'Analyser avec IA'}
                            hBg="#F5F3FF" hCol="#7C3AED"
                            disabled={analyzingId === doc.id}
                            active={!!analyses[doc.id]}
                          >
                            {analyzingId === doc.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Sparkles size={14} />}
                          </Btn>
                        )}
                        {!isAudio && <Btn onClick={() => doc.invoice_id ? (doc.client_id && navigate(`/clients/${doc.client_id}/invoices/${doc.invoice_id}`)) : handleCreate(doc)} title={doc.invoice_id ? 'Voir / modifier la facture' : 'Créer facture'} hBg="#FFF7ED" hCol="#EA580C" disabled={creatingInv === doc.id}>{creatingInv === doc.id ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}</Btn>}
                        <Btn onClick={() => handleDownload(doc.id)} title="Télécharger" hBg="#F0FDF4" hCol="#16A34A"><Download size={14} /></Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>Affichage de {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} sur {total}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <PgBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={14} /></PgBtn>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <PgBtn key={p} onClick={() => setPage(p)} active={page === p}>{p}</PgBtn>
              ))}
              <PgBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={14} /></PgBtn>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>Par page:</span>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                style={{ height: 32, border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 8px', fontSize: 13 }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* AI toast */}
      {aiToast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: aiToast.kind === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${aiToast.kind === 'ok' ? '#BBF7D0' : '#FECACA'}`, color: aiToast.kind === 'ok' ? '#16A34A' : '#DC2626', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 11000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {aiToast.kind === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {aiToast.msg}
        </div>
      )}

      {/* AI analysis modal */}
      {showAIModal && selectedAnalysis && (
        <>
          <div onClick={() => setShowAIModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 780, maxHeight: '90vh', background: '#fff', borderRadius: 18, boxShadow: '0 25px 60px rgba(0,0,0,0.2)', zIndex: 10000, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#7C3AED,#2563EB)', padding: '20px 28px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} /> Analyse IA — Résultats
                </h2>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                  Confiance : {Math.round((selectedAnalysis.confidence || 0) * 100)}% · Type : {getDocTypeLabel(selectedAnalysis.document_type)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  background: selectedAnalysis.confidence > 0.8 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                  color: selectedAnalysis.confidence > 0.8 ? '#86EFAC' : '#FDE68A',
                  border: `1px solid ${selectedAnalysis.confidence > 0.8 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                }}>
                  {selectedAnalysis.confidence > 0.8 ? '✓ Haute confiance' : '⚠ Vérifier'}
                </span>
                <button onClick={() => setShowAIModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

              {/* Alerts */}
              {selectedAnalysis.alerts && selectedAnalysis.alerts.length > 0 && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  {selectedAnalysis.alerts.map((alert, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#C2410C', display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: i < selectedAnalysis.alerts.length - 1 ? 4 : 0 }}>
                      <AlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} /> {alert}
                    </div>
                  ))}
                </div>
              )}

              {/* Extracted data */}
              {selectedAnalysis.extraction_data && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Données extraites
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {(() => {
                      const ext = selectedAnalysis.extraction_data as Record<string, unknown>;
                      const fournisseur = (ext.fournisseur || {}) as Record<string, string>;
                      const totaux = (ext.totaux || {}) as Record<string, number>;
                      const fields: { label: string; value: string | null; highlight?: boolean }[] = [
                        { label: 'N° Facture', value: (ext.numero_facture as string) || null },
                        { label: 'Date', value: (ext.date as string) || null },
                        { label: 'Fournisseur', value: fournisseur.nom || null },
                        { label: 'ICE Fournisseur', value: fournisseur.ice || null },
                        { label: 'Total HT', value: totaux.total_ht ? fmtMad(totaux.total_ht) : null },
                        { label: 'Total TVA', value: totaux.total_tva ? fmtMad(totaux.total_tva) : null },
                        { label: 'Total TTC', value: totaux.total_ttc ? fmtMad(totaux.total_ttc) : null, highlight: true },
                        { label: 'Mode paiement', value: (ext.mode_paiement as string) || null },
                      ];
                      return fields.filter(f => f.value).map((f, i) => (
                        <div key={i} style={{ background: f.highlight ? '#F0FDF4' : '#F9FAFB', borderRadius: 8, padding: '10px 14px', border: f.highlight ? '1px solid #BBF7D0' : '1px solid #F3F4F6' }}>
                          <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: f.highlight ? '#16A34A' : '#111827' }}>{f.value}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* TVA */}
              {selectedAnalysis.tva_details && (selectedAnalysis.tva_details.tva_collectee != null || selectedAnalysis.tva_details.tva_deductible != null) && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 }}>Détail TVA</h3>
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>TVA Collectée</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>{fmtMad(selectedAnalysis.tva_details.tva_collectee || 0)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>TVA Déductible</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>{fmtMad(selectedAnalysis.tva_details.tva_deductible || 0)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>TVA Nette</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1D4ED8' }}>{fmtMad((selectedAnalysis.tva_details.tva_collectee || 0) - (selectedAnalysis.tva_details.tva_deductible || 0))}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Accounting entries */}
              {selectedAnalysis.accounting_entries && selectedAnalysis.accounting_entries.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Écritures comptables proposées</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>CGNC / Plan Comptable Marocain</span>
                  </h3>
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr 1.2fr', background: '#0F172A', color: '#94A3B8', padding: '10px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                      <div>Cpt Débit</div><div>Libellé Débit</div><div>Cpt Crédit</div><div>Libellé Crédit</div><div style={{ textAlign: 'right' }}>Montant</div>
                    </div>
                    {selectedAnalysis.accounting_entries.map((e, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr 1.2fr', padding: '12px 14px', fontSize: 12, borderBottom: i < (selectedAnalysis.accounting_entries?.length || 0) - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'center', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <div style={{ fontWeight: 700, color: '#3B82F6', fontFamily: 'monospace' }}>{e.compte_debit}</div>
                        <div style={{ color: '#374151' }}>{e.libelle_debit}</div>
                        <div style={{ fontWeight: 700, color: '#16A34A', fontFamily: 'monospace' }}>{e.compte_credit}</div>
                        <div style={{ color: '#374151' }}>{e.libelle_credit}</div>
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmtMad(e.montant)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {selectedAnalysis.suggestions && selectedAnalysis.suggestions.length > 0 && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#16A34A', marginBottom: 8 }}>Suggestions IA</div>
                  {selectedAnalysis.suggestions.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#166534', marginBottom: 4 }}>→ {s}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                Statut : {selectedAnalysis.status === 'validated' ? '✓ Validée' : 'En attente de validation'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowAIModal(false)} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }}>
                  Fermer
                </button>
                <button
                  onClick={handleValidateAnalysis}
                  disabled={validating || selectedAnalysis.status === 'validated' || !selectedAnalysis.accounting_entries || selectedAnalysis.accounting_entries.length === 0}
                  style={{
                    padding: '10px 24px',
                    background: selectedAnalysis.status === 'validated' ? '#9CA3AF' : 'linear-gradient(135deg,#16A34A,#15803D)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: validating ? 'wait' : (selectedAnalysis.status === 'validated' ? 'not-allowed' : 'pointer'),
                    fontWeight: 600, fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: validating ? 0.7 : 1,
                  }}
                >
                  {validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {validating ? 'Validation…' : 'Valider et créer les écritures'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tiny components ─────────────────────────────────────────────────────────

function Kpi({ icon, bg, val, col, label, sub, subCol, onClick, active, accentCol }: { icon: string; bg: string; val: number; col: string; label: string; sub?: string; subCol?: string; onClick?: () => void; active?: boolean; accentCol?: string }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', boxShadow: active ? `0 0 0 1px ${accentCol ?? col}, 0 4px 16px ${accentCol ?? col}25` : '0 1px 3px rgba(0,0,0,0.05)', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s', position: 'relative' }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; } }}
      onMouseLeave={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; } }}>
      {active && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: accentCol ?? col }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
        <span style={{ fontSize: 28, fontWeight: 700, color: col }}>{val}</span>
      </div>
      <p style={{ fontSize: 13, color: '#6B7280' }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: subCol ?? '#9CA3AF', marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function Btn({ onClick, title, hBg, hCol, disabled, active, children }: { onClick: () => void; title: string; hBg: string; hCol: string; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  const baseBg = active ? hBg : 'transparent';
  const baseCol = active ? hCol : '#9CA3AF';
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: baseBg, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: baseCol, transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = hBg; (e.currentTarget as HTMLButtonElement).style.color = hCol; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = baseBg; (e.currentTarget as HTMLButtonElement).style.color = baseCol; }}>
      {children}
    </button>
  );
}

function PgBtn({ onClick, disabled, active, children }: { onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 400,
      border: active ? 'none' : '1px solid #E5E7EB', cursor: disabled ? 'default' : 'pointer',
      background: active ? '#3B82F6' : '#fff', color: active ? '#fff' : disabled ? '#D1D5DB' : '#374151',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}
