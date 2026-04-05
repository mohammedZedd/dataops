import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, FolderOpen, ChevronRight, AlertTriangle } from 'lucide-react';
import { getDocumentStats, getDocumentsByClientSummary } from '../api/documents';
import type { DocumentStats, ClientDocSummary } from '../api/documents';

function relativeDate(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 3600000) return `Il y a ${Math.max(1, Math.floor(diff / 60000))} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const STATUT_FILTERS = ['Tous', 'En attente', 'Validés', 'Rejetés'] as const;
type StatutFilter = typeof STATUT_FILTERS[number];

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [clients, setClients] = useState<ClientDocSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatutFilter>('Tous');
  const [sort, setSort] = useState<'recent' | 'urgent' | 'name'>('recent');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([getDocumentStats(), getDocumentsByClientSummary()]);
      setStats(s);
      setClients(c);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter
  const filtered = clients.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.client.full_name.toLowerCase().includes(q) && !c.client.name.toLowerCase().includes(q) && !(c.client.email ?? '').toLowerCase().includes(q)) return false;
    }
    if (statusFilter === 'En attente' && c.pending_count === 0) return false;
    if (statusFilter === 'Validés' && c.validated_count === 0) return false;
    if (statusFilter === 'Rejetés' && c.rejected_count === 0) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'urgent') return b.urgent_count - a.urgent_count || new Date(b.last_upload_at).getTime() - new Date(a.last_upload_at).getTime();
    if (sort === 'name') return a.client.full_name.localeCompare(b.client.full_name);
    return new Date(b.last_upload_at).getTime() - new Date(a.last_upload_at).getTime();
  });

  const totalDocs = filtered.reduce((s, c) => s + c.total_documents, 0);
  const urgentClients = clients.filter(c => c.urgent_count > 0);
  const hasFilters = search || statusFilter !== 'Tous';

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
          <KpiCard icon="📄" iconBg="#EFF6FF" value={stats.total_this_month} color="#3B82F6" label="Documents ce mois" />
          <KpiCard icon="⏳" iconBg="#FFF7ED" value={stats.pending} color="#EA580C" label="En attente" sub={stats.urgent > 0 ? `${stats.urgent} urgents (> 3j)` : undefined} subColor="#DC2626" />
          <KpiCard icon="✅" iconBg="#F0FDF4" value={stats.validated} color="#16A34A" label="Factures validées" />
          <KpiCard icon="❌" iconBg="#FEF2F2" value={stats.rejected} color="#DC2626" label="Rejetés / erreurs" />
        </div>
      )}

      {/* Urgent banner */}
      {urgentClients.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="#92400E" />
          <span style={{ fontSize: 13, color: '#92400E', flex: 1 }}>
            <strong>{urgentClients.length} client{urgentClients.length > 1 ? 's' : ''}</strong> {urgentClients.length > 1 ? 'ont' : 'a'} des documents en attente depuis plus de 3 jours
          </span>
          <button onClick={() => setSort('urgent')} style={{ fontSize: 12, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Voir les urgents
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client…"
            style={{ width: '100%', height: 38, border: '1px solid #E5E7EB', borderRadius: 8, paddingLeft: 34, paddingRight: 12, fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUT_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: '1px solid',
              cursor: 'pointer', transition: 'all 0.15s',
              background: statusFilter === s ? '#3B82F6' : '#fff',
              color: statusFilter === s ? '#fff' : '#6B7280',
              borderColor: statusFilter === s ? '#3B82F6' : '#E5E7EB',
            }}>{s}</button>
          ))}
        </div>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setStatusFilter('Tous'); }}
            style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Sort + count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>
          {sorted.length} client{sorted.length !== 1 ? 's' : ''} · {totalDocs} document{totalDocs !== 1 ? 's' : ''} au total
        </span>
        <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
          <span style={{ color: '#9CA3AF' }}>Trier par :</span>
          {([['recent', 'Récent'], ['urgent', 'Urgents'], ['name', 'Nom']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSort(key as typeof sort)}
              style={{ color: sort === key ? '#3B82F6' : '#6B7280', fontWeight: sort === key ? 600 : 400, background: 'none', border: 'none', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Client cards */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FolderOpen size={40} color="#D1D5DB" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>{hasFilters ? 'Aucun client trouvé' : 'Aucun document reçu'}</p>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{hasFilters ? 'Aucun client ne correspond à votre recherche.' : "Vos clients n'ont pas encore envoyé de documents."}</p>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setStatusFilter('Tous'); }}
              style={{ marginTop: 12, fontSize: 13, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(c => {
            const accentColor = c.urgent_count > 0 ? '#EF4444' : c.pending_count > 0 ? '#F59E0B' : c.validated_count > 0 ? '#16A34A' : '#E5E7EB';
            const initials = c.client.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <div key={c.client.id}
                onClick={() => navigate(`/clients/${c.client.id}?tab=documents`)}
                style={{
                  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
                  padding: '20px 24px', cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: `inset 4px 0 0 0 ${accentColor}`,
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#F8FAFC'; el.style.borderColor = '#93C5FD'; el.style.boxShadow = `inset 4px 0 0 0 ${accentColor}, 0 2px 8px rgba(59,130,246,0.08)`; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.background = '#fff'; el.style.borderColor = '#E5E7EB'; el.style.boxShadow = `inset 4px 0 0 0 ${accentColor}`; }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{c.client.full_name}</p>
                    <p style={{ fontSize: 13, color: '#6B7280' }}>{c.client.email ?? ''}{c.client.email && c.client.name ? ' · ' : ''}{c.client.name}</p>
                  </div>
                  <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{relativeDate(c.last_upload_at)}</span>
                  <ChevronRight size={16} color="#D1D5DB" />
                </div>

                {/* Stats pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <StatPill icon="📄" label={`${c.total_documents} document${c.total_documents > 1 ? 's' : ''}`} bg="#F3F4F6" color="#6B7280" />
                  {c.pending_count > 0 && <StatPill icon="⏳" label={`${c.pending_count} à traiter`} bg="#FFF7ED" color="#C2410C" />}
                  {c.validated_count > 0 && <StatPill icon="✅" label={`${c.validated_count} validée${c.validated_count > 1 ? 's' : ''}`} bg="#F0FDF4" color="#16A34A" />}
                  {c.rejected_count > 0 && <StatPill icon="❌" label={`${c.rejected_count} rejetée${c.rejected_count > 1 ? 's' : ''}`} bg="#FEF2F2" color="#DC2626" />}
                </div>

                {/* Recent files */}
                {c.recent_files.length > 0 && (
                  <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                    {c.recent_files.slice(0, 2).map(f => f.length > 28 ? f.slice(0, 28) + '…' : f).join(', ')}
                    {c.total_documents > 2 && `, +${c.total_documents - 2} autre${c.total_documents - 2 > 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

function StatPill({ icon, label, bg, color }: { icon: string; label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: bg, color, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {icon} {label}
    </span>
  );
}
