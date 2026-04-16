import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatTimeAgo as timeAgo } from '../utils/dateUtils';

interface Stats {
  period: { month: string; label: string };
  clients: { total: number; new_this_month: number };
  documents: { this_month: number; prev_month: number; diff: number };
  invoices: { total: number; validated: number; to_review: number; rejected: number; validation_rate: number };
  monthly_tracking: { reception: { count: number; status: string }; processing: { count: number; status: string }; validation: { count: number; status: string } };
  recent_activity: { client_name: string; description: string; time: string }[];
  invoices_to_validate: { id: string; invoice_number: string; supplier_name: string; total_amount: number; client_name: string; direction: string }[];
}

function greeting() { const h = new Date().getHours(); if (h < 12) return 'Bonjour'; if (h < 18) return 'Bon après-midi'; return 'Bonsoir'; }

export default function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'client') return <ClientDashboard />;
  return <AdminDashboard />;
}

function AdminDashboard() {
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
        <Kpi icon={<FileText size={20} color="#3B82F6" />} bg="#EFF6FF" value={s?.documents?.this_month ?? 0} label="Documents ce mois" sub={s?.documents?.diff !== undefined ? `${s.documents.diff >= 0 ? '+' : ''}${s.documents.diff} vs mois dernier` : undefined} onClick={() => navigate('/documents?period=this_month')} title="Voir tous les documents" />
        <Kpi icon={<Clock size={20} color="#F59E0B" />} bg="#FFF7ED" value={s?.invoices?.to_review ?? 0} label="À traiter" onClick={() => navigate('/documents?status=En+attente')} title="Voir les documents en attente" />
        <Kpi icon={<CheckCircle2 size={20} color="#16A34A" />} bg="#F0FDF4" value={s?.invoices?.validated ?? 0} label="Validées" sub={`${s?.invoices?.validation_rate ?? 0}% ce mois`} onClick={() => navigate('/documents?status=Valid%C3%A9')} title="Voir les factures validées" />
        <Kpi icon={<AlertTriangle size={20} color="#DC2626" />} bg="#FEF2F2" value={s?.invoices?.rejected ?? 0} label="Rejetées" onClick={() => navigate('/documents?status=Rejet%C3%A9')} title="Voir les factures rejetées" />
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
              <div key={i} onClick={() => navigate(i === 0 ? '/documents?period=this_month' : i === 1 ? '/documents?status=En+attente' : '/documents?status=Valid%C3%A9')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#EFF6FF'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}>
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
              <button onClick={() => navigate('/documents?status=En+attente')} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>Tout voir <ArrowRight size={12} /></button>
            </div>
            {(s?.invoices_to_validate ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>Aucune facture en attente</p>
            ) : (s?.invoices_to_validate ?? []).map(inv => (
              <div key={inv.id} onClick={() => navigate('/documents')} style={{ padding: '10px 4px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 6, transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
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

function Kpi({ icon, bg, value, label, sub, onClick, title }: { icon: React.ReactNode; bg: string; value: number; label: string; sub?: string; onClick?: () => void; title?: string }) {
  return (
    <div title={title} onClick={onClick} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s' }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#BFDBFE'; } }}
      onMouseLeave={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#E5E7EB'; } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{value}</span>
      </div>
      <p style={{ fontSize: 13, color: '#6B7280' }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

// ─── Client Dashboard ────────────────────────────────────────────────────────

interface ClientStats {
  documents: { total: number; this_month: number; pending: number };
  invoices: { total: number; validated: number; to_review: number; rejected: number };
  recent_documents: { id: string; filename: string; status: string; created_at: string; invoice_status: string | null }[];
  unread_messages: number;
}

function ClientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [s, setS] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try { const { data } = await apiClient.get('/dashboard/client-stats'); setS(data); } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 60000); return () => clearInterval(t); }, [fetch_]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={24} className="text-blue-500 animate-spin" /></div>;

  const firstName = user?.first_name ?? '';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{greet}, {firstName} !</h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <CKpi icon="📄" bg="#EFF6FF" value={s?.documents?.total ?? 0} label="Documents envoyés" sub={`${s?.documents?.this_month ?? 0} ce mois`} onClick={() => navigate('/client/documents')} />
        <CKpi icon="⏳" bg="#FFF7ED" value={s?.documents?.pending ?? 0} label="En attente" sub={s?.documents?.pending ? 'En cours de traitement' : 'Tout est traité'} onClick={() => navigate('/client/documents')} />
        <CKpi icon="✅" bg="#F0FDF4" value={s?.invoices?.validated ?? 0} label="Factures validées" sub={`sur ${s?.invoices?.total ?? 0} total`} onClick={() => navigate('/client/documents')} />
        <CKpi icon="💬" bg="#F5F3FF" value={s?.unread_messages ?? 0} label="Messages non lus" sub={s?.unread_messages ? 'Votre comptable a répondu' : 'Aucun nouveau message'} onClick={() => navigate('/client/messages')} highlight={!!s?.unread_messages} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent docs */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>Mes derniers documents</span>
            <button onClick={() => navigate('/client/documents')} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>Tout voir →</button>
          </div>
          {(s?.recent_documents ?? []).length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9CA3AF' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>📂</p>
              <p style={{ fontSize: 13 }}>Aucun document envoyé</p>
              <button onClick={() => navigate('/client/documents')} style={{ marginTop: 12, padding: '8px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>+ Envoyer un document</button>
            </div>
          ) : (s?.recent_documents ?? []).map((d, i) => (
            <div key={d.id} style={{ padding: '12px 20px', borderBottom: i < (s?.recent_documents?.length ?? 0) - 1 ? '1px solid #F9FAFB' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>{d.filename?.endsWith('.pdf') ? '📄' : d.filename?.match(/\.(webm|mp3)$/i) ? '🎤' : '🖼️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{timeAgo(d.created_at)}</p>
              </div>
              {d.invoice_status && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: d.invoice_status === 'validated' ? '#F0FDF4' : d.invoice_status === 'to_review' ? '#FFF7ED' : '#FEF2F2', color: d.invoice_status === 'validated' ? '#16A34A' : d.invoice_status === 'to_review' ? '#D97706' : '#DC2626' }}>{d.invoice_status === 'validated' ? 'Validée' : d.invoice_status === 'to_review' ? 'En cours' : 'Rejetée'}</span>}
            </div>
          ))}
        </div>

        {/* Quick actions + invoice status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)', borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
            <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Actions rapides</p>
            {[{ icon: '📤', label: 'Envoyer un document', path: '/client/documents' }, { icon: '💬', label: 'Contacter mon comptable', path: '/client/messages', badge: s?.unread_messages }, { icon: '👤', label: 'Mon profil', path: '/client/profile' }].map((a, i) => (
              <button key={i} onClick={() => navigate(a.path)} style={{ width: '100%', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', marginBottom: 8, transition: 'background 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span><span style={{ flex: 1 }}>{a.label}</span>
                {a.badge ? <span style={{ background: '#EF4444', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{a.badge}</span> : null}
                <span style={{ opacity: 0.6 }}>→</span>
              </button>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 15, color: '#111827', marginBottom: 12 }}>Statut de mes factures</p>
            {[{ label: 'Validées', count: s?.invoices?.validated ?? 0, icon: '✅', bg: '#F0FDF4', color: '#16A34A' }, { label: 'En traitement', count: s?.invoices?.to_review ?? 0, icon: '⏳', bg: '#FFF7ED', color: '#D97706' }, { label: 'Rejetées', count: s?.invoices?.rejected ?? 0, icon: '❌', bg: '#FEF2F2', color: '#DC2626' }].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '1px solid #F9FAFB' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>{item.icon}</span><span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span></div>
                <span style={{ background: item.bg, color: item.color, borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CKpi({ icon, bg, value, label, sub, onClick, highlight }: { icon: string; bg: string; value: number; label: string; sub?: string; onClick?: () => void; highlight?: boolean }) {
  return (
    <div onClick={onClick} style={{ background: '#fff', border: highlight ? '1.5px solid #7C3AED' : '1px solid #E5E7EB', borderRadius: 12, padding: '20px 24px', cursor: onClick ? 'pointer' : 'default', boxShadow: highlight ? '0 4px 16px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value}</div>
      <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{label}</p>
      {sub && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}
