import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users2, Plus, Search, Mail, Phone, X, Calendar, Loader2, AlertCircle,
  Briefcase, CheckCircle, Clock, TrendingUp, Ban, Power,
} from 'lucide-react';
import apiClient from '../api/axios';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: string;
  role_label: string;
  is_active: boolean;
  created_at: string;
  last_seen: string | null;
  clients_count: number;
  tasks_total: number;
  tasks_in_progress: number;
  tasks_done: number;
  tasks_overdue: number;
  workload: 'green' | 'orange' | 'red';
}

interface Metrics {
  active_count: number;
  clients_count: number;
  tasks_in_progress: number;
  tasks_overdue: number;
}

interface AssignedClient {
  id: string;
  name: string;
  open_tasks: number;
  total_tasks: number;
  last_activity: string | null;
}

interface MemberTask {
  id: string;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  progress: number;
  due_date: string | null;
  client_id: string | null;
  client_name: string | null;
  is_overdue: boolean;
}

interface Performance {
  weeks: { label: string; count: number }[];
  completion_rate: number;
  avg_processing_days: number;
  total_done: number;
}

interface Activity { type: string; at: string; label: string; client_name: string }

interface MemberDetail {
  member: Member;
  clients: AssignedClient[];
  tasks: MemberTask[];
  performance: Performance;
  activity: Activity[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtTimeAgo(iso: string): string {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `Il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Returns French relative label + dot color (green/orange/gray) based on freshness.
function fmtRelative(iso: string | null): { label: string; dot: string } {
  if (!iso) return { label: '—', dot: '#D1D5DB' };
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  const diffD = diffMs / 86400000;
  if (diffH < 24) {
    if (now.toDateString() === d.toDateString()) return { label: "Aujourd'hui", dot: '#22C55E' };
    return { label: 'Hier', dot: '#22C55E' };
  }
  if (diffD < 2) return { label: 'Hier', dot: '#22C55E' };
  if (diffD < 7) return { label: `Il y a ${Math.floor(diffD)} jours`, dot: '#F59E0B' };
  if (diffD < 30) return { label: `Il y a ${Math.floor(diffD / 7)} sem.`, dot: '#9CA3AF' };
  if (diffD < 365) return { label: `Il y a ${Math.floor(diffD / 30)} mois`, dot: '#9CA3AF' };
  return { label: d.toLocaleDateString('fr-FR'), dot: '#9CA3AF' };
}


const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  todo:        { bg: '#F3F4F6', color: '#6B7280', label: 'À faire' },
  in_progress: { bg: '#EFF6FF', color: '#3B82F6', label: 'En cours' },
  in_review:   { bg: '#F5F3FF', color: '#7C3AED', label: 'En revue' },
  done:        { bg: '#F0FDF4', color: '#16A34A', label: 'Terminé' },
  cancelled:   { bg: '#FEF2F2', color: '#EF4444', label: 'Annulé' },
};

const PRIORITY_CFG: Record<string, { color: string; label: string }> = {
  low:    { color: '#3B82F6', label: 'Basse' },
  normal: { color: '#F59E0B', label: 'Moyenne' },
  high:   { color: '#F97316', label: 'Haute' },
  urgent: { color: '#EF4444', label: 'Urgente' },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ active_count: 0, clients_count: 0, tasks_in_progress: 0, tasks_overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'accountant'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWide, setIsWide] = useState(typeof window !== 'undefined' ? window.innerWidth > 1200 : true);

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth > 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Grid column template — collapses on smaller screens
  const gridCols = isWide
    ? '2fr 1fr 1fr 1fr 1.5fr 1fr 1fr'
    : '2fr 1fr 1fr 1.5fr 1fr';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/team');
      setMembers(data.members ?? []);
      setMetrics(data.metrics ?? { active_count: 0, clients_count: 0, tasks_in_progress: 0, tasks_overdue: 0 });
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => members.filter(m => {
    if (statusFilter === 'active' && !m.is_active) return false;
    if (statusFilter === 'inactive' && m.is_active) return false;
    if (roleFilter !== 'all' && m.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!m.name.toLowerCase().includes(s) && !m.email.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [members, statusFilter, roleFilter, search]);

  async function handleToggleActive(m: Member) {
    if (!confirm(`${m.is_active ? 'Désactiver' : 'Réactiver'} ${m.name} ?`)) return;
    try { await apiClient.patch(`/team/${m.id}/active`); fetchAll(); } catch { /* */ }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users2 size={22} /> Équipe du cabinet
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>Gestion et suivi des comptables</p>
        </div>
        <Link to="/invitations" style={{ padding: '9px 18px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
          <Plus size={16} /> Ajouter un comptable
        </Link>
      </div>

      {/* Metrics cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: <Users2 size={22} />,      label: 'Comptables actifs', value: metrics.active_count,      color: '#3B82F6', bg: '#EFF6FF' },
          { icon: <Briefcase size={22} />,   label: 'Clients assignés',  value: metrics.clients_count,     color: '#10B981', bg: '#ECFDF5' },
          { icon: <Clock size={22} />,       label: 'Tâches en cours',   value: metrics.tasks_in_progress, color: '#F59E0B', bg: '#FFFBEB' },
          { icon: <AlertCircle size={22} />, label: 'Tâches en retard',  value: metrics.tasks_overdue,     color: '#EF4444', bg: '#FEF2F2' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value || 0}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.3 }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters on a single row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou email..." style={{ width: '100%', height: 36, border: '1px solid #E5E7EB', borderRadius: 8, padding: '0 12px 0 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
          {[{ k: 'all', l: 'Tous' }, { k: 'active', l: 'Actifs' }, { k: 'inactive', l: 'Inactifs' }].map(o => (
            <button key={o.k} onClick={() => setStatusFilter(o.k as 'all' | 'active' | 'inactive')}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: statusFilter === o.k ? 500 : 400, background: statusFilter === o.k ? '#fff' : 'transparent', color: statusFilter === o.k ? '#111827' : '#6B7280', boxShadow: statusFilter === o.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {o.l}
            </button>
          ))}
        </div>

        {/* Role pills */}
        <div style={{ display: 'flex', gap: 0, background: '#F3F4F6', borderRadius: 8, padding: 3 }}>
          {[{ k: 'all', l: 'Tous rôles' }, { k: 'admin', l: 'Admins' }, { k: 'accountant', l: 'Comptables' }].map(o => (
            <button key={o.k} onClick={() => setRoleFilter(o.k as 'all' | 'admin' | 'accountant')}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: roleFilter === o.k ? 500 : 400, background: roleFilter === o.k ? '#fff' : 'transparent', color: roleFilter === o.k ? '#111827' : '#6B7280', boxShadow: roleFilter === o.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={24} className="animate-spin" color="#3B82F6" /></div>}

      {/* Grid-based table */}
      {!loading && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: gridCols, gap: 0,
            background: '#0F172A', padding: '14px 24px',
            color: '#94A3B8', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <div>Comptable</div>
            {isWide && <div>Téléphone</div>}
            <div>Rôle</div>
            <div style={{ textAlign: 'center' }}>Clients</div>
            <div>Tâches</div>
            <div style={{ textAlign: 'center' }}>Statut</div>
            {isWide && <div>Dernière activité</div>}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ height: 56, width: 56, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Users2 size={24} color="#9CA3AF" />
              </div>
              <div style={{ fontWeight: 500, color: '#374151', fontSize: 15 }}>Aucun comptable dans votre équipe</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Cliquez sur « + Ajouter un comptable » pour commencer</div>
            </div>
          )}

          {/* Rows */}
          {filtered.map((m, i) => {
            const total = m.tasks_done + m.tasks_in_progress;
            const donePct = total > 0 ? (m.tasks_done / total) * 100 : 0;
            const overduePct = total > 0 ? (m.tasks_overdue / total) * 100 : 0;
            const isAdmin = m.role === 'admin';
            const rel = fmtRelative(m.last_seen);
            const accentBorder = isAdmin ? '#3B82F6' : '#10B981';
            const allDone = total > 0 && m.tasks_done === total;

            return (
              <div key={m.id}
                onClick={() => setSelectedId(m.id)}
                style={{
                  display: 'grid', gridTemplateColumns: gridCols, gap: 0,
                  padding: '16px 24px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                  alignItems: 'center',
                  borderLeft: `3px solid ${accentBorder}`,
                  background: 'white',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>

                {/* COMPTABLE — avatar + name + email */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: isAdmin
                      ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                      : 'linear-gradient(135deg, #10B981, #047857)',
                    color: '#fff', fontSize: 14, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {m.initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                  </div>
                </div>

                {/* TÉLÉPHONE (wide screens only) */}
                {isWide && (
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    {m.phone || <span style={{ color: '#D1D5DB' }}>—</span>}
                  </div>
                )}

                {/* RÔLE */}
                <div>
                  <span style={{
                    background: isAdmin ? '#EFF6FF' : '#ECFDF5',
                    color:      isAdmin ? '#1D4ED8' : '#047857',
                    border: `1px solid ${isAdmin ? '#BFDBFE' : '#A7F3D0'}`,
                    borderRadius: 20, padding: '3px 10px',
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {isAdmin ? 'Administrateur' : 'Comptable'}
                  </span>
                </div>

                {/* CLIENTS */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{m.clients_count}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>client{m.clients_count > 1 ? 's' : ''}</div>
                </div>

                {/* TÂCHES — progress bar */}
                <div>
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 500 }}>
                    {m.tasks_done} terminée{m.tasks_done > 1 ? 's' : ''}{' '}
                    <span style={{ color: '#9CA3AF' }}>/ {total} total</span>
                  </div>
                  <div style={{ background: '#F3F4F6', borderRadius: 4, height: 6, overflow: 'hidden', display: 'flex', width: '85%' }}>
                    {donePct > 0 && (
                      <div style={{
                        width: `${donePct}%`,
                        background: allDone ? '#22C55E' : '#3B82F6',
                        height: '100%',
                        transition: 'width 0.5s ease',
                      }} />
                    )}
                    {overduePct > 0 && (
                      <div style={{ width: `${overduePct}%`, background: '#EF4444', height: '100%' }} />
                    )}
                  </div>
                  {m.tasks_overdue > 0 && (
                    <div style={{ fontSize: 10, color: '#EF4444', marginTop: 3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertCircle size={10} /> {m.tasks_overdue} en retard
                    </div>
                  )}
                </div>

                {/* STATUT */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    background: m.is_active ? '#F0FDF4' : '#F9FAFB',
                    color:      m.is_active ? '#16A34A' : '#9CA3AF',
                    border: `1px solid ${m.is_active ? '#BBF7D0' : '#E5E7EB'}`,
                    borderRadius: 20, padding: '4px 12px',
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {m.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                {/* DERNIÈRE ACTIVITÉ (wide screens only) */}
                {isWide && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: rel.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{rel.label}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail slide-over */}
      {selectedId && <MemberDetailPanel userId={selectedId} onClose={() => setSelectedId(null)} onChanged={fetchAll} />}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

// ─── Detail slide-over ──────────────────────────────────────────────────────

function MemberDetailPanel({ userId, onClose, onChanged }: { userId: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskClientFilter, setTaskClientFilter] = useState('');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const { data } = await apiClient.get(`/team/${userId}`); setData(data); }
      catch { /* */ }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    return data.tasks.filter(t => {
      if (taskClientFilter && t.client_id !== taskClientFilter) return false;
      if (taskPriorityFilter && t.priority !== taskPriorityFilter) return false;
      return true;
    });
  }, [data, taskClientFilter, taskPriorityFilter]);

  const kanbanCols = [
    { key: 'todo', label: 'À faire', color: '#6B7280', bg: '#F9FAFB', headerBg: '#F3F4F6' },
    { key: 'in_progress', label: 'En cours', color: '#3B82F6', bg: '#EFF6FF', headerBg: '#DBEAFE' },
    { key: 'in_review', label: 'En revue', color: '#7C3AED', bg: '#F5F3FF', headerBg: '#EDE9FE' },
    { key: 'done', label: 'Terminé', color: '#16A34A', bg: '#F0FDF4', headerBg: '#DCFCE7' },
  ];

  const maxWeek = data ? Math.max(1, ...data.performance.weeks.map(w => w.count)) : 1;

  async function handleToggle() {
    if (!data) return;
    if (!confirm(`${data.member.is_active ? 'Désactiver' : 'Réactiver'} ${data.member.name} ?`)) return;
    try { await apiClient.patch(`/team/${userId}/active`); onChanged(); onClose(); } catch { /* */ }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, width: 760, height: '100vh', background: 'white', boxShadow: '-10px 0 40px rgba(0,0,0,0.15)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
        {loading || !data ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="animate-spin" color="#3B82F6" /></div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: 'white', fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{data.member.initials}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{data.member.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: data.member.role === 'admin' ? '#FEF3C7' : '#EFF6FF', color: data.member.role === 'admin' ? '#C2410C' : '#3B82F6' }}>{data.member.role_label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: data.member.is_active ? '#DCFCE7' : '#F3F4F6', color: data.member.is_active ? '#16A34A' : '#6B7280' }}>{data.member.is_active ? 'Actif' : 'Inactif'}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleToggle} title={data.member.is_active ? 'Désactiver' : 'Réactiver'} style={iconBtn}>{data.member.is_active ? <Ban size={14} /> : <Power size={14} />}</button>
                <button onClick={onClose} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* Personal info */}
              <Section title="Informations personnelles">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InfoCell icon={<Mail size={14} />} label="Email" value={data.member.email} />
                  <InfoCell icon={<Phone size={14} />} label="Téléphone" value={data.member.phone || '—'} />
                  <InfoCell icon={<Calendar size={14} />} label="Date d'entrée" value={fmtDate(data.member.created_at)} />
                  <InfoCell icon={<Clock size={14} />} label="Dernière activité" value={data.member.last_seen ? fmtDateTime(data.member.last_seen) : '—'} />
                </div>
              </Section>

              {/* Performance */}
              <Section title="Performance">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  <StatBox icon={<CheckCircle size={16} />} color="#16A34A" label="Terminées" value={data.performance.total_done} />
                  <StatBox icon={<TrendingUp size={16} />} color="#3B82F6" label="Taux à temps" value={`${data.performance.completion_rate}%`} />
                  <StatBox icon={<Clock size={16} />} color="#F59E0B" label="Temps moyen" value={`${data.performance.avg_processing_days} j`} />
                </div>
                {/* Weekly chart */}
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '14px 16px', border: '1px solid #F3F4F6' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>Tâches terminées par semaine</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                    {data.performance.weeks.map((w, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', background: '#3B82F6', borderRadius: '4px 4px 0 0', height: `${(w.count / maxWeek) * 80}px`, minHeight: 2, position: 'relative' }}>
                          {w.count > 0 && <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: '#3B82F6' }}>{w.count}</span>}
                        </div>
                        <span style={{ fontSize: 9, color: '#9CA3AF' }}>{w.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Assigned clients */}
              <Section title={`Clients assignés (${data.clients.length})`}>
                {data.clients.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>Aucun client assigné</div>
                ) : (
                  <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    {data.clients.map((c, i) => (
                      <Link key={c.id} to={`/clients/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{c.open_tasks} tâche{c.open_tasks !== 1 ? 's' : ''} ouverte{c.open_tasks !== 1 ? 's' : ''} · {c.total_tasks} au total</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.last_activity ? fmtTimeAgo(c.last_activity) : '—'}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Section>

              {/* Tasks kanban */}
              <Section title={`Suivi des tâches (${filteredTasks.length})`}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select value={taskClientFilter} onChange={e => setTaskClientFilter(e.target.value)} style={smallSel}>
                    <option value="">Tous clients</option>
                    {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={taskPriorityFilter} onChange={e => setTaskPriorityFilter(e.target.value)} style={smallSel}>
                    <option value="">Toutes priorités</option>
                    <option value="urgent">Urgente</option>
                    <option value="high">Haute</option>
                    <option value="normal">Moyenne</option>
                    <option value="low">Basse</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {kanbanCols.map(col => {
                    const colTasks = filteredTasks.filter(t => t.status === col.key);
                    const overdueCount = colTasks.filter(t => t.is_overdue).length;
                    return (
                      <div key={col.key} style={{ background: col.bg, borderRadius: 10, overflow: 'hidden', minHeight: 120 }}>
                        <div style={{ background: col.headerBg, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: 11, color: col.color }}>{col.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {overdueCount > 0 && <span style={{ background: '#EF4444', color: 'white', borderRadius: 20, padding: '0 5px', fontSize: 9, fontWeight: 700 }}>{overdueCount} ⚠</span>}
                            <span style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 600, color: col.color }}>{colTasks.length}</span>
                          </div>
                        </div>
                        <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {colTasks.map(t => {
                            const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.normal;
                            return (
                              <div key={t.id} style={{ background: 'white', borderRadius: 6, padding: '6px 8px', border: '1px solid #E5E7EB', borderLeft: `3px solid ${t.is_overdue ? '#EF4444' : pc.color}`, fontSize: 11 }}>
                                <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2, lineHeight: 1.3 }}>{t.title}</div>
                                {t.client_name && <div style={{ color: '#9CA3AF', fontSize: 10 }}>📁 {t.client_name}</div>}
                                {t.due_date && <div style={{ color: t.is_overdue ? '#EF4444' : '#9CA3AF', fontSize: 10, marginTop: 2 }}>{fmtDate(t.due_date)}{t.is_overdue && ' ⚠'}</div>}
                              </div>
                            );
                          })}
                          {colTasks.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 10, padding: '12px 4px' }}>—</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Activity */}
              <Section title="Activité récente">
                {data.activity.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, background: '#F9FAFB', borderRadius: 8 }}>Aucune activité récente</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 20 }}>
                    <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: '#E5E7EB' }} />
                    {data.activity.map((a, i) => (
                      <div key={i} style={{ position: 'relative', paddingBottom: 12 }}>
                        <div style={{ position: 'absolute', left: -18, top: 4, width: 10, height: 10, borderRadius: '50%', background: a.type === 'task_completed' ? '#22C55E' : '#3B82F6', border: '2px solid white' }} />
                        <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{a.label}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{a.client_name} · {fmtTimeAgo(a.at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h4>
      {children}
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', border: '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{value}</div>
    </div>
  );
}

function StatBox({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: number | string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '12px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 };
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13 };
const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 6, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' };
const smallSel: React.CSSProperties = { height: 32, border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 8px', fontSize: 12, outline: 'none', background: 'white', cursor: 'pointer' };

