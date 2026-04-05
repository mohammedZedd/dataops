import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';

interface Stats {
  period: { month: string; label: string };
  clients: { total: number; new_this_month: number };
  documents: { this_month: number; prev_month: number; diff: number };
  invoices: { total: number; validated: number; to_review: number; rejected: number; validation_rate: number };
  monthly_tracking: { reception: { count: number; status: string }; processing: { count: number; status: string }; validation: { count: number; status: string } };
  recent_activity: { client_name: string; description: string; time: string }[];
  invoices_to_validate: { id: string; invoice_number: string; supplier_name: string; total_amount: number; client_name: string; direction: string }[];
}

function timeAgo(d: string) { const ms = Date.now() - new Date(d).getTime(); if (ms < 3600000) return `${Math.max(1, Math.floor(ms / 60000))} min`; if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`; return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
function greeting() { const h = new Date().getHours(); if (h < 12) return 'Bonjour'; if (h < 18) return 'Bon après-midi'; return 'Bonsoir'; }

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try { const { data } = await apiClient.get('/dashboard/stats'); setStats(data); } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 60000); return () => clearInterval(t); }, [fetch_]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>;

  const s = stats;
  const name = user?.company_name ?? `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{greeting()}, {name}</h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>Voici le résumé de votre activité · {s?.period?.label ?? ''}</p>
        </div>
        <button onClick={() => { setLoading(true); fetch_(); }} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Kpi icon={<FileText size={20} color="#3B82F6" />} bg="#EFF6FF" value={s?.documents?.this_month ?? 0} label="Documents ce mois" sub={s?.documents?.diff !== undefined ? `${s.documents.diff >= 0 ? '+' : ''}${s.documents.diff} vs mois dernier` : undefined} />
        <Kpi icon={<Clock size={20} color="#F59E0B" />} bg="#FFF7ED" value={s?.invoices?.to_review ?? 0} label="À traiter" />
        <Kpi icon={<CheckCircle2 size={20} color="#16A34A" />} bg="#F0FDF4" value={s?.invoices?.validated ?? 0} label="Validées" sub={`${s?.invoices?.validation_rate ?? 0}% ce mois`} />
        <Kpi icon={<AlertTriangle size={20} color="#DC2626" />} bg="#FEF2F2" value={s?.invoices?.rejected ?? 0} label="Rejetées" />
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Suivi mensuel */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Suivi mensuel</h3>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{s?.period?.month}</span>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: '#3B82F6' }}>{s?.invoices?.validation_rate ?? 0}%</span>
            <p style={{ fontSize: 13, color: '#6B7280' }}>complétés ce mois</p>
            <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, marginTop: 8 }}>
              <div style={{ height: '100%', background: '#3B82F6', borderRadius: 3, width: `${s?.invoices?.validation_rate ?? 0}%`, transition: 'width 1s ease-out' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Réception', count: s?.monthly_tracking?.reception?.count ?? 0, status: s?.monthly_tracking?.reception?.status ?? 'pending', desc: 'documents reçus' },
              { label: 'Traitement', count: s?.monthly_tracking?.processing?.count ?? 0, status: s?.monthly_tracking?.processing?.status ?? 'pending', desc: 'pièces extraites' },
              { label: 'Validation', count: s?.monthly_tracking?.validation?.count ?? 0, status: s?.monthly_tracking?.validation?.status ?? 'pending', desc: 'factures validées' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.status === 'completed' ? '#DCFCE7' : step.status === 'in_progress' ? '#FEF3C7' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  {step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '⏳' : '○'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{step.label}</p>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>{step.count} {step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Factures à valider */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Factures à valider</h3>
              <button onClick={() => navigate('/documents')} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Tout voir <ArrowRight size={12} /></button>
            </div>
            {(s?.invoices_to_validate ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>Aucune facture en attente</p>
            ) : (s?.invoices_to_validate ?? []).map(inv => (
              <div key={inv.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{inv.supplier_name || inv.invoice_number || 'Facture'}</p><p style={{ fontSize: 12, color: '#6B7280' }}>{inv.client_name}</p></div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{inv.total_amount ? `${inv.total_amount.toLocaleString('fr-MA')} MAD` : '—'}</span>
              </div>
            ))}
          </div>

          {/* Activité récente */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Activité récente</h3>
              <button onClick={() => navigate('/documents')} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Tout voir <ArrowRight size={12} /></button>
            </div>
            {(s?.recent_activity ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>Aucune activité récente</p>
            ) : (s?.recent_activity ?? []).map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{a.client_name.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{a.client_name}</p><p style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{a.description}</p></div>
                <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{timeAgo(a.time)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, bg, value, label, sub }: { icon: React.ReactNode; bg: string; value: number; label: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{value}</span>
      </div>
      <p style={{ fontSize: 13, color: '#6B7280' }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</p>}
    </div>
  );
}
