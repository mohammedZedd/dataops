import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Loader2, FolderOpen, AlertTriangle, FileText, ImageIcon,
  FileSpreadsheet, Mic, Eye, ClipboardList, Download, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getAllDocuments, getDocumentStats, getDocumentsByClientSummary, getPresignedPreviewUrl, getPresignedDownloadUrl, createInvoiceFromDocument, markDocumentViewed } from '../api/documents';
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
                        : <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!isAudio && <Btn onClick={() => handlePreview(doc)} title="Prévisualiser" hBg="#EFF6FF" hCol="#3B82F6"><Eye size={14} /></Btn>}
                        {!isAudio && !doc.invoice_id && <Btn onClick={() => handleCreate(doc)} title="Créer facture" hBg="#FFF7ED" hCol="#EA580C" disabled={creatingInv === doc.id}>{creatingInv === doc.id ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}</Btn>}
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
    </div>
  );
}

// ─── Tiny components ─────────────────────────────────────────────────────────

function Kpi({ icon, bg, val, col, label, sub, subCol, onClick, active, accentCol }: { icon: string; bg: string; val: number; col: string; label: string; sub?: string; subCol?: string; onClick?: () => void; active?: boolean; accentCol?: string }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', border: active ? `2px solid ${accentCol ?? col}` : '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', boxShadow: active ? `0 4px 16px ${accentCol ?? col}25` : '0 1px 3px rgba(0,0,0,0.05)', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s', position: 'relative' }}
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

function Btn({ onClick, title, hBg, hCol, disabled, children }: { onClick: () => void; title: string; hBg: string; hCol: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = hBg; (e.currentTarget as HTMLButtonElement).style.color = hCol; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}>
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
