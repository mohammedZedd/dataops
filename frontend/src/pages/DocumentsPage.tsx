import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, ImageIcon, FileSpreadsheet, Mic, Search,
  Download, Eye, ClipboardList, Loader2, FolderOpen, X,
} from 'lucide-react';
import { getAllDocuments, getDocumentStats, getPresignedPreviewUrl, getPresignedDownloadUrl, createInvoiceFromDocument } from '../api/documents';
import type { AdminClientDoc, DocumentStats } from '../api/documents';
import { getClients } from '../api/clients';
import { useAuth } from '../context/AuthContext';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import type { Client } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileType(name: string): 'pdf' | 'image' | 'audio' | 'excel' | 'autre' {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (['webm', 'mp3', 'mp4', 'ogg', 'wav'].includes(ext)) return 'audio';
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  return 'autre';
}

function fileIcon(name: string) {
  const t = fileType(name);
  if (t === 'pdf') return <FileText size={16} color="#EF4444" />;
  if (t === 'image') return <ImageIcon size={16} color="#3B82F6" />;
  if (t === 'audio') return <Mic size={16} color="#7C3AED" />;
  if (t === 'excel') return <FileSpreadsheet size={16} color="#16A34A" />;
  return <FileText size={16} color="#6B7280" />;
}

function formatSize(b: number | null) {
  if (!b) return '—';
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`;
}

function relativeDate(d: string) {
  const now = Date.now();
  const diff = now - new Date(d).getTime();
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pdf:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'PDF' },
  image: { bg: '#EFF6FF', color: '#3B82F6', border: '#BFDBFE', label: 'Image' },
  audio: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE', label: 'Audio' },
  excel: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Excel' },
  autre: { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB', label: 'Fichier' },
};

const INV_BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  to_review: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', label: 'À vérifier' },
  validated: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Validée' },
  rejected:  { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Rejetée' },
};

const DOC_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  uploaded:   { bg: '#F3F4F6', color: '#6B7280', label: 'Uploadé' },
  processing: { bg: '#EFF6FF', color: '#3B82F6', label: 'En cours' },
  processed:  { bg: '#F0FDF4', color: '#16A34A', label: 'Traité' },
  error:      { bg: '#FEF2F2', color: '#DC2626', label: 'Erreur' },
};

const STATUT_FILTERS = ['Tous', 'En attente', 'Validé', 'Rejeté'] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [docs, setDocs] = useState<AdminClientDoc[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof STATUT_FILTERS[number]>('Tous');
  const [typeFilter, setTypeFilter] = useState('');

  // Actions
  const [creatingInv, setCreatingInv] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s, c] = await Promise.all([getAllDocuments(), getDocumentStats(), getClients()]);
      setDocs(d);
      setStats(s);
      setClients(c);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter logic
  const filtered = docs.filter(doc => {
    if (search) {
      const q = search.toLowerCase();
      const match = doc.file_name.toLowerCase().includes(q) || (doc.client_name ?? '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (clientFilter && doc.client_id !== clientFilter) return false;
    if (typeFilter && fileType(doc.file_name) !== typeFilter) return false;
    if (statusFilter === 'En attente' && doc.invoice_status && doc.invoice_status !== 'to_review') return false;
    if (statusFilter === 'Validé' && doc.invoice_status !== 'validated') return false;
    if (statusFilter === 'Rejeté' && doc.invoice_status !== 'rejected') return false;
    return true;
  });

  const hasFilters = search || clientFilter || statusFilter !== 'Tous' || typeFilter;

  async function handlePreview(docId: string) {
    try { const url = await getPresignedPreviewUrl(docId); window.open(url, '_blank'); } catch { /* */ }
  }
  async function handleDownload(docId: string) {
    try { const url = await getPresignedDownloadUrl(docId); window.open(url, '_blank'); } catch { /* */ }
  }
  async function handleCreateInvoice(doc: AdminClientDoc) {
    if (!doc.client_id) return;
    setCreatingInv(doc.id);
    try {
      const inv = await createInvoiceFromDocument(doc.id);
      navigate(`/clients/${doc.client_id}/invoices/${inv.id}`);
    } catch { /* */ }
    finally { setCreatingInv(null); }
  }

  const clientNames = clients.map(c => c.name);

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>
  );

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
          <KpiCard icon="📄" iconBg="#EFF6FF" value={stats.total_this_month} color="#3B82F6" label="Documents ce mois" />
          <KpiCard icon="⏳" iconBg="#FFF7ED" value={stats.pending} color="#EA580C" label="En attente" sub={stats.urgent > 0 ? `${stats.urgent} urgents (> 3j)` : undefined} subColor="#DC2626" />
          <KpiCard icon="✅" iconBg="#F0FDF4" value={stats.validated} color="#16A34A" label="Factures validées" />
          <KpiCard icon="❌" iconBg="#FEF2F2" value={stats.rejected} color="#DC2626" label="Rejetés / erreurs" />
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher fichier, client…"
            style={{ width: '100%', height: 40, border: '1px solid #E5E7EB', borderRadius: 8, paddingLeft: 34, paddingRight: 12, fontSize: 13, outline: 'none' }} />
        </div>
        {/* Client filter */}
        <div style={{ width: 200 }}>
          <SearchableSelect options={clientNames} value={clients.find(c => c.id === clientFilter)?.name ?? ''} onChange={v => {
            const c = clients.find(cl => cl.name === v);
            setClientFilter(c?.id ?? '');
          }} placeholder="Tous les clients" />
        </div>
        {/* Status pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUT_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid',
              cursor: 'pointer', transition: 'all 0.15s',
              background: statusFilter === s ? '#3B82F6' : '#fff',
              color: statusFilter === s ? '#fff' : '#6B7280',
              borderColor: statusFilter === s ? '#3B82F6' : '#E5E7EB',
            }}>{s}</button>
          ))}
        </div>
        {/* Type filter */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ height: 40, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px', fontSize: 13, color: typeFilter ? '#111827' : '#9CA3AF' }}>
          <option value="">Type</option>
          <option value="pdf">PDF</option>
          <option value="image">Image</option>
          <option value="audio">Audio</option>
          <option value="excel">Excel</option>
        </select>
        {/* Reset */}
        {hasFilters && (
          <button onClick={() => { setSearch(''); setClientFilter(''); setStatusFilter('Tous'); setTypeFilter(''); }}
            style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>{filtered.length} document{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FolderOpen size={40} color="#D1D5DB" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>{hasFilters ? 'Aucun résultat' : 'Aucun document'}</p>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{hasFilters ? 'Aucun document ne correspond à vos filtres.' : "Vos clients n'ont pas encore envoyé de documents."}</p>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setClientFilter(''); setStatusFilter('Tous'); setTypeFilter(''); }}
              style={{ marginTop: 12, fontSize: 13, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1E2A4A' }}>
                {['CLIENT', 'FICHIER', 'TYPE', 'DATE', 'STATUT', 'FACTURE', 'ACTIONS'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, idx) => {
                const t = fileType(doc.file_name);
                const isAudio = t === 'audio';
                const tb = TYPE_BADGE[t] ?? TYPE_BADGE.autre;
                const ds = DOC_STATUS[doc.status] ?? DOC_STATUS.uploaded;
                const invS = doc.invoice_status ? INV_BADGE[doc.invoice_status] : null;
                const accentColor = isAudio ? '#7C3AED' : invS?.color === '#16A34A' ? '#16A34A' : invS?.color === '#C2410C' ? '#F59E0B' : invS?.color === '#DC2626' ? '#EF4444' : '#E5E7EB';
                return (
                  <tr key={doc.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none', boxShadow: `inset 4px 0 0 0 ${accentColor}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#fff'; }}>
                    {/* CLIENT */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(doc.client_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{doc.client_name ?? '—'}</span>
                      </div>
                    </td>
                    {/* FICHIER */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {fileIcon(doc.file_name)}
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>{formatSize(doc.file_size)}</p>
                        </div>
                      </div>
                    </td>
                    {/* TYPE */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>{tb.label}</span>
                    </td>
                    {/* DATE */}
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {relativeDate(doc.uploaded_at)}
                    </td>
                    {/* STATUT DOC */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12, background: ds.bg, color: ds.color }}>{ds.label}</span>
                    </td>
                    {/* FACTURE */}
                    <td style={{ padding: '12px 14px' }}>
                      {isAudio ? (
                        <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
                      ) : invS ? (
                        <button onClick={() => doc.client_id && navigate(`/clients/${doc.client_id}/invoices/${doc.invoice_id}`)}
                          style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', background: invS.bg, color: invS.color, border: `1px solid ${invS.border}` }}>
                          {invS.label}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#D1D5DB' }}>—</span>
                      )}
                    </td>
                    {/* ACTIONS */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!isAudio && (
                          <ActionBtn onClick={() => handlePreview(doc.id)} title="Prévisualiser" hoverBg="#EFF6FF" hoverColor="#3B82F6">
                            <Eye size={14} />
                          </ActionBtn>
                        )}
                        {!isAudio && !doc.invoice_id && (
                          <ActionBtn onClick={() => handleCreateInvoice(doc)} title="Créer facture" hoverBg="#FFF7ED" hoverColor="#EA580C" disabled={creatingInv === doc.id}>
                            {creatingInv === doc.id ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => handleDownload(doc.id)} title="Télécharger" hoverBg="#F0FDF4" hoverColor="#16A34A">
                          <Download size={14} />
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function KpiCard({ icon, iconBg, value, color, label, sub, subColor }: {
  icon: string; iconBg: string; value: number; color: string; label: string; sub?: string; subColor?: string;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
        <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
      </div>
      <p style={{ fontSize: 13, color: '#6B7280' }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: subColor ?? '#9CA3AF', marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function ActionBtn({ onClick, title, hoverBg, hoverColor, disabled, children }: {
  onClick: () => void; title: string; hoverBg: string; hoverColor: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.background = hoverBg; (e.currentTarget as HTMLButtonElement).style.color = hoverColor; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}>
      {children}
    </button>
  );
}
